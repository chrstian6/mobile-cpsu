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

  console.log("Auth middleware - Headers:", {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader?.substring(0, 15),
  });

  if (!authHeader?.startsWith("Bearer ")) {
    console.log("No auth header or invalid format");
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  const token = authHeader.split(" ")[1];
  console.log("Token received, length:", token.length);

  try {
    const accessSecret = process.env.JWT_SECRET;
    if (!accessSecret) {
      console.error("JWT_SECRET is not configured");
      res.status(500).json({ message: "Server configuration error." });
      return;
    }

    const payload = jwt.verify(token, accessSecret) as { sub: string };
    console.log("Token verified, userId:", payload.sub);

    req.userId = payload.sub;
    next();
  } catch (err: any) {
    console.error("Token verification error:", {
      name: err.name,
      message: err.message,
      expiredAt: err.expiredAt,
    });

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
