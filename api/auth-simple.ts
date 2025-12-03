import { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import * as pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

function generateToken(user: any): string {
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

      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.userId));
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const { passwordHash, ...safeUser } = user;
      return res.json(safeUser);
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' });
      }

      const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
      
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      const token = generateToken(user);
      const { passwordHash, ...safeUser } = user;
      
      return res.json({
        user: safeUser,
        token: token
      });
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
