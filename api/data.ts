import { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import * as pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { addDays, startOfWeek, endOfWeek } from 'date-fns';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, process.env.SESSION_SECRET || 'fallback-secret');
  } catch (error) {
    return null;
  }
}

// Validation schemas (mirroring shared/schema)
const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  fullName: z.string().min(1),
  role: z.enum(['admin', 'commander', 'soldier']),
  rank: z.string().optional(),
  mspId: z.string().optional(),
});

const insertDriverQualificationSchema = z.object({
  userId: z.string(),
  vehicleType: z.string(),
  qualifiedOnDate: z.string(),
});

const insertCurrencyDriveSchema = z.object({
  vehicleType: z.enum(['TERREX', 'BELREX']),
  date: z.coerce.date(),
});

const insertBookingSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { pathname } = new URL(req.url || '', 'http://localhost');
    
    // Admin users endpoint
    if (pathname === '/api/admin/users' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query('SELECT id, username, "full_name", role, credits, rank, "msp_id" FROM users ORDER BY username');
        const users = result.rows.map(user => ({
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
          credits: user.credits,
          rank: user.rank,
          mspId: user.msp_id
        }));
        
        return res.json(users);
      } finally {
        client.release();
      }
    }

    // MSPs endpoint
    if (pathname === '/api/msps' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query('SELECT * FROM msps ORDER BY name');
        return res.json(result.rows);
      } finally {
        client.release();
      }
    }

    // Qualifications endpoint - mirror original /api/qualifications shape
    if (pathname === '/api/qualifications' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        // For now, return all qualifications (admin view). If you later
        // need role-based filtering, we can extend this with payload.role.
        const result = await client.query(`
          SELECT 
            dq.id,
            dq.user_id,
            dq.vehicle_type,
            dq.qualified_on_date,
            dq.last_drive_date,
            dq.currency_expiry_date,
            u.id        AS user_db_id,
            u.username  AS user_username,
            u.full_name AS user_full_name,
            u.role      AS user_role,
            u.credits   AS user_credits,
            u.rank      AS user_rank,
            u.msp_id    AS user_msp_id
          FROM driver_qualifications dq
          LEFT JOIN users u ON dq.user_id = u.id
        `);

        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;

        const qualifications = result.rows.map(row => {
          const expiry = row.currency_expiry_date ? new Date(row.currency_expiry_date) : null;
          let daysRemaining = 0;
          let status: 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED' = 'EXPIRED';

          if (expiry && !isNaN(expiry.getTime())) {
            daysRemaining = Math.floor((expiry.getTime() - now.getTime()) / msPerDay);
            if (daysRemaining < 0) {
              status = 'EXPIRED';
            } else if (daysRemaining <= 30) {
              status = 'EXPIRING_SOON';
            } else {
              status = 'CURRENT';
            }
          }

          const user = row.user_db_id
            ? {
                id: row.user_db_id,
                username: row.user_username,
                fullName: row.user_full_name,
                role: row.user_role,
                credits: row.user_credits,
                rank: row.user_rank,
                mspId: row.user_msp_id,
              }
            : undefined;

          return {
            id: row.id,
            userId: row.user_id,
            vehicleType: row.vehicle_type,
            qualifiedOnDate: row.qualified_on_date,
            lastDriveDate: row.last_drive_date,
            currencyExpiryDate: row.currency_expiry_date,
            status,
            daysRemaining: Math.max(0, daysRemaining),
            user,
          };
        });

        return res.json(qualifications);
      } finally {
        client.release();
      }
    }

    // User-specific qualifications endpoint
    if (pathname === '/api/qualifications/my' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        // Only return qualifications for the current user
        const result = await client.query(`
          SELECT 
            dq.id,
            dq.user_id,
            dq.vehicle_type,
            dq.qualified_on_date,
            dq.last_drive_date,
            dq.currency_expiry_date,
            u.id        AS user_db_id,
            u.username  AS user_username,
            u.full_name AS user_full_name,
            u.role      AS user_role,
            u.credits   AS user_credits,
            u.rank      AS user_rank,
            u.msp_id    AS user_msp_id
          FROM driver_qualifications dq
          LEFT JOIN users u ON dq.user_id = u.id
          WHERE dq.user_id = $1
        `, [payload.userId]);

        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;

        const qualifications = result.rows.map(row => {
          const expiry = row.currency_expiry_date ? new Date(row.currency_expiry_date) : null;
          let daysRemaining = 0;
          let status: 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED' = 'EXPIRED';

          if (expiry && !isNaN(expiry.getTime())) {
            daysRemaining = Math.floor((expiry.getTime() - now.getTime()) / msPerDay);
            if (daysRemaining < 0) {
              status = 'EXPIRED';
            } else if (daysRemaining <= 30) {
              status = 'EXPIRING_SOON';
            } else {
              status = 'CURRENT';
            }
          }

          const user = row.user_db_id
            ? {
                id: row.user_db_id,
                username: row.user_username,
                fullName: row.user_full_name,
                role: row.user_role,
                credits: row.user_credits,
                rank: row.user_rank,
                mspId: row.user_msp_id,
              }
            : undefined;

          return {
            id: row.id,
            userId: row.user_id,
            vehicleType: row.vehicle_type,
            qualifiedOnDate: row.qualified_on_date,
            lastDriveDate: row.last_drive_date,
            currencyExpiryDate: row.currency_expiry_date,
            status,
            daysRemaining: Math.max(0, daysRemaining),
            user,
          };
        });

        return res.json(qualifications);
      } finally {
        client.release();
      }
    }

    // Currency stats endpoint
    if (pathname === '/api/admin/stats' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        // Get currency stats by MSP
        const mspStats = await client.query(`
          SELECT 
            m.id as msp_id,
            m.name as msp_name,
            COUNT(dq.id) as total_qualifications,
            COUNT(CASE WHEN dq.currency_expiry_date > CURRENT_DATE THEN 1 END) as current_qualifications,
            COUNT(CASE WHEN dq.currency_expiry_date <= CURRENT_DATE THEN 1 END) as expired_qualifications
          FROM msps m
          LEFT JOIN users u ON m.id = u.msp_id
          LEFT JOIN driver_qualifications dq ON u.id = dq.user_id
          GROUP BY m.id, m.name
          ORDER BY m.name
        `);
        
        return res.json(mspStats.rows);
      } finally {
        client.release();
      }
    }

    // Bookings endpoint - mirror original /api/bookings (BookingWithUser[])
    if (pathname === '/api/bookings' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            b.id,
            b.user_id,
            b.start_time      AS start_time,
            b.end_time        AS end_time,
            b.credits_charged AS credits_charged,
            b.status          AS status,
            b.created_at      AS created_at,
            b.cancelled_at    AS cancelled_at,
            u.id              AS user_db_id,
            u.username        AS user_username,
            u.full_name       AS user_full_name,
            u.role            AS user_role,
            u.credits         AS user_credits,
            u.rank            AS user_rank,
            u.msp_id          AS user_msp_id
          FROM bookings b
          LEFT JOIN users u ON b.user_id = u.id
          ORDER BY b.start_time
        `);

        const bookings = result.rows.map(row => {
          const user = row.user_db_id
            ? {
                id: row.user_db_id,
                username: row.user_username,
                fullName: row.user_full_name,
                role: row.user_role,
                credits: row.user_credits,
                rank: row.user_rank,
                mspId: row.user_msp_id,
              }
            : undefined;

          return {
            id: row.id,
            userId: row.user_id,
            startTime: row.start_time,
            endTime: row.end_time,
            creditsCharged: row.credits_charged,
            status: row.status,
            createdAt: row.created_at,
            cancelledAt: row.cancelled_at,
            user,
          };
        });

        return res.json(bookings);
      } finally {
        client.release();
      }
    }

    // POST qualification
    if (pathname === '/api/qualifications' && req.method === 'POST') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      if (payload.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      try {
        console.log('Qualification request body:', req.body);
        const parsed = insertDriverQualificationSchema.safeParse(req.body);
        console.log('Qualification validation result:', parsed);
        
        if (!parsed.success) {
          console.log('Qualification validation errors:', parsed.error.errors);
          return res.status(400).json({ message: 'Invalid qualification data', errors: parsed.error.errors });
        }

        const qualifiedDate = new Date(parsed.data.qualifiedOnDate);
        const currencyExpiryDate = addDays(qualifiedDate, 88);

        const client = await pool.connect();
        try {
          const result = await client.query(`
            INSERT INTO driver_qualifications (user_id, vehicle_type, qualified_on_date, currency_expiry_date)
            VALUES ($1, $2, $3, $4)
            RETURNING *
          `, [
            parsed.data.userId,
            parsed.data.vehicleType,
            parsed.data.qualifiedOnDate,
            currencyExpiryDate.toISOString().split('T')[0]
          ]);

          const qualification = result.rows[0];
          return res.status(201).json(qualification);
        } finally {
          client.release();
        }
      } catch (error: any) {
        console.error('Error creating qualification:', error);
        return res.status(500).json({ message: error.message || 'Failed to create qualification' });
      }
    }

    // POST user
    if (pathname === '/api/admin/users' && req.method === 'POST') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      if (payload.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      try {
        console.log('User creation request body:', req.body);
        const parsed = insertUserSchema.safeParse(req.body);
        console.log('User validation result:', parsed);
        
        if (!parsed.success) {
          console.log('User validation errors:', parsed.error.errors);
          return res.status(400).json({ message: 'Invalid user data', errors: parsed.error.errors });
        }

        const client = await pool.connect();
        try {
          // Check if username already exists
          const existingUser = await client.query('SELECT id FROM users WHERE username = $1', [parsed.data.username]);
          if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Username already exists' });
          }

          // Hash password
          const passwordHash = await bcrypt.hash(parsed.data.password, 10);

          const result = await client.query(`
            INSERT INTO users (id, username, password_hash, full_name, role, rank, msp_id, credits)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
            RETURNING id, username, "full_name", role, credits, rank, "msp_id"
          `, [
            randomUUID(),
            parsed.data.username,
            passwordHash,
            parsed.data.fullName,
            parsed.data.role,
            parsed.data.rank || null,
            parsed.data.mspId || null
          ]);

          const user = result.rows[0];
          return res.status(201).json({
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            credits: user.credits,
            rank: user.rank,
            mspId: user.msp_id
          });
        } finally {
          client.release();
        }
      } catch (error: any) {
        console.error('Error creating user:', error);
        return res.status(500).json({ message: error.message || 'Failed to create user' });
      }
    }

    // Booking endpoints
    
    // GET my bookings
    if (pathname === '/api/bookings/my' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            b.id,
            b.user_id,
            b.start_time,
            b.end_time,
            b.credits_charged,
            b.status,
            b.created_at,
            b.cancelled_at
          FROM bookings b
          WHERE b.user_id = $1
          ORDER BY b.start_time DESC
        `, [payload.userId]);

        const bookings = result.rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          startTime: row.start_time,
          endTime: row.end_time,
          creditsCharged: row.credits_charged,
          status: row.status,
          createdAt: row.created_at,
          cancelledAt: row.cancelled_at
        }));

        return res.json(bookings);
      } finally {
        client.release();
      }
    }

    // GET calendar events
    if (pathname === '/api/bookings/calendar-events' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        // First, let's check what bookings exist and their statuses
        const allBookingsResult = await client.query(`
          SELECT COUNT(*) as total_bookings,
                 COUNT(CASE WHEN status = 'active' THEN 1 END) as active_bookings
          FROM bookings
        `);
        console.log('Bookings count:', allBookingsResult.rows[0]);

        // Check all statuses
        const statusCheckResult = await client.query(`
          SELECT status, COUNT(*) as count
          FROM bookings
          GROUP BY status
        `);
        console.log('Booking statuses:', statusCheckResult.rows);

        // Get all bookings regardless of status for debugging
        const allBookingsDebug = await client.query(`
          SELECT id, status, start_time, end_time
          FROM bookings
          ORDER BY start_time
        `);
        console.log('All bookings for debugging:', allBookingsDebug.rows);

        const result = await client.query(`
          SELECT 
            b.id,
            b.start_time,
            b.end_time,
            b.status,
            u.username,
            u.full_name
          FROM bookings b
          LEFT JOIN users u ON b.user_id = u.id
          WHERE b.status = 'active'
          ORDER BY b.start_time
        `);

        console.log('Raw calendar events query result:', result.rows);

        const events = result.rows.map(row => ({
          id: row.id,
          start: row.start_time,
          end: row.end_time,
          title: `${row.full_name || row.username} - Mess Booking`,
          status: row.status
        }));

        console.log('Processed calendar events:', events);

        return res.json(events);
      } finally {
        client.release();
      }
    }

    // GET capacity
    if (pathname === '/api/bookings/capacity' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const { startTime, endTime } = req.query;
      console.log('Capacity query params:', { startTime, endTime });
      
      if (!startTime || !endTime) {
        console.log('Missing start or end time');
        return res.status(400).json({ message: 'Start and end time required' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT COUNT(*) as count
          FROM bookings
          WHERE status = 'active'
            AND start_time < $2
            AND end_time > $1
        `, [startTime, endTime]);

        const concurrentBookings = parseInt(result.rows[0].count);
        const MAX_CAPACITY = 20;
        const availableSpots = MAX_CAPACITY - concurrentBookings;

        console.log('Capacity calculation:', {
          concurrentBookings,
          maxCapacity: MAX_CAPACITY,
          availableSpots,
          isFull: concurrentBookings >= MAX_CAPACITY
        });

        return res.json({
          availableSpots,
          maxCapacity: MAX_CAPACITY,
          concurrentBookings,
          isFull: concurrentBookings >= MAX_CAPACITY
        });
      } finally {
        client.release();
      }
    }

    // POST booking
    if (pathname === '/api/bookings' && req.method === 'POST') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      try {
        const parsed = insertBookingSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid booking data', errors: parsed.error.errors });
        }

        const client = await pool.connect();
        try {
          // Check capacity
          const capacityResult = await client.query(`
            SELECT COUNT(*) as count
            FROM bookings
            WHERE status = 'active'
              AND start_time < $2
              AND end_time > $1
          `, [parsed.data.startTime, parsed.data.endTime]);

          const concurrentBookings = parseInt(capacityResult.rows[0].count);
          const MAX_CAPACITY = 20;

          if (concurrentBookings >= MAX_CAPACITY) {
            return res.status(400).json({
              message: `This time slot is full (${MAX_CAPACITY}/${MAX_CAPACITY} capacity). Please choose another time.`
            });
          }

          // Create booking
          const result = await client.query(`
            INSERT INTO bookings (user_id, start_time, end_time, credits_charged, status)
            VALUES ($1, $2, $3, 1, 'active')
            RETURNING *
          `, [
            payload.userId,
            parsed.data.startTime,
            parsed.data.endTime
          ]);

          const booking = result.rows[0];
          return res.status(201).json({
            id: booking.id,
            userId: booking.user_id,
            startTime: booking.start_time,
            endTime: booking.end_time,
            creditsCharged: booking.credits_charged,
            status: booking.status,
            createdAt: booking.created_at,
            cancelledAt: booking.cancelled_at
          });
        } finally {
          client.release();
        }
      } catch (error: any) {
        console.error('Error creating booking:', error);
        return res.status(500).json({ message: error.message || 'Failed to create booking' });
      }
    }

    // POST cancel booking
    if (pathname.startsWith('/api/bookings/') && pathname.endsWith('/cancel') && req.method === 'POST') {
      const bookingId = pathname.split('/')[3]; // Extract from /api/bookings/:id/cancel
      
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        // Check if booking belongs to user
        const bookingResult = await client.query(
          'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
          [bookingId, payload.userId]
        );

        if (bookingResult.rows.length === 0) {
          return res.status(404).json({ message: 'Booking not found' });
        }

        // Cancel the booking
        await client.query(`
          UPDATE bookings 
          SET status = 'cancelled', cancelled_at = NOW() 
          WHERE id = $1
        `, [bookingId]);

        return res.json({ message: 'Booking cancelled successfully' });
      } finally {
        client.release();
      }
    }

    // Config endpoint - booking release day
    if (pathname === '/api/config/booking-release-day' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        // Get release day config (default to 0 = Sunday)
        const configResult = await client.query('SELECT value FROM config WHERE key = $1', ['bookingReleaseDay']);
        const releaseDay = configResult.rows.length > 0 ? parseInt(configResult.rows[0].value) : 0;
        
        // Calculate current bookable week (Sunday-Saturday)
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        
        const response = {
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
          releaseDay,
        };
        
        return res.json(response);
      } finally {
        client.release();
      }
    }

    // Currency drives endpoints
    
    // GET all currency drives
    if (pathname === '/api/currency-drives' && req.method === 'GET') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        // Delete expired drives first
        await client.query('DELETE FROM currency_drives WHERE expires_at < NOW()');
        
        const result = await client.query(`
          SELECT 
            cd.id,
            cd.code,
            cd.vehicle_type,
            cd.date,
            cd.created_by,
            cd.created_at,
            cd.expires_at,
            cd.scans,
            u.username as created_by_username
          FROM currency_drives cd
          LEFT JOIN users u ON cd.created_by = u.id
          ORDER BY cd.created_at DESC
        `);

        const drives = result.rows.map(row => ({
          id: row.id,
          code: row.code,
          vehicleType: row.vehicle_type,
          date: row.date,
          createdBy: row.created_by,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          scans: row.scans,
          createdByUsername: row.created_by_username
        }));

        return res.json(drives);
      } finally {
        client.release();
      }
    }

    // POST create currency drive
    if (pathname === '/api/currency-drives' && req.method === 'POST') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      if (payload.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      try {
        const parsed = insertCurrencyDriveSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid drive data', errors: parsed.error.errors });
        }

        const driveId = randomUUID();
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date(parsed.data.date.getTime() + 24 * 60 * 60 * 1000); // 24 hours after drive date

        const client = await pool.connect();
        try {
          const result = await client.query(`
            INSERT INTO currency_drives (id, code, vehicle_type, date, created_by, expires_at, scans)
            VALUES ($1, $2, $3, $4, $5, $6, 0)
            RETURNING *
          `, [
            driveId,
            code,
            parsed.data.vehicleType,
            parsed.data.date.toISOString().split('T')[0],
            payload.userId,
            expiresAt.toISOString()
          ]);

          const drive = result.rows[0];
          return res.status(201).json(drive);
        } finally {
          client.release();
        }
      } catch (error: any) {
        console.error('Error creating currency drive:', error);
        return res.status(500).json({ message: error.message || 'Failed to create currency drive' });
      }
    }

    // POST scan currency drive
    if (pathname === '/api/currency-drives/scan' && req.method === 'POST') {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      try {
        const { code } = req.body;
        if (!code) {
          return res.status(400).json({ message: 'Code is required' });
        }

        const client = await pool.connect();
        try {
          // Get the drive by code
          const driveResult = await client.query('SELECT * FROM currency_drives WHERE code = $1', [code]);
          if (driveResult.rows.length === 0) {
            return res.status(404).json({ message: 'Invalid drive code' });
          }

          const drive = driveResult.rows[0];

          // Check if drive is expired
          if (new Date(drive.expires_at) < new Date()) {
            return res.status(400).json({ message: 'Drive has expired' });
          }

          // Check if user already scanned this drive
          const existingScan = await client.query(`
            SELECT id FROM currency_drive_scans 
            WHERE drive_id = $1 AND user_id = $2
          `, [drive.id, payload.userId]);

          if (existingScan.rows.length === 0) {
            // Record the scan
            await client.query(`
              INSERT INTO currency_drive_scans (id, drive_id, user_id, scanned_at)
              VALUES ($1, $2, $3, NOW())
            `, [randomUUID(), drive.id, payload.userId]);
          }

          // Update scan count
          const scanCountResult = await client.query(`
            SELECT COUNT(*) as count FROM currency_drive_scans WHERE drive_id = $1
          `, [drive.id]);
          
          const actualScanCount = parseInt(scanCountResult.rows[0].count);
          await client.query(`
            UPDATE currency_drives SET scans = $1 WHERE id = $2
          `, [actualScanCount, drive.id]);

          return res.json({
            id: drive.id,
            code: drive.code,
            vehicleType: drive.vehicle_type,
            date: drive.date,
            scans: actualScanCount,
            scanned: existingScan.rows.length === 0
          });
        } finally {
          client.release();
        }
      } catch (error: any) {
        console.error('Error scanning drive:', error);
        return res.status(500).json({ message: error.message || 'Failed to scan drive' });
      }
    }

    // GET currency drive by code
    if (pathname.startsWith('/api/currency-drives/') && req.method === 'GET' && !pathname.endsWith('/scans')) {
      const code = pathname.split('/').pop();
      
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query('SELECT * FROM currency_drives WHERE code = $1', [code]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Drive not found' });
        }

        const drive = result.rows[0];
        return res.json({
          id: drive.id,
          code: drive.code,
          vehicleType: drive.vehicle_type,
          date: drive.date,
          createdBy: drive.created_by,
          createdAt: drive.created_at,
          expiresAt: drive.expires_at,
          scans: drive.scans
        });
      } finally {
        client.release();
      }
    }

    // DELETE currency drive
    if (pathname.startsWith('/api/currency-drives/') && req.method === 'DELETE' && !pathname.endsWith('/scans')) {
      const driveId = pathname.split('/').pop();
      
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      if (payload.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const client = await pool.connect();
      try {
        // Mark drive as expired by updating expires_at
        await client.query(`
          UPDATE currency_drives SET expires_at = NOW() WHERE id = $1
        `, [driveId]);

        return res.json({ message: 'Drive deleted successfully' });
      } finally {
        client.release();
      }
    }

    return res.status(404).json({ message: 'Endpoint not found' });
  } catch (error) {
    console.error('Data API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
