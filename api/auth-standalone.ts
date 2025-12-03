import { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import * as pg from 'pg';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Inline schema definitions
interface User {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: "admin" | "soldier" | "commander";
  credits: number;
  rank: string | null;
  mspId: string | null;
}

function generateToken(user: User): string {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };
  
  return jwt.sign(payload, process.env.SESSION_SECRET || 'fallback-secret', { expiresIn: '7d' });
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, process.env.SESSION_SECRET || 'fallback-secret');
  } catch (error) {
    return null;
  }
}

function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
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
    
    if (pathname === '/api/auth/me' && req.method === 'GET') {
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
        const result = await client.query('SELECT id, username, "fullName", role, credits, rank, "mspId" FROM users WHERE id = $1', [payload.userId]);
        const user = result.rows[0];
        
        if (!user) {
          return res.status(401).json({ message: 'User not found' });
        }
        
        return res.json(user);
      } finally {
        client.release();
      }
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
          return res.status(401).json({ message: 'Invalid username or password' });
        }

        const token = generateToken(user);
        const { passwordHash, ...safeUser } = user;
        
        return res.json({
          user: safeUser,
          token: token
        });
      } finally {
        client.release();
      }
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      return res.json({ message: 'Logged out successfully' });
    }

    return res.status(404).json({ message: 'Endpoint not found' });
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
