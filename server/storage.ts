import { 
  type User, type InsertUser, type Booking, type InsertBooking, type Config,
  type Msp, type InsertMsp, type DriverQualification, type InsertDriverQualification, 
  type DriveLog, type InsertDriveLog,
  users, bookings, config, msps, driverQualifications, driveLogs
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, lte, gte, lt, gt, ne, desc } from "drizzle-orm";

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
      .values(insertBooking)
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
      .values(insertMsp)
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
        .values({ key, value })
        .returning();
      return cfg;
    }
  }
}

export const storage = new DatabaseStorage();
