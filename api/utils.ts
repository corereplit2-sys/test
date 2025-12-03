import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, extractTokenFromHeader, JWTPayload } from '@shared/jwt';

export interface AuthenticatedRequest extends VercelRequest {
  user?: JWTPayload;
}

export function withAuth(handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Add user payload to request
    (req as AuthenticatedRequest).user = payload;
    
    return handler(req as AuthenticatedRequest, res);
  };
}
