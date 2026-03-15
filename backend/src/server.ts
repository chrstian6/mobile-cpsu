// backend/src/server.ts
import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import path from "path";

// ── Load .env before anything else ───────────────────────────────────────────
dotenv.config({ path: path.join(__dirname, "../.env") });

// ── Route imports ─────────────────────────────────────────────────────────────
import applicationRoutes from "./routes/applications";
import authRoutes from "./routes/auth";
import cardRoutes from "./routes/cards";
import cashAssistanceRoutes from "./routes/cash-assistance";
import facapiWebviewRoutes from "./routes/faceapi-webview";
import ocrRoutes from "./routes/ocr";
import testRouter from "./routes/test";

// NEW: Import items and requests routes
import itemsRoutes from "./routes/item";
import requestsRoutes from "./routes/request";

// ── Validate required env vars ────────────────────────────────────────────────
const REQUIRED_ENV = ["JWT_SECRET", "JWT_REFRESH_SECRET", "MONGODB_URI"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    "❌ Missing required environment variables:",
    missing.join(", "),
  );
  process.exit(1);
}

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Static: face-api models ───────────────────────────────────────────────────
app.use(
  "/face-models",
  express.static(path.join(__dirname, "../../face-models")),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/cash-assistance", cashAssistanceRoutes);
app.use("/faceapi-webview", facapiWebviewRoutes);
app.use("/api/test", testRouter);

// NEW: Items and Requests routes
app.use("/api/items", itemsRoutes);
app.use("/api/requests", requestsRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "PDAO API is running",
    endpoints: {
      auth: "/api/auth",
      cards: "/api/cards",
      ocr: "/api/ocr",
      applications: "/api/applications",
      cashAssistance: "/api/cash-assistance",
      items: "/api/items",
      requests: "/api/requests",
      faceapi: "/faceapi-webview",
      test: "/api/test",
      health: "/health",
    },
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── 404 handler for undefined routes ──────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    message: "The requested endpoint does not exist",
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// ── MongoDB + start ───────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log("✅ MongoDB connected");

    // Log all registered routes for debugging
    console.log("\n📋 Registered Routes:");
    console.log("  └─ /api/auth");
    console.log("  └─ /api/cards");
    console.log("  └─ /api/ocr");
    console.log("  └─ /api/applications");
    console.log("  └─ /api/cash-assistance");
    console.log("  └─ /api/items");
    console.log("  └─ /api/requests");
    console.log("  └─ /faceapi-webview");
    console.log("  └─ /api/test");
    console.log("  └─ /health");
    console.log();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 API Base URL: http://localhost:${PORT}`);
      console.log(`🔍 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

export default app;
