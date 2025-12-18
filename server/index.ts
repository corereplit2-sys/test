import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";

// Load environment variables from .env.local in development
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local" });
}

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  const port = parseInt(process.env.PORT || "5000", 10);

  // only enable reusePort on non-Windows platforms
  const listenOptions: any = { port, host: "0.0.0.0" };
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  // handle listen errors (retry without reusePort / on localhost)
  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error("server error:", err?.code ?? err);
    if (
      err &&
      (err.code === "ENOTSUP" || err.code === "EOPNOTSUPP" || err.code === "EADDRNOTAVAIL")
    ) {
      console.warn("listen failed (unsupported). Retrying without reusePort on 127.0.0.1...");
      try {
        server.listen({ port, host: "0.0.0.0" }, () => {
          log(`serving on 0.0.0.0:${port} (accessible from all devices)`);
        });
      } catch (e) {
        console.error("fallback listen also failed:", (e as Error).message);
        process.exit(1);
      }
      return;
    }
    process.exit(1);
  });

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
