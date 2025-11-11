import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, doublePrecision, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const msps = pgTable("msps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().$type<"admin" | "soldier" | "commander">(),
  credits: doublePrecision("credits").notNull().default(10),
  rank: text("rank"),
  mspId: varchar("msp_id").references(() => msps.id, { onDelete: "set null" }),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  creditsCharged: doublePrecision("credits_charged").notNull(),
  status: text("status").notNull().$type<"active" | "cancelled">().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const config = pgTable("config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const driverQualifications = pgTable("driver_qualifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleType: text("vehicle_type").notNull().$type<"TERREX" | "BELREX">(),
  qualifiedOnDate: date("qualified_on_date").notNull(),
  lastDriveDate: date("last_drive_date"),
  currencyExpiryDate: date("currency_expiry_date").notNull(),
});

export const driveLogs = pgTable("drive_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleType: text("vehicle_type").notNull().$type<"TERREX" | "BELREX">(),
  vehicleNo: text("vehicle_no").notNull(),
  date: date("date").notNull(),
  initialMileageKm: doublePrecision("initial_mileage_km").notNull(),
  finalMileageKm: doublePrecision("final_mileage_km").notNull(),
  distanceKm: doublePrecision("distance_km").notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Insert schemas
export const insertMspSchema = createInsertSchema(msps).omit({
  id: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
}).extend({
  password: z.string().min(3, "Password must be at least 3 characters"),
});

export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
}).extend({
  password: z.string().min(3, "Password must be at least 3 characters").optional(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  cancelledAt: true,
  status: true,
}).extend({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

export const insertDriverQualificationSchema = createInsertSchema(driverQualifications).omit({
  id: true,
  lastDriveDate: true,
  currencyExpiryDate: true,
}).extend({
  qualifiedOnDate: z.coerce.date(),
});

export const insertDriveLogSchema = createInsertSchema(driveLogs).omit({
  id: true,
  createdAt: true,
  distanceKm: true,
}).extend({
  date: z.coerce.date(),
  vehicleNo: z.string().regex(/^\d{5}$/, "Vehicle number must be exactly 5 digits"),
  initialMileageKm: z.number().min(0, "Initial mileage must be positive"),
  finalMileageKm: z.number().min(0, "Final mileage must be positive"),
}).refine((data) => data.finalMileageKm > data.initialMileageKm, {
  message: "Final mileage must be greater than initial mileage",
  path: ["finalMileageKm"],
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type InsertMsp = z.infer<typeof insertMspSchema>;
export type Msp = typeof msps.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export type InsertDriverQualification = z.infer<typeof insertDriverQualificationSchema>;
export type DriverQualification = typeof driverQualifications.$inferSelect;

export type InsertDriveLog = z.infer<typeof insertDriveLogSchema>;
export type DriveLog = typeof driveLogs.$inferSelect;

export type Config = typeof config.$inferSelect;
export type LoginCredentials = z.infer<typeof loginSchema>;

// Safe user type without password hash (for API responses)
export type SafeUser = Omit<User, "passwordHash">;

// API response types
export type UserWithBookings = SafeUser & {
  bookings?: Booking[];
};

export type UserWithMsp = SafeUser & {
  msp?: Msp;
};

export type BookingWithUser = Booking & {
  user?: SafeUser;
};

export type QualificationWithUser = DriverQualification & {
  user?: SafeUser;
};

export type DriveLogWithUser = DriveLog & {
  user?: SafeUser;
};

export type DashboardStats = {
  totalUsers: number;
  activeBookingsToday: number;
  totalCreditsIssued: number;
};

export type CapacityInfo = {
  maxCapacity: number;
  currentBookings: number;
  availableSpots: number;
  isFull: boolean;
};

export type BookableWeekRange = {
  start: string;
  end: string;
  releaseDay: number;
};

export type CurrencyStatus = "CURRENT" | "EXPIRING_SOON" | "EXPIRED";

export type QualificationWithStatus = DriverQualification & {
  status: CurrencyStatus;
  daysRemaining: number;
  user?: SafeUser;
};
