import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import * as bcrypt from "bcryptjs";
import { 
  loginSchema, changePasswordSchema, insertUserSchema, updateUserSchema, insertBookingSchema,
  insertDriverQualificationSchema, insertDriveLogSchema, insertCurrencyDriveSchema,
  type User, type SafeUser, type Booking, type BookingWithUser, type DashboardStats, type BookableWeekRange,
  type DriverQualification, type DriveLog, type QualificationWithStatus, type CurrencyDrive
} from "@shared/schema";
import { differenceInHours, differenceInMinutes, startOfDay, endOfDay, addDays, parseISO, isAfter, format, differenceInDays } from "date-fns";
import { getCurrentBookableWeek, DEFAULT_BOOKING_RELEASE_DAY } from "./utils/bookingSchedule";
import { calculateCurrency, getCurrencyStatus, recalculateCurrencyForQualification } from "./utils/currencyCalculator";
import { eq } from "drizzle-orm";
import { 
  users, bookings, driveLogs, driverQualifications, currencyDrives, currencyDriveScans, Msp, config
} from "@shared/schema";
import * as schema from "@shared/schema";
import { InsertDriveLog, InsertDriverQualification, InsertCurrencyDrive, InsertBooking } from "@shared/schema";
import { DatabaseStorage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";

// Helper function to compute expiry date consistently
const getComputedExpiry = (qualification: DriverQualification) => {
  const baseDate = qualification.lastDriveDate || qualification.qualifiedOnDate;
  const expiry = new Date(baseDate);
  expiry.setDate(expiry.getDate() + 88);
  return expiry;
};

// Helper function to check if qualification is expired using computed logic
const isQualificationExpired = (qualification: DriverQualification) => {
  const computedExpiry = getComputedExpiry(qualification);
  return !isAfter(computedExpiry, new Date());
};

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "coy-mess-room-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  // Middleware to check authentication
  const requireAuth = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    next();
  };

  // Middleware to check admin role
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Middleware to check admin or commander role
  const requireAdminOrCommander = async (req: any, res: any, next: any) => {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "commander")) {
      return res.status(403).json({ message: "Admin or commander access required" });
    }
    next();
  };

  // Seed initial data
  const seedData = async () => {
    // Helper to determine role based on rank
    const getRoleFromRank = (rank: string | null): "soldier" | "commander" => {
      if (!rank) return "soldier";
      const sergeantAndAbove = ["CPT", "2LT", "1WO", "2WO", "3WO", "1SG", "2SG", "3SG"];
      return sergeantAndAbove.includes(rank) ? "commander" : "soldier";
    };

    // Migration: Update existing users' roles based on their rank
    const allUsers = await storage.getAllUsers();
    for (const user of allUsers) {
      if (user.role !== "admin") {
        const expectedRole = getRoleFromRank(user.rank);
        if (user.role !== expectedRole) {
          await storage.updateUser(user.id, { role: expectedRole });
        }
      }
    }

    // Ensure MSPs exist
    const existingMsps = await storage.getAllMsps();
    const mspNames = ["HQ", "MSP 1", "MSP 2", "MSP 3", "MSP 4", "MSP 5"];
    const createdMsps: { [key: string]: any } = {};
    
    for (const name of mspNames) {
      let msp = existingMsps.find(m => m.name === name);
      if (!msp) {
        msp = await storage.createMsp({ name });
      }
      createdMsps[name] = msp;
    }

    const existingAdmin = await storage.getUserByUsername("admin");
    if (existingAdmin) return; // Already seeded

    // Use the created/existing MSPs
    const mspHQ = createdMsps["HQ"];
    const msp1 = createdMsps["MSP 1"];
    const msp2 = createdMsps["MSP 2"];
    const msp3 = createdMsps["MSP 3"];

    // Create admin user
    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    await storage.createUser({
      username: "admin",
      passwordHash: adminPasswordHash,
      fullName: "Company Admin",
      role: "admin",
      credits: 0,
      password: "admin123",
      rank: "CPT",
      mspId: mspHQ.id,
    });

    // Create sample soldiers with different ranks
    const soldierPassword = await bcrypt.hash("password123", 10);
    const soldier1 = await storage.createUser({
      username: "soldier1",
      passwordHash: soldierPassword,
      fullName: "John Smith",
      role: getRoleFromRank("3SG"),
      credits: 10,
      password: "password123",
      rank: "3SG",
      mspId: msp1.id,
    });

    const soldier2 = await storage.createUser({
      username: "soldier2",
      passwordHash: soldierPassword,
      fullName: "Sarah Johnson",
      role: getRoleFromRank("2SG"),
      credits: 10,
      password: "password123",
      rank: "2SG",
      mspId: msp2.id,
    });

    const soldier3 = await storage.createUser({
      username: "soldier3",
      passwordHash: soldierPassword,
      fullName: "Mike Davis",
      role: getRoleFromRank("LCP"),
      credits: 10,
      password: "password123",
      rank: "LCP",
      mspId: msp3.id,
    });

    // Create sample bookings (tomorrow at different times)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    await storage.createBooking({
      userId: soldier1.id,
      startTime: new Date(tomorrow),
      endTime: new Date(new Date(tomorrow).setHours(16, 0, 0, 0)),
      creditsCharged: 2,
    });

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(18, 0, 0, 0);

    await storage.createBooking({
      userId: soldier2.id,
      startTime: new Date(dayAfter),
      endTime: new Date(new Date(dayAfter).setHours(20, 0, 0, 0)),
      creditsCharged: 2,
    });

    await storage.setConfig("defaultMonthlyCredits", "10");
    await storage.setConfig("bookingReleaseDay", "0"); // Sunday by default
  };

  await seedData();

  // Helper function to sanitize user objects (remove password hash)
  const sanitizeUser = (user: User): SafeUser => {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      res.json(sanitizeUser(user));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, (req: any, res) => {
    res.json(sanitizeUser(req.user));
  });

  app.post("/api/auth/change-password", requireAuth, async (req: any, res) => {
    try {
      const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
      
      const user = req.user;
      const isValidPassword = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      const updatedUser = await storage.updatePassword(user.id, newPasswordHash);
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Password change failed" });
    }
  });

  // Booking routes
  app.get("/api/bookings", requireAuth, async (req: any, res) => {
    try {
      const allBookings = await storage.getAllBookings();
      
      // Add user information to each booking (sanitized)
      const bookingsWithUsers: BookingWithUser[] = await Promise.all(
        allBookings.map(async (booking) => {
          const user = await storage.getUser(booking.userId);
          return { ...booking, user: user ? sanitizeUser(user) : undefined };
        })
      );

      res.json(bookingsWithUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch bookings" });
    }
  });

  app.get("/api/bookings/my", requireAuth, async (req: any, res) => {
    try {
      const bookings = await storage.getBookingsByUser(req.user.id);
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch bookings" });
    }
  });

  // Get calendar events - role-based view
  app.get("/api/bookings/calendar-events", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role === "admin" || user.role === "commander") {
        // Admins and commanders see aggregated events (1 per timeslot) - only active bookings
        const allBookings = await storage.getAllBookings();
        const activeBookings = allBookings.filter(b => b.status === "active");
        
        // Group bookings by timeslot
        const groupedBySlot = new Map<string, Booking[]>();
        
        activeBookings.forEach((booking) => {
          const slotKey = `${booking.startTime}-${booking.endTime}`;
          if (!groupedBySlot.has(slotKey)) {
            groupedBySlot.set(slotKey, []);
          }
          groupedBySlot.get(slotKey)!.push(booking);
        });
        
        // Create aggregated events
        const events = Array.from(groupedBySlot.entries()).map(([slotKey, bookings]) => {
          const booking = bookings[0];
          return {
            id: slotKey,
            title: `${bookings.length} booking${bookings.length > 1 ? 's' : ''}`,
            start: booking.startTime,
            end: booking.endTime,
            bookingCount: bookings.length,
            bookingIds: bookings.map(b => b.id),
          };
        });
        
        res.json(events);
      } else {
        // Soldiers see only their own active bookings
        const bookings = await storage.getBookingsByUser(user.id);
        const activeBookings = bookings.filter(b => b.status === "active");
        
        const events = activeBookings.map((booking) => ({
          id: booking.id,
          title: "My Booking",
          start: booking.startTime,
          end: booking.endTime,
          bookingId: booking.id,
        }));
        
        res.json(events);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch calendar events" });
    }
  });

  // Get booking details for a specific timeslot (admin or commander)
  app.get("/api/bookings/timeslot-details", requireAuth, requireAdminOrCommander, async (req: any, res) => {
    try {
      const { startTime, endTime } = req.query;
      
      if (!startTime || !endTime) {
        return res.status(400).json({ message: "startTime and endTime are required" });
      }

      const start = new Date(startTime as string);
      const end = new Date(endTime as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const allBookings = await storage.getAllBookings();
      
      // Filter bookings that match this exact timeslot
      const matchingBookings = allBookings.filter(
        (booking) => 
          new Date(booking.startTime).getTime() === start.getTime() &&
          new Date(booking.endTime).getTime() === end.getTime()
      );
      
      // Add user information to each booking
      const bookingsWithUsers: BookingWithUser[] = await Promise.all(
        matchingBookings.map(async (booking) => {
          const user = await storage.getUser(booking.userId);
          return { ...booking, user: user ? sanitizeUser(user) : undefined };
        })
      );

      res.json(bookingsWithUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch timeslot details" });
    }
  });

  app.get("/api/bookings/capacity", requireAuth, async (req: any, res) => {
    try {
      const { startTime, endTime } = req.query;
      
      if (!startTime || !endTime) {
        return res.status(400).json({ message: "startTime and endTime are required" });
      }

      const start = new Date(startTime as string);
      const end = new Date(endTime as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const MAX_CAPACITY = 20;
      const concurrentBookings = await storage.countConcurrentBookings(start, end);
      const availableSpots = MAX_CAPACITY - concurrentBookings;

      res.json({
        maxCapacity: MAX_CAPACITY,
        currentBookings: concurrentBookings,
        availableSpots,
        isFull: concurrentBookings >= MAX_CAPACITY,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch capacity" });
    }
  });

  app.post("/api/bookings", requireAuth, async (req: any, res) => {
    try {
      const bookingData = insertBookingSchema.parse(req.body);
      
      // Validate booking is in the future
      const startTime = new Date(bookingData.startTime);
      const endTime = new Date(bookingData.endTime);
      
      if (startTime < new Date()) {
        return res.status(400).json({ message: "Cannot book in the past" });
      }

      if (startTime >= endTime) {
        return res.status(400).json({ message: "End time must be after start time" });
      }

      // Enforce exactly 1 hour (60 minutes) booking duration
      const durationMinutes = differenceInMinutes(endTime, startTime);
      if (durationMinutes !== 60) {
        return res.status(400).json({ 
          message: "Bookings must be exactly 1 hour (60 minutes). Please select a valid meal time slot." 
        });
      }

      // Check mess room capacity (max 20 people at any given time)
      const MAX_CAPACITY = 20;
      const concurrentBookings = await storage.countConcurrentBookings(startTime, endTime);
      
      if (concurrentBookings >= MAX_CAPACITY) {
        return res.status(400).json({ 
          message: `This time slot is full (${MAX_CAPACITY}/${MAX_CAPACITY} capacity). Please choose another time.` 
        });
      }

      // Calculate credits needed (1 credit per hour)
      const creditsNeeded = 1;

      // Get user details
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Admin and commanders don't need credits, only soldiers do
      if (user.role === "soldier") {
        // Check if user has enough credits
        if (user.credits < creditsNeeded) {
          return res.status(400).json({ 
            message: `Insufficient credits. Need ${creditsNeeded}, have ${user.credits}` 
          });
        }

        // Deduct credits for soldiers
        await storage.updateUser(req.user.id, {
          credits: user.credits - creditsNeeded,
        });
      }

      const booking = await storage.createBooking({
        ...bookingData,
        creditsCharged: creditsNeeded,
      });

      res.json(booking);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create booking" });
    }
  });

  app.post("/api/bookings/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.status === "cancelled") {
        return res.status(400).json({ message: "Booking already cancelled" });
      }

      // Check if user is the owner, admin, or commander
      if (booking.userId !== req.user.id && req.user.role !== "admin" && req.user.role !== "commander") {
        return res.status(403).json({ message: "Not authorized to cancel this booking" });
      }

      // Calculate refund based on 24-hour policy
      const hoursUntilStart = differenceInHours(new Date(booking.startTime), new Date());
      const shouldRefund = hoursUntilStart > 24;

      // Update booking status
      await storage.updateBooking(booking.id, {
        status: "cancelled",
        cancelledAt: new Date(),
      });

      // Refund credits if applicable
      if (shouldRefund) {
        const user = await storage.getUser(booking.userId);
        if (user) {
          await storage.updateUser(booking.userId, {
            credits: user.credits + booking.creditsCharged,
          });
        }
      }

      res.json({ 
        message: "Booking cancelled",
        refunded: shouldRefund,
        creditsRefunded: shouldRefund ? booking.creditsCharged : 0,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to cancel booking" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const soldiers = allUsers.filter(u => u.role === "soldier");
      const allBookings = await storage.getAllBookings();

      const today = new Date();
      const activeBookingsToday = allBookings.filter(b => {
        const bookingDate = new Date(b.startTime);
        return (
          b.status === "active" &&
          bookingDate >= startOfDay(today) &&
          bookingDate <= endOfDay(today)
        );
      }).length;

      const totalCreditsIssued = soldiers.reduce((sum, user) => sum + user.credits, 0);

      const stats: DashboardStats = {
        totalUsers: soldiers.length,
        activeBookingsToday,
        totalCreditsIssued,
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", requireAuth, requireAdminOrCommander, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(sanitizeUser));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 10);

      const user = await storage.createUser({
        ...userData,
        passwordHash,
      });

      res.json(sanitizeUser(user));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create user" });
    }
  });

  app.put("/api/admin/users/:id", requireAuth, requireAdminOrCommander, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If only updating credits, handle separately
      if (Object.keys(req.body).length === 1 && "credits" in req.body) {
        const credits = req.body.credits;
        if (typeof credits !== "number" || credits < 0) {
          return res.status(400).json({ message: "Invalid credits value" });
        }
        const updatedUser = await storage.updateUser(req.params.id, { credits });
        return res.json(sanitizeUser(updatedUser!));
      }

      // For other updates, validate against schema
      const userData = updateUserSchema.parse(req.body);

      // Check if username is being changed and if it's already taken
      if (userData.username && userData.username !== user.username) {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }

      const updates: any = { ...userData };
      
      // Hash new password if provided
      if (userData.password) {
        updates.passwordHash = await bcrypt.hash(userData.password, 10);
        delete updates.password;
      }

      const updatedUser = await storage.updateUser(req.params.id, updates);
      res.json(sanitizeUser(updatedUser!));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prevent deletion of admin and commander users
      if (user.role === "admin" || user.role === "commander") {
        return res.status(403).json({ message: "Cannot delete admin or commander users" });
      }
      
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete user" });
    }
  });

  app.post("/api/admin/users/batch-import", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data || typeof data !== "string") {
        return res.status(400).json({ message: "Invalid import data" });
      }

      const lines = data.trim().split('\n').filter((line: string) => line.trim());
      const allMsps = await storage.getAllMsps();
      
      const results = {
        success: [] as any[],
        failed: [] as any[],
      };

      // Helper to determine role based on rank
      const getRoleFromRank = (rank: string | null): "soldier" | "commander" => {
        if (!rank) return "soldier";
        const sergeantAndAbove = ["CPT", "2LT", "1WO", "2WO", "3WO", "1SG", "2SG", "3SG"];
        return sergeantAndAbove.includes(rank) ? "commander" : "soldier";
      };

      for (const line of lines) {
        const parts = line.split('\t').map((p: string) => p.trim());
        
        if (parts.length < 4) {
          results.failed.push({ line, reason: "Invalid format - expected 4 tab-separated fields (Username, Full Name, Rank, MSP)" });
          continue;
        }

        const [username, fullName, rank, mspName] = parts;
        
        // Validate username format (lowercase, no spaces)
        if (!/^[a-z0-9_]+$/.test(username)) {
          results.failed.push({ line, reason: "Username must be lowercase letters, numbers, and underscores only" });
          continue;
        }

        // Check if user already exists
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
          results.failed.push({ line, reason: `Username already exists: ${username}` });
          continue;
        }

        // Find MSP
        const msp = allMsps.find(m => m.name.toUpperCase() === mspName.toUpperCase());
        if (!msp) {
          results.failed.push({ line, reason: `MSP not found: ${mspName}` });
          continue;
        }

        // Determine role from rank
        const role = getRoleFromRank(rank || null);

        // Create user with default password
        try {
          const defaultPassword = "password123";
          const passwordHash = await bcrypt.hash(defaultPassword, 10);
          
          const user = await storage.createUser({
            username,
            fullName,
            rank: rank || null,
            mspId: msp.id,
            role,
            credits: 10,
            passwordHash,
            password: defaultPassword,
          });

          results.success.push({
            username: user.username,
            fullName: user.fullName,
            rank: user.rank,
            msp: msp.name,
            role: user.role,
          });
        } catch (error: any) {
          results.failed.push({ line, reason: error.message || "Failed to create user" });
        }
      }

      res.json({
        message: `Batch import complete: ${results.success.length} succeeded, ${results.failed.length} failed`,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to import users" });
    }
  });

  // Helper function to check and perform automatic weekly credit reset
  const checkAndResetCreditsIfNeeded = async () => {
    try {
      const releaseDayConfig = await storage.getConfig("bookingReleaseDay");
      const releaseDay = releaseDayConfig ? parseInt(releaseDayConfig.value) : DEFAULT_BOOKING_RELEASE_DAY;
      
      const { start } = getCurrentBookableWeek(releaseDay);
      const currentWeekStart = start.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const lastResetConfig = await storage.getConfig("lastCreditResetWeek");
      const lastResetWeek = lastResetConfig?.value;
      
      // If this is a new week, reset all soldier credits
      if (!lastResetWeek || lastResetWeek !== currentWeekStart) {
        const defaultCreditsConfig = await storage.getConfig("defaultWeeklyCredits");
        const defaultCredits = defaultCreditsConfig ? parseFloat(defaultCreditsConfig.value) : 10;
        
        // Reset all soldier accounts
        const allUsers = await storage.getAllUsers();
        const soldiers = allUsers.filter(u => u.role === "soldier");

        for (const soldier of soldiers) {
          await storage.updateUser(soldier.id, { credits: defaultCredits });
        }
        
        // Update last reset week
        await storage.setConfig("lastCreditResetWeek", currentWeekStart);
        
        console.log(`[AUTO RESET] Credits reset for ${soldiers.length} soldiers to ${defaultCredits} credits for week ${currentWeekStart}`);
      }
    } catch (error) {
      console.error("[AUTO RESET] Failed to reset credits:", error);
    }
  };

  // Config routes - Default Weekly Credits
  app.get("/api/config/default-credits", requireAuth, async (req, res) => {
    try {
      const defaultCreditsConfig = await storage.getConfig("defaultWeeklyCredits");
      const defaultCredits = defaultCreditsConfig ? parseFloat(defaultCreditsConfig.value) : 10;
      
      res.json({ defaultCredits });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch default credits" });
    }
  });

  app.put("/api/config/default-credits", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { defaultCredits } = req.body;

      if (typeof defaultCredits !== "number" || defaultCredits < 0) {
        return res.status(400).json({ message: "Invalid default credits value" });
      }

      // Update config (this will be used for future weekly resets)
      await storage.setConfig("defaultWeeklyCredits", defaultCredits.toString());

      res.json({ 
        message: "Default weekly credits updated successfully",
        defaultCredits,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update default credits" });
    }
  });

  // Config routes - Booking Release Day
  app.get("/api/config/booking-release-day", requireAuth, async (req, res) => {
    try {
      // Check and perform automatic weekly credit reset if needed
      await checkAndResetCreditsIfNeeded();
      
      const releaseDayConfig = await storage.getConfig("bookingReleaseDay");
      const releaseDay = releaseDayConfig ? parseInt(releaseDayConfig.value) : DEFAULT_BOOKING_RELEASE_DAY;
      
      const { start, end } = getCurrentBookableWeek(releaseDay);
      
      const response: BookableWeekRange = {
        start: start.toISOString(),
        end: end.toISOString(),
        releaseDay,
      };
      
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch booking release day" });
    }
  });

  app.put("/api/config/booking-release-day", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { releaseDay } = req.body;
      
      if (typeof releaseDay !== "number" || releaseDay < 0 || releaseDay > 6) {
        return res.status(400).json({ message: "Release day must be between 0 (Sunday) and 6 (Saturday)" });
      }

      await storage.setConfig("bookingReleaseDay", releaseDay.toString());
      
      const { start, end } = getCurrentBookableWeek(releaseDay);
      
      const response: BookableWeekRange = {
        start: start.toISOString(),
        end: end.toISOString(),
        releaseDay,
      };
      
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update booking release day" });
    }
  });

  // MSP routes
  app.get("/api/msps", requireAuth, async (req, res) => {
    try {
      const msps = await storage.getAllMsps();
      res.json(msps);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch MSPs" });
    }
  });

  // Driver Qualification routes
  app.get("/api/qualifications", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      let qualifications: DriverQualification[];
      
      if (user.role === "admin" || user.role === "commander") {
        qualifications = await storage.getAllQualifications();
      } else {
        qualifications = await storage.getQualificationsByUser(user.id);
      }
      
      const qualificationsWithStatus: QualificationWithStatus[] = await Promise.all(
        qualifications.map(async (q) => {
          const qualUser = await storage.getUser(q.userId);
          const driveLogs = await storage.getDriveLogsByUserAndVehicle(q.userId, q.vehicleType);
          
          const recalculatedQual = await recalculateCurrencyForQualification(
            q,
            driveLogs,
            storage.updateQualification.bind(storage)
          );
          
          const finalQual = recalculatedQual || q;
          return {
            ...finalQual,
            ...getCurrencyStatus(finalQual),
            user: qualUser ? sanitizeUser(qualUser) : undefined,
          };
        })
      );
      
      res.json(qualificationsWithStatus);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch qualifications" });
    }
  });

  app.get("/api/qualifications/my", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const qualifications = await storage.getQualificationsByUser(user.id);
      
      const qualificationsWithStatus: QualificationWithStatus[] = await Promise.all(
        qualifications.map(async (q) => {
          const driveLogs = await storage.getDriveLogsByUserAndVehicle(q.userId, q.vehicleType);
          const recalculatedQual = await recalculateCurrencyForQualification(
            q,
            driveLogs,
            storage.updateQualification.bind(storage)
          );
          // Use recalculated qualification if successful, otherwise fall back to original
          const finalQual = recalculatedQual || q;
          return {
            ...finalQual,
            ...getCurrencyStatus(finalQual),
          };
        })
      );
      
      res.json(qualificationsWithStatus);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch qualifications" });
    }
  });

  app.post("/api/qualifications", requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = insertDriverQualificationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid qualification data", errors: parsed.error.errors });
      }

      const qualifiedDate = parsed.data.qualifiedOnDate instanceof Date 
        ? parsed.data.qualifiedOnDate 
        : new Date(parsed.data.qualifiedOnDate);
      const currencyExpiryDate = addDays(qualifiedDate, 88);

      const qualification = await storage.createQualification({
        ...parsed.data,
        currencyExpiryDate: currencyExpiryDate.toISOString().split('T')[0],
      } as any);

      res.status(201).json(qualification);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create qualification" });
    }
  });

  app.put("/api/qualifications/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const parsed = insertDriverQualificationSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid qualification data", errors: parsed.error.errors });
      }

      // Normalise qualifiedOnDate so it always becomes a YYYY-MM-DD string for storage
      const updateData = { ...(parsed.data as any) };
      if (updateData.qualifiedOnDate instanceof Date) {
        updateData.qualifiedOnDate = updateData.qualifiedOnDate.toISOString().split("T")[0];
      }

      // First, update the basic qualification fields (including qualifiedOnDate if present)
      const updatedQualification = await storage.updateQualification(id, updateData);

      if (!updatedQualification) {
        return res.status(404).json({ message: "Qualification not found" });
      }

      // Now recalculate currency based on current drive logs
      const driveLogsForQual = await storage.getDriveLogsByUserAndVehicle(
        updatedQualification.userId,
        updatedQualification.vehicleType,
      );

      let finalQualification = await recalculateCurrencyForQualification(
        updatedQualification,
        driveLogsForQual,
        storage.updateQualification.bind(storage),
      );

      // If there are still no drive logs, force expiry to be qualifiedOnDate + 88 days
      if (driveLogsForQual.length === 0) {
        const base = finalQualification ?? updatedQualification;
        const qualifiedDate = new Date(base.qualifiedOnDate);
        const forcedExpiry = addDays(qualifiedDate, 88).toISOString().split("T")[0];
        finalQualification = await storage.updateQualification(base.id, {
          currencyExpiryDate: forcedExpiry,
          lastDriveDate: null,
        } as any);
      }

      res.json(finalQualification ?? updatedQualification);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update qualification" });
    }
  });

  app.delete("/api/qualifications/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteQualification(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Qualification not found" });
      }
      res.json({ message: "Qualification deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete qualification" });
    }
  });

  app.post("/api/qualifications/batch-import", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data || typeof data !== "string") {
        return res.status(400).json({ message: "Invalid import data" });
      }

      const lines = data.trim().split('\n').filter((line: string) => line.trim());
      const allUsers = await storage.getAllUsers();
      
      const results = {
        success: [] as any[],
        failed: [] as any[],
      };

      for (const line of lines) {
        const parts = line.split('\t').map((p: string) => p.trim());
        
        if (parts.length < 3) {
          results.failed.push({ line, reason: "Invalid format - expected 3 tab-separated fields" });
          continue;
        }

        const [fullName, vehicleTypeRaw, dateStr] = parts;
        const vehicleType = vehicleTypeRaw.toUpperCase();
        
        // Validate vehicle type
        if (vehicleType !== "TERREX" && vehicleType !== "BELREX") {
          results.failed.push({ line, reason: `Invalid vehicle type: ${vehicleTypeRaw}. Must be TERREX or BELREX` });
          continue;
        }

        // Parse date from M/D/YYYY format
        const dateParts = dateStr.split('/');
        if (dateParts.length !== 3) {
          results.failed.push({ line, reason: `Invalid date format: ${dateStr}. Expected M/D/YYYY` });
          continue;
        }
        
        const month = parseInt(dateParts[0]);
        const day = parseInt(dateParts[1]);
        const year = parseInt(dateParts[2]);
        const qualifiedDate = new Date(year, month - 1, day);
        
        if (isNaN(qualifiedDate.getTime())) {
          results.failed.push({ line, reason: `Invalid date: ${dateStr}` });
          continue;
        }

        // Find user by full name (case-insensitive)
        const user = allUsers.find(u => u.fullName.toUpperCase() === fullName.toUpperCase());
        
        if (!user) {
          results.failed.push({ line, reason: `User not found: ${fullName}` });
          continue;
        }

        // Check if qualification already exists
        const existingQuals = await storage.getQualificationsByUser(user.id);
        const alreadyExists = existingQuals.some(q => q.vehicleType === vehicleType);
        
        if (alreadyExists) {
          results.failed.push({ line, reason: `${user.fullName} already has ${vehicleType} qualification` });
          continue;
        }

        // Create qualification
        try {
          const currencyExpiryDate = addDays(qualifiedDate, 88);
          const qualification = await storage.createQualification({
            userId: user.id,
            vehicleType: vehicleType as "TERREX" | "BELREX",
            qualifiedOnDate: qualifiedDate,
            currencyExpiryDate: currencyExpiryDate.toISOString().split('T')[0],
          } as any);

          results.success.push({
            user: user.fullName,
            vehicleType,
            qualifiedDate: qualifiedDate.toISOString().split('T')[0],
          });
        } catch (error: any) {
          results.failed.push({ line, reason: error.message || "Failed to create qualification" });
        }
      }

      res.json({
        message: `Batch import complete: ${results.success.length} succeeded, ${results.failed.length} failed`,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to import qualifications" });
    }
  });

  // Drive Log routes
  app.get("/api/drive-logs", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      let driveLogs: DriveLog[];
      
      if (user.role === "admin" || user.role === "commander") {
        driveLogs = await storage.getAllDriveLogs();
      } else {
        driveLogs = await storage.getDriveLogsByUser(user.id);
      }
      
      res.json(driveLogs);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch drive logs" });
    }
  });

  app.get("/api/drive-logs/my", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const driveLogs = await storage.getDriveLogsByUser(user.id);
      res.json(driveLogs);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch drive logs" });
    }
  });

  app.post("/api/drive-logs", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const parsed = insertDriveLogSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid drive log data", errors: parsed.error.errors });
      }

      // Check if qualification is expired
      const userId = (user.role === "admin" || user.role === "commander") ? parsed.data.userId : user.id;
      const qualification = await storage.getUserQualificationForVehicle(userId, parsed.data.vehicleType as "TERREX" | "BELREX");
      if (qualification && isQualificationExpired(qualification)) {
        return res.status(410).json({ message: `Currency for ${parsed.data.vehicleType} has expired. Cannot log drives.` });
      }

      const distanceKm = (parsed.data.finalMileageKm || 0) - (parsed.data.initialMileageKm || 0);
      
      const driveLog = await storage.createDriveLog({
        ...parsed.data,
        userId,
        distanceKm,
      } as any);

      // Recalculate currency for qualification
      if (qualification) {
        const driveLogs = await storage.getDriveLogsByUserAndVehicle(driveLog.userId, driveLog.vehicleType);
        await recalculateCurrencyForQualification(qualification, driveLogs, storage.updateQualification.bind(storage));
      }

      res.status(201).json(driveLog);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create drive log" });
    }
  });

  app.delete("/api/drive-logs/:id", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const driveLog = await storage.getDriveLog(req.params.id);
      
      if (!driveLog) {
        return res.status(404).json({ message: "Drive log not found" });
      }

      if (user.role !== "admin" && driveLog.userId !== user.id) {
        return res.status(403).json({ message: "You can only delete your own drive logs" });
      }

      const success = await storage.deleteDriveLog(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Drive log not found" });
      }

      const qualification = await storage.getUserQualificationForVehicle(driveLog.userId, driveLog.vehicleType);
      if (qualification) {
        const driveLogs = await storage.getDriveLogsByUserAndVehicle(driveLog.userId, driveLog.vehicleType);
        await recalculateCurrencyForQualification(qualification, driveLogs, storage.updateQualification.bind(storage));
      }

      res.json({ message: "Drive log deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete drive log" });
    }
  });

  // Currency Drive QR endpoints
  app.post("/api/currency-drives", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertCurrencyDriveSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ message: `Validation error: ${errors}` });
      }
      
      const { vehicleType, date } = parsed.data;
      // Parse dates as local dates to avoid timezone issues
      const driveDate = new Date(date);
      const localDriveDate = new Date(driveDate.getFullYear(), driveDate.getMonth(), driveDate.getDate());
      // Auto-set expiry to end of the drive date (midnight)
      const localExpireDate = new Date(localDriveDate);
      localExpireDate.setHours(23, 59, 59, 999);
      
      const drive = await storage.createCurrencyDrive({
        vehicleType,
        date: localDriveDate,
        expiresAt: localExpireDate,
        createdBy: req.user.id,
      } as any);
      res.status(201).json(drive);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create QR code" });
    }
  });

  app.get("/api/currency-drives", requireAuth, async (req: any, res) => {
    try {
      // Clean up expired QR codes and their scan logs automatically
      await storage.deleteExpiredCurrencyDrives();
      
      const drives = await storage.getAllCurrencyDrives();
      const active = drives.filter(d => isAfter(new Date(d.expiresAt), new Date()));
      res.json(active);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/currency-drives/scan", requireAuth, async (req: any, res) => {
    try {
      const { code, vehicleNo } = req.body;
      const user = req.user as User;
      
      if (!code) {
        return res.status(400).json({ message: "QR code required" });
      }

      if (!vehicleNo || !/^\d{5}$/.test(vehicleNo)) {
        return res.status(400).json({ message: "Vehicle number must be exactly 5 digits" });
      }

      const drive = await storage.getCurrencyDriveByCode(code);
      if (!drive) {
        return res.status(404).json({ message: "Invalid QR code" });
      }

      if (!isAfter(new Date(drive.expiresAt), new Date())) {
        return res.status(410).json({ message: "QR code has expired" });
      }

      // Check if user already scanned this QR code
      const alreadyScanned = await storage.hasUserScannedDrive(user.id, drive.id);
      if (alreadyScanned) {
        return res.status(409).json({ message: "You have already scanned this QR code" });
      }

      // Check if qualification is expired
      const qualification = await storage.getUserQualificationForVehicle(user.id, drive.vehicleType);
      let isExpired = false;
      if (qualification) {
        isExpired = isQualificationExpired(qualification);
        
        console.log('DEBUG - Qualification check:', {
          userId: user.id,
          vehicleType: drive.vehicleType,
          baseDate: qualification.lastDriveDate || qualification.qualifiedOnDate,
          computedExpiry: getComputedExpiry(qualification),
          storedExpiry: qualification.currencyExpiryDate,
          now: new Date(),
          isExpired
        });
      }
      if (qualification && isExpired) {
        return res.status(410).json({ message: `Currency for ${drive.vehicleType} has expired. Cannot scan for this vehicle.` });
      }
      // Parse the date as local date to avoid timezone issues
      const driveDate = new Date(drive.date);
      const localDate = new Date(driveDate.getFullYear(), driveDate.getMonth(), driveDate.getDate());
      
      const driveLog = await storage.createDriveLog({
        userId: user.id,
        vehicleType: drive.vehicleType,
        date: localDate, // Use local date (when drive was supposed to happen)
        distanceKm: 2,
        isFromQRScan: "true",
        vehicleNo: vehicleNo,
        remarks: `Currency drive via QR code scan - Vehicle ${vehicleNo}`,
      } as any);

      // Record the scan
      await storage.recordDriveScan(user.id, drive.id);

      // Update scan count to match actual count in database
      const actualScanCount = await storage.getScanCountByDrive(drive.id);
      await storage.updateCurrencyDrive(drive.id, { scans: actualScanCount });

      // Recalculate currency for qualification
      if (qualification) {
        const driveLogs = await storage.getDriveLogsByUserAndVehicle(user.id, drive.vehicleType);
        await recalculateCurrencyForQualification(qualification, driveLogs, storage.updateQualification.bind(storage));
      }

      res.json({ vehicleType: drive.vehicleType, driveId: driveLog.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/currency-drives/:id/scans", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const scans = await storage.getScanDetailsByDrive(req.params.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/currency-drives/:id", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const drive = await storage.getCurrencyDrive(req.params.id);
      if (!drive) {
        return res.status(404).json({ message: "QR code not found" });
      }
      
      await storage.updateCurrencyDrive(drive.id, { expiresAt: new Date() } as any);
      res.json({ message: "QR code deactivated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
