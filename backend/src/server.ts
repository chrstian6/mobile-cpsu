import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import authRoutes from "./routes/auth";
import cardRoutes from "./routes/cards";
import facapiWebviewRoutes from "./routes/faceapi-webview";
import ocrRoutes from "./routes/ocr";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
app.use("/api/ocr", ocrRoutes);
app.use("/faceapi-webview", facapiWebviewRoutes);

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "PDAO API is running" });
});
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.use("/api/cards", cardRoutes); //

export default app;
