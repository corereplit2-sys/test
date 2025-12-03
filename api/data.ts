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

    // Qualifications endpoint - join with users to get names
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
        // Join with users table to get user names and MSP info
        const result = await client.query(`
          SELECT 
            dq.id,
            dq.user_id,
            dq.vehicle_type,
            dq.qualified_on_date,
            dq.last_drive_date,
            dq.currency_expiry_date,
            u.username,
            u.full_name,
            u.rank,
            u.msp_id,
            m.name as msp_name
          FROM driver_qualifications dq
          LEFT JOIN users u ON dq.user_id = u.id
          LEFT JOIN msps m ON u.msp_id = m.id
          ORDER BY u.full_name
        `);
        
        // Map to frontend expected format
        const qualifications = result.rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          username: row.username,
          fullName: row.full_name,
          rank: row.rank,
          vehicleType: row.vehicle_type,
          qualifiedOnDate: row.qualified_on_date,
          lastDriveDate: row.last_drive_date,
          currencyExpiryDate: row.currency_expiry_date,
          mspId: row.msp_id,
          mspName: row.msp_name,
          // Status logic for frontend
          status: row.currency_expiry_date && new Date(row.currency_expiry_date) > new Date() ? 'current' : 'expired'
        }));
        
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

    // Bookings endpoint for calendar
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
            b.booking_date,
            b.booking_time,
            b.purpose,
            b.status,
            u.full_name,
            u.rank,
            m.name as msp_name
          FROM bookings b
          LEFT JOIN users u ON b.user_id = u.id
          LEFT JOIN msps m ON u.msp_id = m.id
          ORDER BY b.booking_date, b.booking_time
        `);
        
        return res.json(result.rows);
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
