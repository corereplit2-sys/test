import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';
import * as bcrypt from 'bcryptjs';
import { loginSchema, changePasswordSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { users } from '@shared/schema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { pathname } = new URL(req.url || '', 'http://localhost');
    
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      // Get current user
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const { password, ...safeUser } = user;
      return res.json(safeUser);
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      // Login
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid input' });
      }

      const { username, password } = result.data;
      const user = await storage.getUserByUsername(username);
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      const { password: _, ...safeUser } = user;
      return res.json(safeUser);
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      // Logout
      req.session?.destroy();
      return res.json({ message: 'Logged out successfully' });
    }

    if (pathname === '/api/auth/change-password' && req.method === 'POST') {
      // Change password
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const result = changePasswordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid input' });
      }

      const { currentPassword, newPassword } = result.data;
      const user = await storage.getUser(userId);
      
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedPassword });
      
      return res.json({ message: 'Password changed successfully' });
    }

    return res.status(404).json({ message: 'Endpoint not found' });
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
