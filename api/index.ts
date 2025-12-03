import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { registerRoutes } from '../server/routes';

const app = express();

// Setup Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Register all routes
let server: any;
registerRoutes(app).then((s) => {
  server = s;
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Mock Express request/response
  const expressReq = req as any;
  const expressRes = res as any;

  // Add Express methods to Vercel response
  expressRes.status = (code: number) => {
    res.statusCode = code;
    return expressRes;
  };
  
  expressRes.json = (data: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return expressRes;
  };

  expressRes.end = res.end.bind(res);
  expressRes.setHeader = res.setHeader.bind(res);

  // Handle the request with Express
  app(expressReq, expressRes);
}
