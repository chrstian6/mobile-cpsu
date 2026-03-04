import { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, requireAuth } from "../middleware/auth";
import User from "../models/User";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const signTokens = (userId: string) => {
  // Use JWT_SECRET for access token and JWT_REFRESH_SECRET for refresh token
  const accessSecret = process.env.JWT_SECRET; // Changed from JWT_ACCESS_SECRET
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    console.error("Missing JWT secrets:", {
      JWT_SECRET: !!accessSecret,
      JWT_REFRESH_SECRET: !!refreshSecret,
    });
    throw new Error("JWT secrets are not configured");
  }

  const access_token = jwt.sign(
    { sub: userId },
    accessSecret, // Using JWT_SECRET
    { expiresIn: "15m" },
  );

  const refresh_token = jwt.sign({ sub: userId }, refreshSecret, {
    expiresIn: "7d",
  });

  return { access_token, refresh_token };
};

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      date_of_birth,
      address,
      contact_number,
      email,
      password,
    } = req.body;

    if (
      !first_name ||
      !last_name ||
      !email ||
      !password ||
      !date_of_birth ||
      !contact_number
    ) {
      res.status(400).json({ message: "Please fill in all required fields." });
      return;
    }

    if (password.length < 8) {
      res
        .status(400)
        .json({ message: "Password must be at least 8 characters." });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res
        .status(409)
        .json({ message: "An account with this email already exists." });
      return;
    }

    const user = new User({
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      date_of_birth,
      address,
      contact_number,
      email,
      password,
    });

    await user.save();

    const { access_token, refresh_token } = signTokens(user._id.toString());

    res.status(201).json({
      access_token,
      refresh_token,
      user: user.toPublic(),
    });
  } catch (err: any) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
      res.status(409).json({ message: `${field} is already in use.` });
      return;
    }
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required." });
      return;
    }

    // Explicitly select password field
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    console.log("✅ User found:", user.email);
    console.log("🔑 Hash exists:", !!user.password);

    const isMatch = await user.comparePassword(password);
    console.log("🔐 Password match:", isMatch);

    if (!isMatch) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    if (user.status === "Suspended") {
      res
        .status(403)
        .json({ message: "Your account has been suspended. Contact PDAO." });
      return;
    }

    if (user.status === "Inactive") {
      res.status(403).json({ message: "Your account is inactive." });
      return;
    }

    try {
      const { access_token, refresh_token } = signTokens(user._id.toString());

      res.json({
        access_token,
        refresh_token,
        user: user.toPublic(),
      });
    } catch (tokenError: any) {
      console.error("Token signing error:", tokenError);
      res.status(500).json({
        message: "Error generating authentication tokens. Please try again.",
      });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    res.status(401).json({ message: "No refresh token provided." });
    return;
  }

  try {
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      throw new Error("JWT refresh secret is not configured");
    }

    const payload = jwt.verify(refresh_token, refreshSecret) as { sub: string };

    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ message: "User not found." });
      return;
    }

    const { access_token, refresh_token: new_refresh } = signTokens(
      user._id.toString(),
    );

    res.json({ access_token, refresh_token: new_refresh });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({ message: "Invalid or expired refresh token." });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    res.json({ user: user.toPublic() });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

router.post("/logout", (_req: Request, res: Response) => {
  res.json({ message: "Logged out successfully." });
});

export default router;
