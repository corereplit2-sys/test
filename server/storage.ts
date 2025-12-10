import { 
  type User, type InsertUser, type Booking, type InsertBooking, type Config,
  type Msp, type InsertMsp, type DriverQualification, type InsertDriverQualification, 
  type DriveLog, type InsertDriveLog, type CurrencyDrive, type InsertCurrencyDrive, type CurrencyDriveScan,
  type IpptAttempt, type IpptSession, type IpptCommanderStats, type TrooperIpptSummary, type SafeUser, type UserEligibility,
  users, bookings, config, msps, driverQualifications, driveLogs, currencyDrives, currencyDriveScans,
  ipptAttempts, ipptSessions, ipptScoringCompact, userEligibility
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, lte, gte, lt, gt, ne, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // MSP operations
  getAllMsps(): Promise<Msp[]>;
  getMsp(id: string): Promise<Msp | undefined>;
  createMsp(msp: InsertMsp): Promise<Msp>;
  
  // Booking operations
  getBooking(id: string): Promise<Booking | undefined>;
  getAllBookings(): Promise<Booking[]>;
  getBookingsByUser(userId: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, updates: Partial<Booking>): Promise<Booking | undefined>;
  checkBookingOverlap(startTime: Date, endTime: Date, excludeBookingId?: string): Promise<boolean>;
  countConcurrentBookings(startTime: Date, endTime: Date, excludeBookingId?: string): Promise<number>;
  
  // Driver Qualification operations
  getQualification(id: string): Promise<DriverQualification | undefined>;
  getQualificationsByUser(userId: string): Promise<DriverQualification[]>;
  getUserQualificationForVehicle(userId: string, vehicleType: "TERREX" | "BELREX"): Promise<DriverQualification | undefined>;
  getAllQualifications(): Promise<DriverQualification[]>;
  createQualification(qualification: InsertDriverQualification): Promise<DriverQualification>;
  updateQualification(id: string, updates: Partial<DriverQualification>): Promise<DriverQualification | undefined>;
  deleteQualification(id: string): Promise<boolean>;
  
  // Drive Log operations
  getDriveLog(id: string): Promise<DriveLog | undefined>;
  getDriveLogsByUser(userId: string): Promise<DriveLog[]>;
  getDriveLogsByUserAndVehicle(userId: string, vehicleType: "TERREX" | "BELREX"): Promise<DriveLog[]>;
  getAllDriveLogs(): Promise<DriveLog[]>;
  createDriveLog(driveLog: InsertDriveLog): Promise<DriveLog>;
  updateDriveLog(id: string, updates: Partial<DriveLog>): Promise<DriveLog | undefined>;
  deleteDriveLog(id: string): Promise<boolean>;
  
  // Config operations
  getConfig(key: string): Promise<Config | undefined>;
  setConfig(key: string, value: string): Promise<Config>;
  
  // Currency Drive operations
  getCurrencyDrive(id: string): Promise<CurrencyDrive | undefined>;
  getCurrencyDriveByCode(code: string): Promise<CurrencyDrive | undefined>;
  getAllCurrencyDrives(): Promise<CurrencyDrive[]>;
  createCurrencyDrive(drive: InsertCurrencyDrive): Promise<CurrencyDrive>;
  updateCurrencyDrive(id: string, updates: Partial<CurrencyDrive>): Promise<CurrencyDrive | undefined>;
  
  // IPPT operations
  getIpptCommanderStats(user: SafeUser): Promise<IpptCommanderStats>;
  getIpptAttempts(userId: string): Promise<IpptAttempt[]>;
  createIpptAttempt(attempt: any): Promise<IpptAttempt>;
  updateIpptAttempt(id: string, data: any): Promise<void>;
  getIpptAttempt(id: string): Promise<IpptAttempt>;
  getIpptSessions(): Promise<IpptSession[]>;
  createIpptSession(session: any): Promise<IpptSession>;
  importIpptResults(data: any[]): Promise<{ attempts: number; sessions: number }>;
  
  // User Eligibility operations
  getUserEligibility(userId: string): Promise<UserEligibility | undefined>;
  createUserEligibility(eligibility: any): Promise<UserEligibility>;
  updateUserEligibility(userId: string, data: any): Promise<UserEligibility>;
  deleteUserEligibility(userId: string): Promise<void>;
}

