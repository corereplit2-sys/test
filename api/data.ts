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

    // Qualifications endpoint - use driver_qualifications table with proper field mapping
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
        // First, let's see what columns actually exist
        const columns = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'driver_qualifications' 
          ORDER BY ordinal_position
        `);
        
        console.log('Driver qualifications columns:', columns.rows);
        
        // Get all data to see structure
        const result = await client.query('SELECT * FROM driver_qualifications LIMIT 5');
        console.log('Sample data:', result.rows);
        
        // Return the raw data for now
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
