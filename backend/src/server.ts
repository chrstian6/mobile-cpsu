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
import cashAssistanceRoutes from "./routes/cash-assistance"; // ← NEW
import facapiWebviewRoutes from "./routes/faceapi-webview";
import ocrRoutes from "./routes/ocr";
import testRouter from "./routes/test";

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
app.use("/api/cash-assistance", cashAssistanceRoutes); // ← NEW
app.use("/faceapi-webview", facapiWebviewRoutes);
app.use("/api/test", testRouter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "PDAO API is running" });
});
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ── MongoDB + start ───────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

export default app;
