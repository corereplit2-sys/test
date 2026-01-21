import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getEvents, createEvent, updateEvent, deleteEvent, type Event } from "./api-events";
import session from "express-session";
import * as bcrypt from "bcryptjs";
import multer from "multer";
import {
  loginSchema,
  changePasswordSchema,
  insertUserSchema,
  updateUserSchema,
  insertBookingSchema,
  insertDriverQualificationSchema,
  insertDriveLogSchema,
  insertCurrencyDriveSchema,
  type User,
  type SafeUser,
  type Booking,
  type BookingWithUser,
  type DashboardStats,
  type BookableWeekRange,
  type DriverQualification,
  type DriveLog,
  type QualificationWithStatus,
  type CurrencyDrive,
} from "@shared/schema";
import {
  differenceInHours,
  differenceInMinutes,
  startOfDay,
  endOfDay,
  addDays,
  parseISO,
  isAfter,
  format,
  differenceInDays,
} from "date-fns";
import { getCurrentBookableWeek, DEFAULT_BOOKING_RELEASE_DAY } from "./utils/bookingSchedule";
import {
  calculateCurrency,
  getCurrencyStatus,
  recalculateCurrencyForQualification,
} from "./utils/currencyCalculator";
import { toZonedTime } from "date-fns-tz";
import { eq } from "drizzle-orm";
import {
  users,
  bookings,
  driveLogs,
  driverQualifications,
  currencyDrives,
  currencyDriveScans,
  Msp,
  config,
  onboardingRequests,
} from "@shared/schema";
import * as schema from "@shared/schema";
import {
  InsertDriveLog,
  InsertDriverQualification,
  InsertCurrencyDrive,
  InsertBooking,
} from "@shared/schema";
import { DatabaseStorage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

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
      let msp = existingMsps.find((m) => m.name === name);
      if (!msp) {
        msp = await storage.createMsp({ name });
      }
      createdMsps[name] = msp;
    }

    const existingAdmin = await storage.getUserByUsername("admin");
    if (existingAdmin) return; // Already seeded

    const mspHQ = createdMsps["HQ"];
    const msp1 = createdMsps["MSP 1"];
    const msp2 = createdMsps["MSP 2"];
    const msp3 = createdMsps["MSP 3"];

    // Create sample soldiers with different ranks
    const soldierPassword = await bcrypt.hash("password123", 10);
    const soldier1 = await storage.createUser({
      username: "soldier1",
      fullName: "John Smith",
      role: getRoleFromRank("3SG"),
      password: "password123",
      rank: "3SG",
      mspId: msp1.id,
      dob: "1995-05-15",
      doe: "2015-05-15",
    });

    const soldier2 = await storage.createUser({
      username: "soldier2",
      fullName: "Sarah Johnson",
      role: getRoleFromRank("2SG"),
      password: "password123",
      rank: "2SG",
      mspId: msp2.id,
      dob: "1993-08-22",
      doe: "2013-08-22",
    });

    const soldier3 = await storage.createUser({
      username: "soldier3",
      fullName: "Mike Davis",
      role: getRoleFromRank("LCP"),
      password: "password123",
      rank: "LCP",
      mspId: msp3.id,
      dob: "1998-11-30",
      doe: "2018-11-30",
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
  const sanitizeUser = (user: any): SafeUser => {
    const { passwordHash, ...safeUser } = user;
    // Ensure DOE and DOB are returned as proper date strings
    return {
      ...safeUser,
      doe: user.doe ? new Date(user.doe).toISOString().split("T")[0] : undefined,
      dob: user.dob ? new Date(user.dob).toISOString().split("T")[0] : undefined,
    };
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
        const activeBookings = allBookings.filter((b) => b.status === "active");

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
            title: `${bookings.length} booking${bookings.length > 1 ? "s" : ""}`,
            start: booking.startTime,
            end: booking.endTime,
            bookingCount: bookings.length,
            bookingIds: bookings.map((b) => b.id),
          };
        });

        res.json(events);
      } else {
        // Soldiers see only their own active bookings
        const bookings = await storage.getBookingsByUser(user.id);
        const activeBookings = bookings.filter((b) => b.status === "active");

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
  app.get(
    "/api/bookings/timeslot-details",
    requireAuth,
    requireAdminOrCommander,
    async (req: any, res) => {
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
    }
  );

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
          message:
            "Bookings must be exactly 1 hour (60 minutes). Please select a valid meal time slot.",
        });
      }

      // Check mess room capacity (max 20 people at any given time)
      const MAX_CAPACITY = 20;
      const concurrentBookings = await storage.countConcurrentBookings(startTime, endTime);

      if (concurrentBookings >= MAX_CAPACITY) {
        return res.status(400).json({
          message: `This time slot is full (${MAX_CAPACITY}/${MAX_CAPACITY} capacity). Please choose another time.`,
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
            message: `Insufficient credits. Need ${creditsNeeded}, have ${user.credits}`,
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
      if (
        booking.userId !== req.user.id &&
        req.user.role !== "admin" &&
        req.user.role !== "commander"
      ) {
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
      const soldiers = allUsers.filter((u) => u.role === "soldier");
      const allBookings = await storage.getAllBookings();

      const today = new Date();
      const activeBookingsToday = allBookings.filter((b) => {
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
      console.log("=== USER CREATION DEBUG ===");
      console.log("Request body:", req.body);

      const userData = insertUserSchema.parse(req.body);
      console.log("Parsed userData:", userData);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 10);

      const user = await storage.createUser({
        ...userData,
      });

      res.json(sanitizeUser(user));
    } catch (error: any) {
      console.log("User creation error:", error);
      res.status(400).json({ message: error.message || "Failed to create user" });
    }
  });

  app.put("/api/admin/users/:id", requireAuth, requireAdminOrCommander, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Handle credits update separately for commanders
      if (req.body.credits !== undefined && Object.keys(req.body).length === 1) {
        const credits = req.body.credits;
        const updatedUser = await storage.updateUser(req.params.id, { credits });
        return res.json(sanitizeUser(updatedUser!));
      }

      // For other updates, validate against schema
      const userData = updateUserSchema.parse(req.body);
      console.log("=== SERVER UPDATE DEBUG ===");
      console.log("Parsed userData:", userData);

      // Check if username is being changed and if it's already taken
      if (userData.username && userData.username !== user.username) {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }

      const updates: any = { ...userData };
      console.log("Updates to storage:", updates);

      // Hash new password if provided
      if (userData.password) {
        updates.passwordHash = await bcrypt.hash(userData.password, 10);
        delete updates.password;
      }

      // Ensure DOE is properly handled
      if (userData.doe) {
        updates.doe = new Date(userData.doe);
      }

      // Ensure DOB is properly handled
      if (userData.dob) {
        updates.dob = new Date(userData.dob);
      }

      console.log("Final updates:", updates);

      const updatedUser = await storage.updateUser(req.params.id, updates);
      console.log("Updated user from storage:", updatedUser);
      console.log("Sanitized user:", sanitizeUser(updatedUser!));

      res.json(sanitizeUser(updatedUser!));
    } catch (error: any) {
      console.log("Update error:", error);
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

      const lines = data
        .trim()
        .split("\n")
        .filter((line: string) => line.trim());
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
        const parts = line.split("\t").map((p: string) => p.trim());

        if (parts.length < 4) {
          results.failed.push({
            line,
            reason:
              "Invalid format - expected 4 tab-separated fields (Username, Full Name, Rank, MSP)",
          });
          continue;
        }

        const [username, fullName, rank, mspName] = parts;

        // Validate username format (lowercase, no spaces)
        if (!/^[a-z0-9_]+$/.test(username)) {
          results.failed.push({
            line,
            reason: "Username must be lowercase letters, numbers, and underscores only",
          });
          continue;
        }

        // Check if user already exists
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
          results.failed.push({ line, reason: `Username already exists: ${username}` });
          continue;
        }

        // Find MSP
        const msp = allMsps.find((m) => m.name.toUpperCase() === mspName.toUpperCase());
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
            rank: rank || "",
            mspId: msp.id,
            role,
            password: defaultPassword,
            dob: "1990-01-01", // Default DOB for imported users
            doe: "2010-01-01", // Default DOE for imported users
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
      const releaseDay = releaseDayConfig
        ? parseInt(releaseDayConfig.value)
        : DEFAULT_BOOKING_RELEASE_DAY;

      // Use Singapore timezone for consistent week calculation
      const singaporeTime = toZonedTime(new Date(), "Asia/Singapore");
      const { start } = getCurrentBookableWeek(releaseDay, singaporeTime);
      const currentWeekStart = start.toISOString().split("T")[0]; // YYYY-MM-DD

      const lastResetConfig = await storage.getConfig("lastCreditResetWeek");
      const lastResetWeek = lastResetConfig?.value;

      // If this is a new week, reset all soldier credits
      if (!lastResetWeek || lastResetWeek !== currentWeekStart) {
        const defaultCreditsConfig = await storage.getConfig("defaultWeeklyCredits");
        const defaultCredits = defaultCreditsConfig ? parseFloat(defaultCreditsConfig.value) : 10;

        // Reset all soldier accounts
        const allUsers = await storage.getAllUsers();
        const soldiers = allUsers.filter((u) => u.role === "soldier");

        for (const soldier of soldiers) {
          await storage.updateUser(soldier.id, { credits: defaultCredits });
        }

        // Update last reset week
        await storage.setConfig("lastCreditResetWeek", currentWeekStart);

        console.log(
          `[AUTO RESET] Credits reset for ${soldiers.length} soldiers to ${defaultCredits} credits for week ${currentWeekStart} (SG timezone)`
        );
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
      const releaseDay = releaseDayConfig
        ? parseInt(releaseDayConfig.value)
        : DEFAULT_BOOKING_RELEASE_DAY;

      // Use Singapore timezone for consistent week calculation
      const singaporeTime = toZonedTime(new Date(), "Asia/Singapore");
      const { start, end } = getCurrentBookableWeek(releaseDay, singaporeTime);

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
        return res
          .status(400)
          .json({ message: "Release day must be between 0 (Sunday) and 6 (Saturday)" });
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

  app.get("/api/public/msps", async (req, res) => {
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
        return res
          .status(400)
          .json({ message: "Invalid qualification data", errors: parsed.error.errors });
      }

      const qualifiedDate =
        parsed.data.qualifiedOnDate instanceof Date
          ? parsed.data.qualifiedOnDate
          : new Date(parsed.data.qualifiedOnDate);
      const currencyExpiryDate = addDays(qualifiedDate, 88);

      const qualification = await storage.createQualification({
        ...parsed.data,
        currencyExpiryDate: currencyExpiryDate.toISOString().split("T")[0],
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
        return res
          .status(400)
          .json({ message: "Invalid qualification data", errors: parsed.error.errors });
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
        updatedQualification.vehicleType
      );

      let finalQualification = await recalculateCurrencyForQualification(
        updatedQualification,
        driveLogsForQual,
        storage.updateQualification.bind(storage)
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

      const lines = data
        .trim()
        .split("\n")
        .filter((line: string) => line.trim());
      const allUsers = await storage.getAllUsers();

      const results = {
        success: [] as any[],
        failed: [] as any[],
      };

      for (const line of lines) {
        const parts = line.split("\t").map((p: string) => p.trim());

        if (parts.length < 3) {
          results.failed.push({ line, reason: "Invalid format - expected 3 tab-separated fields" });
          continue;
        }

        const [fullName, vehicleTypeRaw, dateStr] = parts;
        const vehicleType = vehicleTypeRaw.toUpperCase();

        // Validate vehicle type
        if (vehicleType !== "TERREX" && vehicleType !== "BELREX") {
          results.failed.push({
            line,
            reason: `Invalid vehicle type: ${vehicleTypeRaw}. Must be TERREX or BELREX`,
          });
          continue;
        }

        // Parse date from M/D/YYYY format
        const dateParts = dateStr.split("/");
        if (dateParts.length !== 3) {
          results.failed.push({
            line,
            reason: `Invalid date format: ${dateStr}. Expected M/D/YYYY`,
          });
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
        const user = allUsers.find((u) => u.fullName.toUpperCase() === fullName.toUpperCase());

        if (!user) {
          results.failed.push({ line, reason: `User not found: ${fullName}` });
          continue;
        }

        // Check if qualification already exists
        const existingQuals = await storage.getQualificationsByUser(user.id);
        const alreadyExists = existingQuals.some((q) => q.vehicleType === vehicleType);

        if (alreadyExists) {
          results.failed.push({
            line,
            reason: `${user.fullName} already has ${vehicleType} qualification`,
          });
          continue;
        }

        // Create qualification
        try {
          const currencyExpiryDate = addDays(qualifiedDate, 88);
          const qualification = await storage.createQualification({
            userId: user.id,
            vehicleType: vehicleType as "TERREX" | "BELREX",
            qualifiedOnDate: qualifiedDate,
            currencyExpiryDate: currencyExpiryDate.toISOString().split("T")[0],
          } as any);

          results.success.push({
            user: user.fullName,
            vehicleType,
            qualifiedDate: qualifiedDate.toISOString().split("T")[0],
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
        return res
          .status(400)
          .json({ message: "Invalid drive log data", errors: parsed.error.errors });
      }

      // Check if qualification is expired
      const userId =
        user.role === "admin" || user.role === "commander" ? parsed.data.userId : user.id;
      const qualification = await storage.getUserQualificationForVehicle(
        userId,
        parsed.data.vehicleType as "TERREX" | "BELREX"
      );
      if (qualification && isQualificationExpired(qualification)) {
        return res
          .status(410)
          .json({
            message: `Currency for ${parsed.data.vehicleType} has expired. Cannot log drives.`,
          });
      }

      const distanceKm = (parsed.data.finalMileageKm || 0) - (parsed.data.initialMileageKm || 0);

      const driveLog = await storage.createDriveLog({
        ...parsed.data,
        userId,
        distanceKm,
      } as any);

      // Recalculate currency for qualification
      if (qualification) {
        const driveLogs = await storage.getDriveLogsByUserAndVehicle(
          driveLog.userId,
          driveLog.vehicleType
        );
        await recalculateCurrencyForQualification(
          qualification,
          driveLogs,
          storage.updateQualification.bind(storage)
        );
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

      const qualification = await storage.getUserQualificationForVehicle(
        driveLog.userId,
        driveLog.vehicleType
      );
      if (qualification) {
        const driveLogs = await storage.getDriveLogsByUserAndVehicle(
          driveLog.userId,
          driveLog.vehicleType
        );
        await recalculateCurrencyForQualification(
          qualification,
          driveLogs,
          storage.updateQualification.bind(storage)
        );
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
        const errors = parsed.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        return res.status(400).json({ message: `Validation error: ${errors}` });
      }

      const { vehicleType, date } = parsed.data;
      // Parse dates as local dates to avoid timezone issues
      const driveDate = new Date(date);
      const localDriveDate = new Date(
        driveDate.getFullYear(),
        driveDate.getMonth(),
        driveDate.getDate()
      );
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
      const active = drives.filter((d) => isAfter(new Date(d.expiresAt), new Date()));
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
      const qualification = await storage.getUserQualificationForVehicle(
        user.id,
        drive.vehicleType
      );
      let isExpired = false;
      if (qualification) {
        isExpired = isQualificationExpired(qualification);

        console.log("DEBUG - Qualification check:", {
          userId: user.id,
          vehicleType: drive.vehicleType,
          baseDate: qualification.lastDriveDate || qualification.qualifiedOnDate,
          computedExpiry: getComputedExpiry(qualification),
          storedExpiry: qualification.currencyExpiryDate,
          now: new Date(),
          isExpired,
        });
      }
      if (qualification && isExpired) {
        return res
          .status(410)
          .json({
            message: `Currency for ${drive.vehicleType} has expired. Cannot scan for this vehicle.`,
          });
      }
      // Parse the date as local date to avoid timezone issues
      const driveDate = new Date(drive.date);
      const localDate = new Date(
        driveDate.getFullYear(),
        driveDate.getMonth(),
        driveDate.getDate()
      );

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
        await recalculateCurrencyForQualification(
          qualification,
          driveLogs,
          storage.updateQualification.bind(storage)
        );
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

  // Onboarding routes
  app.post("/api/auth/onboarding", async (req, res) => {
    try {
      const { fullName, username, rank, dob, doe, mspId, password } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if there's already a pending onboarding request
      const existingRequest = await storage.getOnboardingRequestByUsername(username);
      if (existingRequest) {
        return res.status(400).json({ message: "Onboarding request already submitted" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create onboarding request
      await storage.createOnboardingRequest({
        id: randomUUID(),
        fullName,
        username,
        rank,
        dob,
        doe,
        mspId,
        passwordHash,
      });

      res.json({ message: "Onboarding request submitted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to submit onboarding request" });
    }
  });

  app.get("/api/admin/onboarding-requests", async (req: any, res) => {
    try {
      const requests = await storage.getAllOnboardingRequests();
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch onboarding requests" });
    }
  });

  app.post("/api/admin/onboarding-requests/:id/approve", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { accountType } = req.body;

      const request = await storage.getOnboardingRequestById(id);
      if (!request) {
        return res.status(404).json({ message: "Onboarding request not found" });
      }

      // Create user from onboarding request
      const user = await storage.createUserWithHashedPassword({
        fullName: request.fullName,
        username: request.username,
        passwordHash: request.passwordHash,
        rank: request.rank,
        mspId: request.mspId,
        role: accountType || "soldier",
        credits: 0,
        password: "dummy", // This will be ignored, we use passwordHash
      } as any);

      // Update request status
      await storage.updateOnboardingRequestStatus(id, "approved");

      res.json({ message: "Request approved successfully", user: sanitizeUser(user) });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to approve request" });
    }
  });

  app.post("/api/admin/onboarding-requests/:id/reject", async (req: any, res) => {
    try {
      const { id } = req.params;

      const request = await storage.getOnboardingRequestById(id);
      if (!request) {
        return res.status(404).json({ message: "Onboarding request not found" });
      }

      // Update request status
      await storage.updateOnboardingRequestStatus(id, "rejected");

      res.json({ message: "Request rejected successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reject request" });
    }
  });

  // IPPT Routes
  // Get all users for IPPT scanner name matching
  app.get("/api/users", async (req, res) => {
    try {
      const { pool } = await import("./db");
      const result = await pool.query(`
        SELECT 
          u.id, u.username, u.full_name, u.rank, u.msp_id, u.dob, u.doe, u.role,
          m.name as msp_name
        FROM users u
        LEFT JOIN msps m ON u.msp_id = m.id
        ORDER BY u.full_name
      `);

      const users = result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        rank: row.rank,
        mspId: row.msp_id,
        mspName: row.msp_name,
        dob: row.dob,
        doe: row.doe,
        role: row.role,
      }));

      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/ippt/commander-stats", async (req, res) => {
    try {
      // Query users with their IPPT data
      const { pool } = await import("./db");
      const result = await pool.query(`
        SELECT 
          u.id, u.username, u.full_name, u.rank, u.msp_id,
          m.name as msp_name,
          COUNT(ia.id) as total_attempts,
          COUNT(CASE WHEN ia.result = 'Gold' THEN 1 END) as gold_count,
          COUNT(CASE WHEN ia.result = 'Silver' THEN 1 END) as silver_count,
          COUNT(CASE WHEN ia.result = 'Pass' THEN 1 END) as pass_count,
          COUNT(CASE WHEN ia.result = 'Fail' THEN 1 END) as fail_count
        FROM users u
        LEFT JOIN msps m ON u.msp_id = m.id
        LEFT JOIN ippt_attempts ia ON u.id = ia.user_id
        GROUP BY u.id, u.username, u.full_name, u.rank, u.msp_id, m.name
        ORDER BY u.full_name
      `);

      const troopers = result.rows.map((row) => ({
        user: {
          id: row.id,
          username: row.username,
          fullName: row.full_name,
          rank: row.rank,
          mspId: row.msp_id,
          mspName: row.msp_name,
        },
        stats: {
          totalAttempts: parseInt(row.total_attempts),
          goldCount: parseInt(row.gold_count),
          silverCount: parseInt(row.silver_count),
          passCount: parseInt(row.pass_count),
          failCount: parseInt(row.fail_count),
        },
      }));

      // Get session stats
      const sessionResult = await pool.query("SELECT COUNT(*) as total FROM ippt_sessions");
      const attemptResult = await pool.query("SELECT COUNT(*) as total FROM ippt_attempts");
      const passResult = await pool.query(
        "SELECT COUNT(*) as total FROM ippt_attempts WHERE result IN ('Gold', 'Silver', 'Pass')"
      );

      const totalSessions = parseInt(sessionResult.rows[0].total);
      const totalParticipants = parseInt(attemptResult.rows[0].total);
      const passRate =
        totalParticipants > 0 ? (parseInt(passResult.rows[0].total) / totalParticipants) * 100 : 0;

      res.json({
        totalSessions,
        totalParticipants,
        passRate: Math.round(passRate * 100) / 100,
        troopers,
      });
    } catch (error) {
      console.error("Error fetching commander stats:", error);
      res.status(500).json({ error: "Failed to fetch commander stats" });
    }
  });

  app.get("/api/ippt/sessions", async (req, res) => {
    try {
      // Query actual IPPT sessions from database
      const { pool } = await import("./db");
      const result = await pool.query(`
        SELECT id, name, date 
        FROM ippt_sessions 
        ORDER BY date DESC
      `);

      const sessions = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        date: row.date,
      }));

      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/ippt/sessions/:id/details", async (req, res) => {
    try {
      const sessionId = req.params.id;

      // Query IPPT attempts with user data
      const { pool } = await import("./db");
      const result = await pool.query(
        `
        SELECT 
          ia.id, ia.user_id, ia.session_id, ia.ippt_date, ia.age_as_of_ippt,
          ia.situp_reps, ia.situp_score, ia.pushup_reps, ia.pushup_score,
          ia.run_time, ia.run_score, ia.total_score, ia.result, ia.created_at,
          u.id as user_id, u.username, u.full_name, u.rank, u.msp_id,
          m.name as msp_name
        FROM ippt_attempts ia
        LEFT JOIN users u ON ia.user_id = u.id
        LEFT JOIN msps m ON u.msp_id = m.id
        WHERE ia.session_id = $1
        ORDER BY ia.created_at DESC
      `,
        [sessionId]
      );

      const attempts = result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        ipptDate: row.ippt_date,
        ageAsOfIppt: row.age_as_of_ippt,
        situpReps: row.situp_reps,
        situpScore: row.situp_score,
        pushupReps: row.pushup_reps,
        pushupScore: row.pushup_score,
        runTime: row.run_time,
        runScore: row.run_score,
        totalScore: row.total_score,
        result: row.result,
        createdAt: row.created_at,
        user: row.user_id
          ? {
              id: row.user_id,
              username: row.username,
              fullName: row.full_name,
              rank: row.rank,
              mspId: row.msp_id,
              mspName: row.msp_name,
            }
          : null,
      }));

      res.json({ id: sessionId, attempts });
    } catch (error) {
      console.error("Error fetching session details:", error);
      res.status(500).json({ error: "Failed to fetch session details" });
    }
  });

  app.get("/api/ippt/scoring/:ageGroup", async (req, res) => {
    try {
      const ageGroup = req.params.ageGroup;

      // Query the actual scoring table from database
      const { pool } = await import("./db");
      const result = await pool.query(
        "SELECT situps_scoring, pushups_scoring, run_scoring FROM ippt_scoring_compact WHERE age_group = $1",
        [ageGroup]
      );

      if (result.rows.length === 0) {
        console.log(`No scoring data found for age group: ${ageGroup}`);
        return res.status(404).json({ error: `No scoring data for age group ${ageGroup}` });
      }

      const scoringData = result.rows[0];
      console.log(`Returning scoring data for age group ${ageGroup}:`, {
        situpsCount: scoringData.situps_scoring.length,
        pushupsCount: scoringData.pushups_scoring.length,
        runCount: scoringData.run_scoring.length,
      });

      res.json(scoringData);
    } catch (error) {
      console.error("Error fetching scoring data:", error);
      res.status(500).json({ error: "Failed to fetch scoring data" });
    }
  });

  // Get all IPPT attempts - simple version
  app.get("/api/ippt/attempts", async (req, res) => {
    try {
      console.log("=== IPPT Attempts API Called ===");
      const { pool } = await import("./db");

      // Simple query - get all attempts with session name
      const result = await pool.query(`
        SELECT 
          ia.id,
          ia.user_id,
          ia.session_id,
          s.name as session_name,
          ia.ippt_date,
          ia.age_as_of_ippt,
          ia.situp_reps,
          ia.situp_score,
          ia.pushup_reps,
          ia.pushup_score,
          ia.run_time,
          ia.run_score,
          ia.total_score,
          ia.result,
          ia.created_at
        FROM ippt_attempts ia
        LEFT JOIN ippt_sessions s ON ia.session_id = s.id
        ORDER BY ia.ippt_date DESC
      `);

      console.log(`Found ${result.rows.length} attempts`);

      // Transform column names to match frontend
      const transformedAttempts = result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        sessionName: row.session_name,
        ipptDate: row.ippt_date,
        ageAsOfIppt: row.age_as_of_ippt,
        situpReps: row.situp_reps,
        situpScore: row.situp_score,
        pushupReps: row.pushup_reps,
        pushupScore: row.pushup_score,
        runTime: row.run_time,
        runScore: row.run_score,
        totalScore: row.total_score,
        result: row.result,
        createdAt: row.created_at,
      }));

      console.log("Sending attempts to frontend");
      res.json(transformedAttempts);
    } catch (error) {
      console.error("Error fetching IPPT attempts:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ error: "Failed to fetch IPPT attempts", details: errorMessage });
    }
  });

  // Get user eligibility data
  app.get("/api/user-eligibility", async (req, res) => {
    try {
      console.log("=== User Eligibility API Called ===");
      const { pool } = await import("./db");

      const result = await pool.query(`
        SELECT 
          id,
          user_id,
          is_eligible,
          reason,
          ineligibility_type,
          until_date,
          created_at,
          updated_at
        FROM user_eligibility
        ORDER BY user_id
      `);

      console.log(`Found ${result.rows.length} eligibility records`);

      // Transform column names to match frontend
      const transformedEligibility = result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        isEligible: row.is_eligible === "true",
        reason: row.reason,
        ineligibilityType: row.ineligibility_type,
        untilDate: row.until_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      console.log("Sending eligibility data to frontend");
      res.json(transformedEligibility);
    } catch (error) {
      console.error("Error fetching user eligibility:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ error: "Failed to fetch user eligibility", details: errorMessage });
    }
  });

  // Azure OCR endpoint for IPPT scanning
  app.post("/api/azure-ocr", upload.single("image"), async (req: any, res) => {
    try {
      console.log("=== Azure OCR Request Started ===");
      console.log("Request body:", req.body);
      console.log("Request file:", req.file ? req.file.originalname : "No file");

      if (!req.file) {
        console.log("ERROR: No file provided");
        return res.status(400).json({ error: "No image file provided" });
      }

      const AZURE_ENDPOINT =
        process.env.AZURE_ENDPOINT || "https://ipptocr.cognitiveservices.azure.com/";
      const AZURE_API_KEY = process.env.AZURE_API_KEY;

      console.log("Azure endpoint:", AZURE_ENDPOINT);
      console.log("Azure API key configured:", !!AZURE_API_KEY);

      if (!AZURE_API_KEY) {
        console.log("ERROR: Azure API key not configured");
        return res.status(500).json({ error: "Azure API key not configured" });
      }

      console.log("Importing Azure SDK...");
      const { DocumentAnalysisClient, AzureKeyCredential } =
        await import("@azure/ai-form-recognizer");

      console.log("Creating Azure client...");
      const client = new DocumentAnalysisClient(
        AZURE_ENDPOINT,
        new AzureKeyCredential(AZURE_API_KEY)
      );

      const poller = await client.beginAnalyzeDocument("prebuilt-document", req.file.buffer);

      const result = await poller.pollUntilDone();

      res.json({
        success: true,
        result: {
          content: result.content,
          tables: result.tables,
          pages: result.pages,
        },
      });
    } catch (error) {
      console.error("Azure OCR Error:", error);
      res.status(500).json({
        error: "Azure OCR processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Create IPPT session (conduct)
  app.post("/api/ippt/sessions", async (req, res) => {
    try {
      const { name, date, participants } = req.body;

      if (!name || !date || !participants || participants.length === 0) {
        return res.status(400).json({ error: "Missing required fields: name, date, participants" });
      }

      const { pool } = await import("./db");
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Create IPPT session
        const sessionResult = await client.query(
          "INSERT INTO ippt_sessions (id, name, date) VALUES ($1, $2, $3) RETURNING *",
          [crypto.randomUUID(), name, date]
        );

        const sessionId = sessionResult.rows[0].id;

        // Create IPPT attempts for each participant
        for (const participant of participants) {
          // Find user by name if userId not provided
          let userId = participant.userId;
          if (!userId && participant.name) {
            const userResult = await client.query(
              "SELECT id FROM users WHERE full_name = $1 LIMIT 1",
              [participant.name]
            );
            if (userResult.rows.length > 0) {
              userId = userResult.rows[0].id;
            }
          }

          await client.query(
            `INSERT INTO ippt_attempts 
             (id, user_id, session_id, ippt_date, age_as_of_ippt, situp_reps, situp_score, 
              pushup_reps, pushup_score, run_time, run_score, total_score, result)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              crypto.randomUUID(),
              userId || null,
              sessionId,
              date,
              25, // default age
              participant.situpReps || 0,
              participant.situpScore || 0,
              participant.pushupReps || 0,
              participant.pushupScore || 0,
              participant.runTime || "00:00",
              participant.runScore || 0,
              participant.totalScore || 0,
              participant.result || "Fail",
            ]
          );
        }

        await client.query("COMMIT");

        res.json({
          success: true,
          sessionId: sessionId,
          message: "IPPT session created successfully",
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error("Error creating IPPT session:", error);
      res.status(500).json({ error: error.message || "Failed to create IPPT session" });
    }
  });

  // Events API routes
  app.get("/api/events", getEvents);
  app.post("/api/events", createEvent);
  app.put("/api/events/:id", updateEvent);
  app.delete("/api/events/:id", deleteEvent);

  const httpServer = createServer(app);
  return httpServer;
}
