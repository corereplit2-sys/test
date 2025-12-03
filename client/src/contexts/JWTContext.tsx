import React, { createContext, useContext, useEffect, useState } from 'react';
import { SafeUser } from '@shared/schema';

interface JWTContextType {
  user: SafeUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const JWTContext = createContext<JWTContextType | undefined>(undefined);

export function JWTProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('jwt_token');
    if (storedToken) {
      setToken(storedToken);
      // Verify token and get user
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Invalid token');
      })
      .then(userData => {
        setUser(userData);
      })
      .catch(() => {
        // Token invalid, remove it
        localStorage.removeItem('jwt_token');
        setToken(null);
      })
      .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    // Prevent multiple simultaneous login attempts
    if (isLoggingIn) {
      console.log('Login already in progress, ignoring duplicate call');
      return { success: false, error: 'Login already in progress' };
    }

    try {
      setIsLoggingIn(true);
      console.log('JWT Login attempt for:', username);
      
      // Complete cleanup of any existing session
      setUser(null);
      setToken(null);
      localStorage.removeItem('jwt_token');
      
      // Force a small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Cleared existing token and state');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Login response:', data);
        
        // Verify the response contains the correct user
        if (data.user && data.user.username === username) {
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('jwt_token', data.token);
          console.log('JWT Login successful for:', data.user.username);
          return { success: true };
        } else {
          console.error('Login response username mismatch:', { expected: username, received: data.user?.username });
          return { success: false, error: 'Account mismatch error' };
        }
      } else {
        const error = await response.json();
        console.log('Login error:', error);
        return { success: false, error: error.message };
      }
    } catch (error) {
      console.log('Login exception:', error);
      return { success: false, error: 'Login failed' };
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = (skipApiCall = false) => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('jwt_token');
    
    if (!skipApiCall) {
      // Only make API call if not just clearing for a new login
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {
        // Ignore errors during logout API call
      });
    }
  };

  return (
    <JWTContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </JWTContext.Provider>
  );
}

export function useJWT() {
  const context = useContext(JWTContext);
  if (context === undefined) {
    throw new Error('useJWT must be used within a JWTProvider');
  }
  return context;
}