// DatabaseStorage uses PostgreSQL via Drizzle ORM - blueprint:javascript_database
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Never store the plain password - only the hash
    const { password, ...userWithoutPassword } = insertUser;
    const [user] = await db
      .insert(users)
      .values(userWithoutPassword as any)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updatePassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Booking operations
  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async getAllBookings(): Promise<Booking[]> {
    return await db.select().from(bookings);
  }

  async getBookingsByUser(userId: string): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.userId, userId));
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values(insertBooking as any)
      .returning();
    return booking;
  }

  async updateBooking(id: string, updates: Partial<Booking>): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set(updates)
      .where(eq(bookings.id, id))
      .returning();
    return booking || undefined;
  }

  async checkBookingOverlap(startTime: Date, endTime: Date, excludeBookingId?: string): Promise<boolean> {
    const conditions = [
      eq(bookings.status, "active"),
      // Overlaps if: booking.start < new.end AND booking.end > new.start
      lt(bookings.startTime, endTime),
      gt(bookings.endTime, startTime)
    ];
    
    if (excludeBookingId) {
      conditions.push(ne(bookings.id, excludeBookingId));
    }

    const overlappingBookings = await db
      .select()
      .from(bookings)
      .where(and(...conditions));
    
    return overlappingBookings.length > 0;
  }

  async countConcurrentBookings(startTime: Date, endTime: Date, excludeBookingId?: string): Promise<number> {
    const conditions = [
      eq(bookings.status, "active"),
      // Overlaps if: booking.start < new.end AND booking.end > new.start
      lt(bookings.startTime, endTime),
      gt(bookings.endTime, startTime)
    ];
    
    if (excludeBookingId) {
      conditions.push(ne(bookings.id, excludeBookingId));
    }

    const overlappingBookings = await db
      .select()
      .from(bookings)
      .where(and(...conditions));
    
    return overlappingBookings.length;
  }

  // MSP operations
  async getAllMsps(): Promise<Msp[]> {
    return await db.select().from(msps);
  }

  async getMsp(id: string): Promise<Msp | undefined> {
    const [msp] = await db.select().from(msps).where(eq(msps.id, id));
    return msp || undefined;
  }

  async createMsp(insertMsp: InsertMsp): Promise<Msp> {
    const [msp] = await db
      .insert(msps)
      .values(insertMsp as any)
      .returning();
    return msp;
  }

  // Driver Qualification operations
  async getQualification(id: string): Promise<DriverQualification | undefined> {
    const [qualification] = await db.select().from(driverQualifications).where(eq(driverQualifications.id, id));
    return qualification || undefined;
  }

  async getQualificationsByUser(userId: string): Promise<DriverQualification[]> {
    return await db.select().from(driverQualifications).where(eq(driverQualifications.userId, userId));
  }

  async getUserQualificationForVehicle(userId: string, vehicleType: "TERREX" | "BELREX"): Promise<DriverQualification | undefined> {
    const [qualification] = await db.select().from(driverQualifications)
      .where(and(eq(driverQualifications.userId, userId), eq(driverQualifications.vehicleType, vehicleType)));
    return qualification || undefined;
  }

  async getAllQualifications(): Promise<DriverQualification[]> {
    return await db.select().from(driverQualifications);
  }

  async createQualification(insertQualification: InsertDriverQualification): Promise<DriverQualification> {
    const [qualification] = await db
      .insert(driverQualifications)
      .values(insertQualification as any)
      .returning();
    return qualification;
  }

  async updateQualification(id: string, updates: Partial<DriverQualification>): Promise<DriverQualification | undefined> {
    const [qualification] = await db
      .update(driverQualifications)
      .set(updates)
      .where(eq(driverQualifications.id, id))
      .returning();
    return qualification || undefined;
  }

  async deleteQualification(id: string): Promise<boolean> {
    const result = await db.delete(driverQualifications).where(eq(driverQualifications.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Drive Log operations
  async getDriveLog(id: string): Promise<DriveLog | undefined> {
    const [driveLog] = await db.select().from(driveLogs).where(eq(driveLogs.id, id));
    return driveLog || undefined;
  }

  async getDriveLogsByUser(userId: string): Promise<DriveLog[]> {
    return await db.select().from(driveLogs).where(eq(driveLogs.userId, userId)).orderBy(desc(driveLogs.date));
  }

  async getDriveLogsByUserAndVehicle(userId: string, vehicleType: "TERREX" | "BELREX"): Promise<DriveLog[]> {
    return await db.select().from(driveLogs)
      .where(and(eq(driveLogs.userId, userId), eq(driveLogs.vehicleType, vehicleType)))
      .orderBy(desc(driveLogs.date));
  }

  async getAllDriveLogs(): Promise<DriveLog[]> {
    return await db.select().from(driveLogs).orderBy(desc(driveLogs.date));
  }

  async createDriveLog(insertDriveLog: InsertDriveLog): Promise<DriveLog> {
    const [driveLog] = await db
      .insert(driveLogs)
      .values(insertDriveLog as any)
      .returning();
    return driveLog;
  }

  async updateDriveLog(id: string, updates: Partial<DriveLog>): Promise<DriveLog | undefined> {
    const [driveLog] = await db
      .update(driveLogs)
      .set(updates)
      .where(eq(driveLogs.id, id))
      .returning();
    return driveLog || undefined;
  }

  async deleteDriveLog(id: string): Promise<boolean> {
    const result = await db.delete(driveLogs).where(eq(driveLogs.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Config operations
  async getConfig(key: string): Promise<Config | undefined> {
    const [cfg] = await db.select().from(config).where(eq(config.key, key));
    return cfg || undefined;
  }

  async setConfig(key: string, value: string): Promise<Config> {
    const existingConfig = await this.getConfig(key);
    if (existingConfig) {
      const [cfg] = await db
        .update(config)
        .set({ value })
        .where(eq(config.key, key))
        .returning();
      return cfg;
    } else {
      const [cfg] = await db
        .insert(config)
        .values({ key, value } as any)
        .returning();
      return cfg;
    }
  }

  // Currency Drive operations
  async getCurrencyDrive(id: string): Promise<CurrencyDrive | undefined> {
    const [drive] = await db.select().from(currencyDrives).where(eq(currencyDrives.id, id));
    return drive || undefined;
  }

  async getCurrencyDriveByCode(code: string): Promise<CurrencyDrive | undefined> {
    const [drive] = await db.select().from(currencyDrives).where(eq(currencyDrives.code, code));
    return drive || undefined;
  }

  async getAllCurrencyDrives(): Promise<CurrencyDrive[]> {
    return await db.select().from(currencyDrives).orderBy(desc(currencyDrives.createdAt));
  }

  async createCurrencyDrive(insertDrive: InsertCurrencyDrive): Promise<CurrencyDrive> {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const [drive] = await db
      .insert(currencyDrives)
      .values({ ...insertDrive, code } as any)
      .returning();
    return drive;
  }

  async updateCurrencyDrive(id: string, updates: Partial<CurrencyDrive>): Promise<CurrencyDrive | undefined> {
    const [drive] = await db
      .update(currencyDrives)
      .set(updates)
      .where(eq(currencyDrives.id, id))
      .returning();
    return drive || undefined;
  }

  // Currency Drive Scan tracking
  async hasUserScannedDrive(userId: string, driveId: string): Promise<boolean> {
    const scan = await db
      .select()
      .from(currencyDriveScans)
      .where(and(eq(currencyDriveScans.userId, userId), eq(currencyDriveScans.driveId, driveId)))
      .limit(1);
    return scan.length > 0;
  }

  async recordDriveScan(userId: string, driveId: string): Promise<void> {
    await db.insert(currencyDriveScans).values({ 
      id: randomUUID(),
      userId, 
      driveId 
    } as any);
  }

  async deleteExpiredCurrencyDrives(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(currencyDrives)
      .where(lt(currencyDrives.expiresAt, now));
    return result.rowCount ?? 0;
  }

  async getScanDetailsByDrive(driveId: string): Promise<Array<{ userId: string; fullName: string; scannedAt: Date }>> {
    const scans = await db
      .select({
        userId: currencyDriveScans.userId,
        fullName: users.fullName,
        scannedAt: currencyDriveScans.scannedAt,
      })
      .from(currencyDriveScans)
      .innerJoin(users, eq(currencyDriveScans.userId, users.id))
      .where(eq(currencyDriveScans.driveId, driveId))
      .orderBy(desc(currencyDriveScans.scannedAt));
    return scans;
  }

  async getScanCountByDrive(driveId: string): Promise<number> {
    const scans = await db
      .select()
      .from(currencyDriveScans)
      .where(eq(currencyDriveScans.driveId, driveId));
    return scans.length;
  }

  // Helper function to calculate IPPT score using compact JSON tables
  async calculateIpptScore(situps: number, pushups: number, runTimeSeconds: number, dob: Date): Promise<{totalScore: number, result: string}> {
    // Calculate age
    const age = Math.floor((new Date().getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    
    // Determine age group
    let ageGroup: string;
    if (age <= 22) ageGroup = "18";
    else if (age <= 27) ageGroup = "25"; 
    else if (age <= 32) ageGroup = "28";
    else if (age <= 37) ageGroup = "33";
    else if (age <= 42) ageGroup = "38";
    else ageGroup = "43";
    
    // Get compact scoring data for this age group
    const scoringData = await db
      .select({
        situpsScoring: ipptScoringCompact.situpsScoring,
        pushupsScoring: ipptScoringCompact.pushupsScoring,
        runScoring: ipptScoringCompact.runScoring
      })
      .from(ipptScoringCompact)
      .where(eq(ipptScoringCompact.ageGroup, ageGroup))
      .limit(1);
    
    if (scoringData.length === 0) {
      // Fallback to 0 points if no scoring data found
      return { totalScore: 0, result: 'Fail' };
    }
    
    const data = scoringData[0];
    
    // Parse JSON arrays and find scores
    const situpsArray = JSON.parse(data.situpsScoring);
    const pushupsArray = JSON.parse(data.pushupsScoring);
    const runArray = JSON.parse(data.runScoring);
    
    // Find sit-up score (find first entry where reps >= target)
    const situpScore = situpsArray.find(([reps]: [number, number]) => reps <= situps)?.[1] || 0;
    
    // Find push-up score (find first entry where reps >= target)
    const pushupScore = pushupsArray.find(([reps]: [number, number]) => reps <= pushups)?.[1] || 0;
    
    // Find run score (find first entry where seconds <= target)
    const runScore = runArray.find(([seconds]: [number, number]) => seconds >= runTimeSeconds)?.[1] || 0;
    
    const totalScore = situpScore + pushupScore + runScore;
    
    // Determine award
    let result = 'Fail';
    if (totalScore >= 85) result = 'Gold';
    else if (totalScore >= 75) result = 'Silver';
    else if (totalScore >= 51) result = 'Pass';
    
    return { totalScore, result };
  }

  // IPPT operations
  async getIpptCommanderStats(user: SafeUser): Promise<IpptCommanderStats> {
    // Get all soldiers (excluding admins) with MSP names
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        passwordHash: users.passwordHash,
        fullName: users.fullName,
        role: users.role,
        credits: users.credits,
        rank: users.rank,
        mspId: users.mspId,
        dob: users.dob,
        doe: users.doe,
        mspName: msps.name
      })
      .from(users)
      .leftJoin(msps, eq(users.mspId, msps.id))
      .where(ne(users.role, "admin"));
    
    const soldiers = allUsers.filter(u => u.role === "soldier" || u.role === "commander");
    
    // Get all IPPT attempts
    const attempts = await db
      .select()
      .from(ipptAttempts)
      .innerJoin(users, eq(ipptAttempts.userId, users.id))
      .orderBy(desc(ipptAttempts.date));
    
    // Get all sessions
    const sessions = await db
      .select({
        ippt_sessions: ipptSessions,
        users: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          credits: users.credits,
          rank: users.rank,
          mspId: users.mspId,
          dob: users.dob,
          doe: users.doe
        }
      })
      .from(ipptSessions)
      .leftJoin(users, eq(ipptSessions.createdBy, users.id))
      .orderBy(desc(ipptSessions.date));
    
    // Get all user eligibility records
    const eligibilityRecords = await db
      .select()
      .from(userEligibility);
    
    const eligibilityMap = new Map(
      eligibilityRecords.map(record => [record.userId, record])
    );
    
    // Calculate statistics
    const trooperSummaries: TrooperIpptSummary[] = soldiers.map(soldier => {
      const soldierAttempts = attempts.filter(a => a.ippt_attempts.userId === soldier.id);
      
      const bestAttempt = soldierAttempts.length > 0 
        ? soldierAttempts.reduce((best, current) => 
            current.ippt_attempts.totalScore > best.ippt_attempts.totalScore ? current : best
          ).ippt_attempts
        : undefined;
      
      const latestAttempt = soldierAttempts.length > 0 ? soldierAttempts[0].ippt_attempts : undefined;
      
      const initialAttempts = soldierAttempts.filter(a => a.ippt_attempts.isInitial === "true");
      const initialAttempt = initialAttempts.length > 0
        ? initialAttempts.reduce((best, current) => 
            new Date(current.ippt_attempts.date) < new Date(best.ippt_attempts.date) ? current : best
          ).ippt_attempts
        : undefined;
      
      const scoreChange = bestAttempt && initialAttempt 
        ? bestAttempt.totalScore - initialAttempt.totalScore 
        : undefined;
      
      // Check for manual eligibility override
      const eligibilityOverride = eligibilityMap.get(soldier.id);
      const isManuallyIneligible = eligibilityOverride && eligibilityOverride.isEligible === "false" && (
        (eligibilityOverride.ineligibilityType === "until_date" && eligibilityOverride.untilDate && new Date() <= new Date(eligibilityOverride.untilDate)) ||
        eligibilityOverride.ineligibilityType === "indefinite"
      );
      
      // Default to eligible unless manually overridden
      const isEligible = !isManuallyIneligible;
      
      // Calculate Year 1 and Year 2 status separately
      const calculateYearStatus = (yearNumber: 1 | 2) => {
        // If manually ineligible, check if they've already cleared this year
        if (isManuallyIneligible) {
          // Check if they had any IPPT attempts within this specific year
          const yearAttempts = soldierAttempts.filter(a => {
            const attemptDays = Math.floor(
              (new Date(a.ippt_attempts.date).getTime() - new Date(soldier.doe!).getTime()) / (1000 * 60 * 60 * 24)
            );
            const yearStartDays = yearNumber === 1 ? 0 : 365;
            const yearEndDays = yearNumber === 1 ? 365 : 730;
            return attemptDays >= yearStartDays && attemptDays <= yearEndDays;
          });
          
          // If they have attempts in this year, show the actual status
          if (yearAttempts.length > 0) {
            return "Cleared";
          }
          // If no attempts in this year, show NA
          return "NA";
        }
        
        // Check for manual eligibility override for eligible users (for until date expiry)
        const eligibilityOverride = eligibilityMap.get(soldier.id);
        if (eligibilityOverride && eligibilityOverride.isEligible === "false") {
          // Check if until date has passed
          if (eligibilityOverride.ineligibilityType === "until_date" && eligibilityOverride.untilDate) {
            const untilDate = new Date(eligibilityOverride.untilDate);
            if (new Date() <= untilDate) {
              return "Incomplete"; // Still within ineligibility period
            }
            // Until date has passed, fall through to normal calculation
          } else if (eligibilityOverride.ineligibilityType === "indefinite") {
            return "Incomplete"; // Indefinite ineligibility
          }
        }
        
        // Check if ineligible (regulars or other criteria)
        if (soldier.role === "admin") return "NA";
        
        // Check if no DOE (enlistment date)
        if (!soldier.doe) return "NA";
        
        const daysSinceEnlistment = Math.floor(
          (new Date().getTime() - new Date(soldier.doe).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // If DOE is in the future, they haven't enlisted yet - Incomplete
        if (daysSinceEnlistment < 0) return "Incomplete";
        
        // If enlisted more than 730 days ago, they're a Regular - Year 1/2 doesn't apply
        if (daysSinceEnlistment > 730) return "NA";
        
        // Calculate the year boundaries
        const yearStartDays = yearNumber === 1 ? 0 : 365;
        const yearEndDays = yearNumber === 1 ? 365 : 730;
        
        // Check if they had any IPPT attempts within this specific year
        const yearAttempts = soldierAttempts.filter(a => {
          const attemptDays = Math.floor(
            (new Date(a.ippt_attempts.date).getTime() - new Date(soldier.doe!).getTime()) / (1000 * 60 * 60 * 24)
          );
          return attemptDays >= yearStartDays && attemptDays <= yearEndDays;
        });
        
        // DEBUG: Log the calculation details
        console.log(`DEBUG ${soldier.fullName} Year ${yearNumber}:`, {
          daysSinceEnlistment,
          yearStartDays,
          yearEndDays,
          yearAttemptsCount: yearAttempts.length,
          totalAttempts: soldierAttempts.length,
          allAttempts: soldierAttempts.map(a => ({
            date: a.ippt_attempts.date,
            daysFromDOE: Math.floor((new Date(a.ippt_attempts.date).getTime() - new Date(soldier.doe!).getTime()) / (1000 * 60 * 60 * 24))
          })),
          status: yearAttempts.length > 0 ? "Cleared" : "Incomplete"
        });
        
        return yearAttempts.length > 0 ? "Cleared" : "Incomplete";
      };
      
      const yearOneStatus = calculateYearStatus(1);
      const yearTwoStatus = calculateYearStatus(2);
      
      // Calculate year-specific attempts for debug info (using same logic as calculateYearStatus)
      const getYearAttempts = (yearNumber: 1 | 2) => {
        const yearStartDays = yearNumber === 1 ? 0 : 365;
        const yearEndDays = yearNumber === 1 ? 365 : 730;
        
        return soldierAttempts.filter(a => {
          const attemptDays = Math.floor(
            (new Date(a.ippt_attempts.date).getTime() - new Date(soldier.doe!).getTime()) / (1000 * 60 * 60 * 24)
          );
          return attemptDays >= yearStartDays && attemptDays <= yearEndDays;
        }).map(a => a.ippt_attempts); // Extract just the ippt_attempts part
      };
      
      const yearOneAttempts = getYearAttempts(1);
      const yearTwoAttempts = getYearAttempts(2);

      return {
        user: soldier,
        bestAttempt,
        latestAttempt,
        initialAttempt,
        totalAttempts: soldierAttempts.length,
        scoreChange,
        yearOneStatus,
        yearTwoStatus,
        yearOneAttempts,
        yearTwoAttempts,
        isEligible
      };
    });
    
    // Calculate breakdowns
    const bestResults = trooperSummaries.map(t => t.bestAttempt?.result ?? "Fail").filter(Boolean);
    const initialResults = trooperSummaries.map(t => t.initialAttempt?.result ?? "Fail").filter(Boolean);
    
    const bestBreakdown = {
      gold: bestResults.filter(r => r === "Gold").length,
      silver: bestResults.filter(r => r === "Silver").length,
      pass: bestResults.filter(r => r === "Pass").length,
      fail: bestResults.filter(r => r === "Fail").length,
      ytt: bestResults.filter(r => r === "YTT").length
    };
    
    const initialBreakdown = {
      gold: initialResults.filter(r => r === "Gold").length,
      silver: initialResults.filter(r => r === "Silver").length,
      pass: initialResults.filter(r => r === "Pass").length,
      fail: initialResults.filter(r => r === "Fail").length,
      ytt: initialResults.filter(r => r === "YTT").length
    };
    
    // Calculate improvement rates
    const improvementRates = {
      gold: bestBreakdown.gold - initialBreakdown.gold,
      goldPercent: initialBreakdown.gold > 0 ? ((bestBreakdown.gold - initialBreakdown.gold) / initialBreakdown.gold) * 100 : 0,
      silver: bestBreakdown.silver - initialBreakdown.silver,
      silverPercent: initialBreakdown.silver > 0 ? ((bestBreakdown.silver - initialBreakdown.silver) / initialBreakdown.silver) * 100 : 0,
      pass: (bestBreakdown.gold + bestBreakdown.silver + bestBreakdown.pass) - (initialBreakdown.gold + initialBreakdown.silver + initialBreakdown.pass),
      passPercent: (initialBreakdown.gold + initialBreakdown.silver + initialBreakdown.pass) > 0 
        ? (((bestBreakdown.gold + bestBreakdown.silver + bestBreakdown.pass) - (initialBreakdown.gold + initialBreakdown.silver + initialBreakdown.pass)) / (initialBreakdown.gold + initialBreakdown.silver + initialBreakdown.pass)) * 100 
        : 0,
      fail: bestBreakdown.fail - initialBreakdown.fail,
      failPercent: initialBreakdown.fail > 0 ? ((bestBreakdown.fail - initialBreakdown.fail) / initialBreakdown.fail) * 100 : 0
    };
    
    // Calculate averages
    const bestAttempts = trooperSummaries.map(t => t.bestAttempt).filter(Boolean);
    const averageBestScore = bestAttempts.length > 0 
      ? bestAttempts.reduce((sum, attempt) => sum + attempt!.totalScore, 0) / bestAttempts.length 
      : 0;
    
    const averageBestStations = {
      situps: bestAttempts.length > 0 
        ? Math.round(bestAttempts.reduce((sum, attempt) => sum + attempt!.situps, 0) / bestAttempts.length * 10) / 10
        : 0,
      pushups: bestAttempts.length > 0 
        ? Math.round(bestAttempts.reduce((sum, attempt) => sum + attempt!.pushups, 0) / bestAttempts.length * 10) / 10
        : 0,
      runTime: bestAttempts.length > 0 
        ? Math.floor(bestAttempts.reduce((sum, attempt) => sum + attempt!.runTimeSeconds, 0) / bestAttempts.length / 60) + ":" + 
          String(Math.floor((bestAttempts.reduce((sum, attempt) => sum + attempt!.runTimeSeconds, 0) / bestAttempts.length) % 60)).padStart(2, "0")
        : "0:00"
    };
    
    const passPlusRate = trooperSummaries.length > 0 
      ? ((bestBreakdown.gold + bestBreakdown.silver + bestBreakdown.pass) / trooperSummaries.length) * 100 
      : 0;
    
    const overallImprovementRate = trooperSummaries.filter(t => t.scoreChange && t.scoreChange > 0).length > 0 
      ? (trooperSummaries.filter(t => t.scoreChange && t.scoreChange > 0).length / trooperSummaries.length) * 100 
      : 0;
    
    // Top performers
    const topBestScores = trooperSummaries
      .filter(t => t.bestAttempt)
      .sort((a, b) => (b.bestAttempt?.totalScore || 0) - (a.bestAttempt?.totalScore || 0))
      .slice(0, 5);
    
    const topImprovements = trooperSummaries
      .filter(t => t.scoreChange && t.scoreChange > 0)
      .sort((a, b) => (b.scoreChange || 0) - (a.scoreChange || 0))
      .slice(0, 5);
    
    // Station leaders
    const defaultSoldier = soldiers[0] || { id: '', username: '', fullName: '', role: 'soldier', credits: 0, rank: '', mspId: '' };
    const defaultTopSitups = { user: defaultSoldier as any, value: 0 };
    const defaultTopPushups = { user: defaultSoldier as any, value: 0 };
    const defaultFastestRun = { user: defaultSoldier as any, value: "99:99" };
    
    const stationLeaders = {
      topSitups: bestAttempts.reduce((best, current) => 
        current!.situps > best.value ? { user: soldiers.find(s => s.id === current!.userId)!, value: current!.situps } : best, defaultTopSitups),
      topPushups: bestAttempts.reduce((best, current) => 
        current!.pushups > best.value ? { user: soldiers.find(s => s.id === current!.userId)!, value: current!.pushups } : best, defaultTopPushups),
      fastestRun: (() => {
        if (bestAttempts.length === 0) return defaultFastestRun;
        const fastest = bestAttempts.reduce((best, current) => 
          (current?.runTimeSeconds || 0) < (best?.runTimeSeconds || 0) ? current : best, bestAttempts[0]!);
        if (!fastest) return defaultFastestRun;
        return {
          user: soldiers.find(s => s.id === fastest.userId) || soldiers[0]!,
          value: Math.floor(fastest.runTimeSeconds / 60) + ":" + String(fastest.runTimeSeconds % 60).padStart(2, "0")
        };
      })()
    };
    
    return {
      totalEligible: soldiers.length,
      bestResultBreakdown: bestBreakdown,
      initialResultBreakdown: initialBreakdown,
      improvementRates,
      averageBestStations,
      averageBestScore,
      passPlusRate,
      overallImprovementRate,
      troopers: trooperSummaries,
      topBestScores,
      topImprovements,
      stationLeaders,
      sessions: sessions.map(s => ({
        id: s.ippt_sessions.id,
        name: s.ippt_sessions.name,
        date: s.ippt_sessions.date,
        totalAttendees: s.ippt_sessions.totalAttendees,
        avgScore: s.ippt_sessions.avgScore,
        goldCount: s.ippt_sessions.goldCount,
        silverCount: s.ippt_sessions.silverCount,
        passCount: s.ippt_sessions.passCount,
        failCount: s.ippt_sessions.failCount,
        createdBy: s.ippt_sessions.createdBy,
        createdAt: s.ippt_sessions.createdAt,
        creator: s.users ? {
          id: s.users.id,
          username: s.users.username,
          fullName: s.users.fullName,
          role: s.users.role,
          credits: s.users.credits,
          rank: s.users.rank,
          mspId: s.users.mspId,
          dob: s.users.dob,
          doe: s.users.doe
        } : undefined
      }))
    };
  }

  async getIpptAttempts(userId: string): Promise<IpptAttempt[]> {
    return await db
      .select()
      .from(ipptAttempts)
      .where(eq(ipptAttempts.userId, userId))
      .orderBy(desc(ipptAttempts.date));
  }

  async createIpptAttempt(attempt: any): Promise<IpptAttempt> {
    // Check if this is the user's first IPPT attempt
    const existingAttempts = await db
      .select()
      .from(ipptAttempts)
      .where(eq(ipptAttempts.userId, attempt.userId))
      .limit(1);
    
    const isInitial = existingAttempts.length === 0 ? "true" : "false";
    
    const [newAttempt] = await db
      .insert(ipptAttempts)
      .values({
        id: randomUUID(),
        ...attempt,
        isInitial,
        totalScore: 0, // Will be calculated and updated
        result: "Fail", // Will be calculated and updated
      })
      .returning();
    return newAttempt;
  }

  async updateIpptAttempt(id: string, data: any): Promise<void> {
    await db
      .update(ipptAttempts)
      .set(data)
      .where(eq(ipptAttempts.id, id));
  }

  async getIpptSessionDetails(sessionId: string): Promise<any> {
    // Get session details
    const session = await db
      .select()
      .from(ipptSessions)
      .leftJoin(users, eq(ipptSessions.createdBy, users.id))
      .where(eq(ipptSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      throw new Error("Session not found");
    }

    const sessionData = session[0];

    // Get all attempts for this session with user details
    const attempts = await db
      .select({
        attempt: ipptAttempts,
        user: {
          id: users.id,
          fullName: users.fullName,
          rank: users.rank,
          mspName: msps.name
        }
      })
      .from(ipptAttempts)
      .leftJoin(users, eq(ipptAttempts.userId, users.id))
      .leftJoin(msps, eq(users.mspId, msps.id))
      .where(eq(ipptAttempts.sessionId, sessionId))
      .orderBy(desc(ipptAttempts.totalScore));

    // Calculate statistics
    const totalAttendees = attempts.length;
    const validAttempts = attempts.filter(a => a.attempt.totalScore > 0);
    const averageScore = validAttempts.length > 0 
      ? Math.round(validAttempts.reduce((sum, a) => sum + a.attempt.totalScore, 0) / validAttempts.length)
      : 0;

    const resultCounts = attempts.reduce((acc, a) => {
      const result = a.attempt.result || "YTT";
      acc[result.toLowerCase()] = (acc[result.toLowerCase()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      ...sessionData.ippt_sessions,
      creator: sessionData.users,
      attempts: attempts.map(a => ({
        ...a.attempt,
        user: a.user
      })),
      statistics: {
        totalAttendees,
        averageScore,
        goldCount: resultCounts.gold || 0,
        silverCount: resultCounts.silver || 0,
        passCount: resultCounts.pass || 0,
        failCount: resultCounts.fail || 0,
        yttCount: resultCounts.ytt || 0
      }
    };
  }

  async getIndividualIpptHistory(userId: string): Promise<any> {
    // Get user details
    const user = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        rank: users.rank,
        mspName: msps.name,
        dob: users.dob
      })
      .from(users)
      .leftJoin(msps, eq(users.mspId, msps.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error("User not found");
    }

    const userData = user[0];

    // Get all attempts for this user with session details
    const attempts = await db
      .select({
        attempt: ipptAttempts,
        session: ipptSessions
      })
      .from(ipptAttempts)
      .leftJoin(ipptSessions, eq(ipptAttempts.sessionId, ipptSessions.id))
      .where(eq(ipptAttempts.userId, userId))
      .orderBy(desc(ipptAttempts.date));

    // Calculate statistics
    const totalAttempts = attempts.length;
    const validAttempts = attempts.filter(a => a.attempt.totalScore > 0);
    const averageScore = validAttempts.length > 0 
      ? Math.round(validAttempts.reduce((sum, a) => sum + a.attempt.totalScore, 0) / validAttempts.length)
      : 0;

    const bestAttempt = validAttempts.length > 0 
      ? validAttempts.reduce((best, current) => 
          (current.attempt.totalScore || 0) > (best.attempt.totalScore || 0) ? current : best
        )
      : null;

    const latestAttempt = attempts.length > 0 ? attempts[0] : null;
    const initialAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

    const scoreChange = (latestAttempt?.attempt.totalScore && initialAttempt?.attempt.totalScore)
      ? latestAttempt.attempt.totalScore - initialAttempt.attempt.totalScore
      : undefined;

    return {
      ...userData,
      attempts: attempts.map(a => a.attempt),
      sessions: attempts.map(a => ({
        ...a.session,
        score: a.attempt.totalScore,
        result: a.attempt.result
      })).filter(s => s.id), // Only include sessions that exist
      statistics: {
        totalAttempts,
        averageScore,
        bestScore: bestAttempt?.attempt.totalScore,
        bestResult: bestAttempt?.attempt.result,
        latestScore: latestAttempt?.attempt.totalScore,
        latestResult: latestAttempt?.attempt.result,
        scoreChange
      }
    };
  }

  async getIpptAttempt(id: string): Promise<IpptAttempt> {
    const [attempt] = await db
      .select()
      .from(ipptAttempts)
      .where(eq(ipptAttempts.id, id))
      .limit(1);
    return attempt;
  }

  async getIpptSessions(): Promise<IpptSession[]> {
    return await db
      .select()
      .from(ipptSessions)
      .orderBy(desc(ipptSessions.date));
  }

  async createIpptSession(session: any): Promise<IpptSession> {
    const [newSession] = await db
      .insert(ipptSessions)
      .values({
        id: randomUUID(),
        ...session
      })
      .returning();
    return newSession;
  }

  async importIpptResults(data: any[]): Promise<{ attempts: number; sessions: number }> {
    let attemptsCreated = 0;
    let sessionsCreated = 0;
    
    // Get existing users for mapping
    const existingUsers = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users);
    const userMap = new Map(existingUsers.map((u: any) => [u.fullName, u.id]));
    
    // Get existing sessions to avoid duplicates
    const existingSessions = await db
      .select({ id: ipptSessions.id, name: ipptSessions.name })
      .from(ipptSessions);
    const existingSessionMap = new Map(existingSessions.map((s: any) => [s.name, s.id]));
    
    // Create or find sessions
    const sessionMap = new Map<string, string>();
    const uniqueSessions = Array.from(new Set(data.map((d: any) => d.session)));
    
    for (const sessionName of uniqueSessions) {
      // Check if session already exists
      if (existingSessionMap.has(sessionName)) {
        sessionMap.set(sessionName, existingSessionMap.get(sessionName)!);
        continue;
      }
      
      const sessionData = data.find((d: any) => d.session === sessionName);
      const sessionId = randomUUID();
      
      await db.insert(ipptSessions).values({
        id: sessionId,
        name: sessionName,
        date: sessionData.date,
        totalAttendees: data.filter((d: any) => d.session === sessionName).length,
        avgScore: Math.round(data.filter((d: any) => d.session === sessionName)
          .reduce((sum: number, d: any) => sum + d.totalScore, 0) / data.filter((d: any) => d.session === sessionName).length * 10) / 10,
        goldCount: data.filter((d: any) => d.session === sessionName && d.result === 'Gold').length,
        silverCount: data.filter((d: any) => d.session === sessionName && d.result === 'Silver').length,
        passCount: data.filter((d: any) => d.session === sessionName && d.result === 'Pass').length,
        failCount: data.filter((d: any) => d.session === sessionName && d.result === 'Fail').length
      });
      
      sessionMap.set(sessionName, sessionId);
      sessionsCreated++;
    }
    
    // Create IPPT attempts
    for (const item of data) {
      const userId = userMap.get(item.name);
      
      if (!userId) {
        console.warn(`User not found: ${item.name}, skipping...`);
        continue;
      }
      
      await db.insert(ipptAttempts).values({
        id: randomUUID(),
        userId: userId,
        sessionId: sessionMap.get(item.session),
        date: item.date,
        situps: item.situps,
        pushups: item.pushups,
        runTimeSeconds: item.runTimeSeconds,
        totalScore: item.totalScore,
        result: item.result,
        isInitial: item.isInitial || 'false'
      });
      
      attemptsCreated++;
    }
    
    return { attempts: attemptsCreated, sessions: sessionsCreated };
  }

  // User Eligibility operations
  async getUserEligibility(userId: string): Promise<UserEligibility | undefined> {
    const [eligibility] = await db
      .select()
      .from(userEligibility)
      .where(eq(userEligibility.userId, userId));
    return eligibility || undefined;
  }

  async createUserEligibility(eligibility: any): Promise<UserEligibility> {
    const [newEligibility] = await db
      .insert(userEligibility)
      .values({
        id: randomUUID(),
        userId: eligibility.userId,
        isEligible: eligibility.isEligible ? "true" : "false",
        reason: eligibility.reason,
        ineligibilityType: eligibility.ineligibilityType,
        untilDate: eligibility.untilDate,
        updatedAt: new Date()
      })
      .returning();
    return newEligibility;
  }

  async updateUserEligibility(userId: string, data: any): Promise<UserEligibility> {
    const existing = await this.getUserEligibility(userId);
    
    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(userEligibility)
        .set({
          isEligible: data.isEligible ? "true" : "false",
          reason: data.reason,
          ineligibilityType: data.ineligibilityType,
          untilDate: data.untilDate,
          updatedAt: new Date()
        })
        .where(eq(userEligibility.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new record
      return await this.createUserEligibility({
        userId,
        ...data
      });
    }
  }

  async deleteUserEligibility(userId: string): Promise<void> {
    await db
      .delete(userEligibility)
      .where(eq(userEligibility.userId, userId));
  }
}

export const storage = new DatabaseStorage();
