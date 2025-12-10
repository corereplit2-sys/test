import { pgTable, text, varchar, timestamp, integer, doublePrecision, date, unique, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const msps = pgTable("msps", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().$type<"admin" | "soldier" | "commander">(),
  credits: doublePrecision("credits").notNull().default(0),
  rank: text("rank"),
  mspId: text("msp_id").references(() => msps.id, { onDelete: "set null" }),
  dob: date("dob").notNull(),
  doe: date("doe"), // Date of Enlistment
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  creditsCharged: doublePrecision("credits_charged").notNull(),
  status: text("status").notNull().$type<"active" | "cancelled">().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const config = pgTable("config", {
  id: varchar("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const driverQualifications = pgTable("driver_qualifications", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleType: text("vehicle_type").notNull().$type<"TERREX" | "BELREX">(),
  qualifiedOnDate: date("qualified_on_date").notNull(),
  lastDriveDate: date("last_drive_date"),
  currencyExpiryDate: date("currency_expiry_date").notNull(),
});

export const driveLogs = pgTable("drive_logs", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleType: text("vehicle_type").notNull().$type<"TERREX" | "BELREX">(),
  vehicleNo: text("vehicle_no"),
  date: date("date").notNull(),
  initialMileageKm: doublePrecision("initial_mileage_km"),
  finalMileageKm: doublePrecision("final_mileage_km"),
  distanceKm: doublePrecision("distance_km").notNull(),
  isFromQRScan: text("is_from_qr_scan").notNull().default("false"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const currencyDrives = pgTable("currency_drives", {
  id: varchar("id").primaryKey(),
  code: text("code").notNull().unique(),
  vehicleType: text("vehicle_type").notNull().$type<"TERREX" | "BELREX">(),
  date: date("date").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scans: integer("scans").notNull().default(0),
});

export const currencyDriveScans = pgTable("currency_drive_scans", {
  id: varchar("id").primaryKey(),
  driveId: varchar("drive_id").notNull().references(() => currencyDrives.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  unq: unique().on(table.driveId, table.userId),
}));

// IPPT Tables
export const ipptAttempts = pgTable("ippt_attempts", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id").references(() => ipptSessions.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  situps: integer("situps").notNull(),
  pushups: integer("pushups").notNull(),
  runTimeSeconds: integer("run_time_seconds").notNull(),
  totalScore: integer("total_score").notNull(),
  result: text("result").notNull().$type<"Gold" | "Silver" | "Pass" | "Fail" | "YTT">(),
  isInitial: text("is_initial").notNull().default("false").$type<"true" | "false">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ipptScoringCompact = pgTable("ippt_scoring_compact", {
  id: serial("id").primaryKey(),
  ageGroup: text("age_group").unique().notNull(),
  situpsScoring: text("situps_scoring").notNull().$type<string>(), // JSON string
  pushupsScoring: text("pushups_scoring").notNull().$type<string>(), // JSON string
  runScoring: text("run_scoring").notNull().$type<string>(), // JSON string
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ipptSessions = pgTable("ippt_sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  totalAttendees: integer("total_attendees").notNull().default(0),
  avgScore: doublePrecision("avg_score").notNull().default(0),
  goldCount: integer("gold_count").notNull().default(0),
  silverCount: integer("silver_count").notNull().default(0),
  passCount: integer("pass_count").notNull().default(0),
  failCount: integer("fail_count").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userEligibility = pgTable("user_eligibility", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isEligible: text("is_eligible", { enum: ["true", "false"] }).notNull().default("true"),
  reason: text("reason"),
  ineligibilityType: text("ineligibility_type").$type<"indefinite" | "until_date">(),
  untilDate: date("until_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  unq: unique().on(table.userId),
}));

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
  isFromQRScan: true,
}).extend({
  date: z.coerce.date(),
  vehicleNo: z.string().regex(/^\d{5}$/, "Vehicle number must be exactly 5 digits").optional(),
  initialMileageKm: z.number().min(0, "Initial mileage must be positive").optional(),
  finalMileageKm: z.number().min(0, "Final mileage must be positive").optional(),
}).refine((data) => {
  // If either mileage is provided, both must be provided and finalMileageKm > initialMileageKm
  if (data.initialMileageKm !== undefined || data.finalMileageKm !== undefined) {
    return data.initialMileageKm !== undefined && data.finalMileageKm !== undefined && data.finalMileageKm > data.initialMileageKm;
  }
  return true;
}, {
  message: "Both initial and final mileage required, final must be greater than initial",
  path: ["finalMileageKm"],
});

export const insertCurrencyDriveSchema = createInsertSchema(currencyDrives).omit({
  id: true,
  code: true,
  createdAt: true,
  scans: true,
  createdBy: true,
  expiresAt: true,
}).extend({
  date: z.coerce.date(),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(3, "New password must be at least 3 characters"),
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

export type InsertCurrencyDrive = z.infer<typeof insertCurrencyDriveSchema>;
export type CurrencyDrive = typeof currencyDrives.$inferSelect;

export type Config = typeof config.$inferSelect;
export type CurrencyDriveScan = typeof currencyDriveScans.$inferSelect;
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

export type CurrencyDriveWithUser = CurrencyDrive & {
  creator?: SafeUser;
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

// IPPT Types
export type IpptAttempt = typeof ipptAttempts.$inferSelect;
export type IpptSession = typeof ipptSessions.$inferSelect;
export type UserEligibility = typeof userEligibility.$inferSelect;

export type IpptSessionWithCreator = IpptSession & {
  creator?: SafeUser;
};

export type IpptSessionWithAttempts = IpptSession & {
  attempts?: (IpptAttempt & { user?: SafeUser })[];
  statistics?: {
    totalAttendees: number;
    averageScore: number;
    goldCount: number;
    silverCount: number;
    passCount: number;
    failCount: number;
    yttCount: number;
  };
};

export type IndividualIpptHistory = SafeUser & {
  attempts: IpptAttempt[];
  sessions: (IpptSession & { score?: number; result?: string })[];
  statistics: {
    totalAttempts: number;
    averageScore: number;
    bestScore?: number;
    bestResult?: string;
    latestScore?: number;
    latestResult?: string;
    scoreChange?: number;
  };
};

export type TrooperIpptSummary = {
  user: SafeUser;
  bestAttempt?: IpptAttempt;
  latestAttempt?: IpptAttempt;
  initialAttempt?: IpptAttempt;
  totalAttempts: number;
  scoreChange?: number;
  yearOneStatus: string;
  yearTwoStatus: string;
  yearOneAttempts?: IpptAttempt[];
  yearTwoAttempts?: IpptAttempt[];
  isEligible?: boolean;
};

export type IpptCommanderStats = {
  totalEligible: number;
  bestResultBreakdown: {
    gold: number;
    silver: number;
    pass: number;
    fail: number;
    ytt: number;
  };
  initialResultBreakdown: {
    gold: number;
    silver: number;
    pass: number;
    fail: number;
    ytt: number;
  };
  improvementRates: {
    gold: number;
    goldPercent: number;
    silver: number;
    silverPercent: number;
    pass: number;
    passPercent: number;
    fail: number;
    failPercent: number;
  };
  averageBestStations: {
    situps: number;
    pushups: number;
    runTime: string;
  };
  averageBestScore: number;
  passPlusRate: number;
  overallImprovementRate: number;
  troopers: TrooperIpptSummary[];
  topBestScores: TrooperIpptSummary[];
  topImprovements: TrooperIpptSummary[];
  stationLeaders: {
    topSitups: { user: SafeUser; value: number };
    topPushups: { user: SafeUser; value: number };
    fastestRun: { user: SafeUser; value: string };
  };
  sessions: IpptSessionWithCreator[];
};
