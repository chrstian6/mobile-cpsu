import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const accessSecret = process.env.JWT_SECRET; // Changed from JWT_ACCESS_SECRET
    if (!accessSecret) {
      console.error("JWT_SECRET is not configured");
      res.status(500).json({ message: "Server configuration error." });
      return;
    }

    const payload = jwt.verify(
      token,
      accessSecret, // Using JWT_SECRET
    ) as { sub: string };

    req.userId = payload.sub;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ message: "Token expired." });
      return;
    }
    if (err.name === "JsonWebTokenError") {
      res.status(401).json({ message: "Invalid token." });
      return;
    }
    console.error("Auth middleware error:", err);
    res.status(401).json({ message: "Authentication failed." });
  }
};
