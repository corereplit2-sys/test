import { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import * as pg from 'pg';
import jwt from 'jsonwebtoken';

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

    return res.status(404).json({ message: 'Endpoint not found' });
  } catch (error) {
    console.error('Data API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
