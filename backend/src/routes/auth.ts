// backend/src/routes/auth.ts
import axios from "axios";
import { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, requireAuth } from "../middleware/auth";
import User, { generateUserId } from "../models/User";

const router = Router();

// ── SMS Helper ────────────────────────────────────────────────────────────────

const IPROG_SMS_API = "https://www.iprogsms.com/api/v1/sms_messages";
const IPROG_API_TOKEN = process.env.IPROG_SMS_API_TOKEN;

// SMS Provider codes from IPROG documentation
const SMS_PROVIDERS = {
  DEFAULT: 0, // Default provider (works with Globe/TM/DITO/GOMO)
  SMART: 1, // Alternative provider for Smart/TNT
  SMART_ALT: 2, // Another alternative for Smart/TNT
};

interface SMSResponse {
  status: number;
  message: string;
  message_id: string;
}

/**
 * Detect mobile network based on phone number prefix
 * Philippines mobile prefixes:
 * - Globe/TM: 817, 905, 906, 915, 916, 917, 926, 927, 935, 936, 937, 945, 955, 956, 965, 966, 975, 976, 977, 978, 979, 994, 995, 996, 997
 * - Smart/TNT: 813, 907, 908, 909, 910, 911, 912, 913, 914, 918, 919, 920, 921, 928, 929, 930, 938, 939, 940, 946, 947, 948, 949, 950, 951, 961, 970, 981, 989, 992, 998, 999
 * - DITO: 895, 896, 897, 898, 991, 992, 993, 994, 995
 */
const detectNetwork = (
  phoneNumber: string,
): "globe" | "smart" | "dito" | "unknown" => {
  // Clean the phone number to get just the digits
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Get the first 5 digits after 0 or 63 for network detection
  let prefix = "";
  if (cleaned.startsWith("63")) {
    prefix = cleaned.substring(2, 7); // Get 5 digits after 63
  } else if (cleaned.startsWith("0")) {
    prefix = cleaned.substring(1, 6); // Get 5 digits after 0
  } else {
    prefix = cleaned.substring(0, 5);
  }

  console.log(`[SMS] Detecting network for prefix: ${prefix}`);

  // Globe/TM prefixes
  const globePrefixes = [
    "817",
    "905",
    "906",
    "915",
    "916",
    "917",
    "926",
    "927",
    "935",
    "936",
    "937",
    "945",
    "955",
    "956",
    "965",
    "966",
    "975",
    "976",
    "977",
    "978",
    "979",
    "994",
    "995",
    "996",
    "997",
  ];

  // Smart/TNT prefixes
  const smartPrefixes = [
    "813",
    "907",
    "908",
    "909",
    "910",
    "911",
    "912",
    "913",
    "914",
    "918",
    "919",
    "920",
    "921",
    "928",
    "929",
    "930",
    "938",
    "939",
    "940",
    "946",
    "947",
    "948",
    "949",
    "950",
    "951",
    "961",
    "970",
    "981",
    "989",
    "992",
    "998",
    "999",
  ];

  // DITO prefixes
  const ditoPrefixes = [
    "895",
    "896",
    "897",
    "898",
    "991",
    "992",
    "993",
    "994",
    "995",
  ];

  // Check each prefix in the first 5 digits
  for (let i = 0; i <= 2; i++) {
    const testPrefix = prefix.substring(0, 3 + i);

    if (globePrefixes.some((p) => testPrefix.startsWith(p))) {
      return "globe";
    }
    if (smartPrefixes.some((p) => testPrefix.startsWith(p))) {
      return "smart";
    }
    if (ditoPrefixes.some((p) => testPrefix.startsWith(p))) {
      return "dito";
    }
  }

  return "unknown";
};

/**
 * Get the appropriate SMS provider based on network
 */
const getSmsProvider = (phoneNumber: string): number => {
  const network = detectNetwork(phoneNumber);

  console.log(`[SMS] Network detected: ${network} for phone: ${phoneNumber}`);

  switch (network) {
    case "globe":
    case "dito":
      return SMS_PROVIDERS.DEFAULT; // Default works for Globe/TM/DITO
    case "smart":
      // Try alternative providers for Smart/TNT
      // You might need to get a registered sender name from IPROG
      return SMS_PROVIDERS.SMART_ALT; // Try alternative provider
    default:
      return SMS_PROVIDERS.DEFAULT;
  }
};

/**
 * Format Philippine phone number to international format
 * Converts 09xxxxxxxxx to 63xxxxxxxxx
 */
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    return "63" + cleaned.substring(1);
  }

  if (cleaned.startsWith("63")) {
    return cleaned;
  }

  return "63" + cleaned;
};

/**
 * Send SMS notification via IPROG SMS with dynamic provider selection
 */
const sendSMS = async (
  phoneNumber: string,
  message: string,
): Promise<SMSResponse | null> => {
  try {
    if (!IPROG_API_TOKEN) {
      console.error("IPROG SMS API token not configured");
      return null;
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Detect network and get appropriate provider
    const provider = getSmsProvider(phoneNumber);

    console.log(`[SMS] Sending to ${formattedPhone} with provider ${provider}`);

    // Try with detected provider
    try {
      const response = await axios.post(
        IPROG_SMS_API,
        {
          api_token: IPROG_API_TOKEN,
          phone_number: formattedPhone,
          message: message,
          sms_provider: provider,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      console.log("[SMS] Sent successfully:", response.data);
      return response.data;
    } catch (error: any) {
      // If failed with detected provider, try fallback providers
      console.log(
        `[SMS] Failed with provider ${provider}, trying fallbacks...`,
      );

      // Try fallback providers
      const fallbackProviders = [
        SMS_PROVIDERS.DEFAULT,
        SMS_PROVIDERS.SMART,
        SMS_PROVIDERS.SMART_ALT,
      ].filter((p) => p !== provider); // Don't retry the same provider

      for (const fallbackProvider of fallbackProviders) {
        try {
          console.log(`[SMS] Trying fallback provider ${fallbackProvider}`);

          const fallbackResponse = await axios.post(
            IPROG_SMS_API,
            {
              api_token: IPROG_API_TOKEN,
              phone_number: formattedPhone,
              message: message,
              sms_provider: fallbackProvider,
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 10000,
            },
          );

          console.log(
            `[SMS] Sent successfully with fallback provider ${fallbackProvider}:`,
            fallbackResponse.data,
          );
          return fallbackResponse.data;
        } catch (fallbackError: any) {
          console.log(
            `[SMS] Fallback provider ${fallbackProvider} failed:`,
            fallbackError.response?.data,
          );
        }
      }

      // If all providers failed, throw the original error
      throw error;
    }
  } catch (error: any) {
    console.error("[SMS] All providers failed:", {
      error: error.message,
      response: error.response?.data,
    });

    // Log the specific error for Smart/TNT
    if (error.response?.data?.message?.includes("Smart/TNT")) {
      console.error(
        "[SMS] Smart/TNT networks require registered sender name. Please register at: https://www.iprogsms.com/sender-names/new",
      );
    }

    return null;
  }
};

/**
 * Generate welcome SMS message for new user
 */
const getWelcomeMessage = (firstName: string): string => {
  const appName = "PDAO-RAM";
  const currentYear = new Date().getFullYear();

  // Keep message concise to avoid issues
  return `Welcome to ${appName}, ${firstName}! Your PDAO account is now active. Thank you for registering! - PDAO`;
};

// ── Token Helpers ─────────────────────────────────────────────────────────────

const signTokens = (userId: string, customUserId: string) => {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    console.error("Missing JWT secrets:", {
      JWT_SECRET: !!accessSecret,
      JWT_REFRESH_SECRET: !!refreshSecret,
    });
    throw new Error("JWT secrets are not configured");
  }

  const access_token = jwt.sign(
    { sub: userId, userId: customUserId },
    accessSecret,
    { expiresIn: "15m" },
  );

  const refresh_token = jwt.sign(
    { sub: userId, userId: customUserId, tokenType: "refresh" },
    refreshSecret,
    { expiresIn: "7d" },
  );

  return { access_token, refresh_token };
};

/**
 * Save a new user with automatic retry on user_id collision
 */
const saveUserWithRetry = async (user: any, maxRetries = 5): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await user.save();
      console.log(`[Auth] User saved successfully on attempt ${attempt}`);
      return;
    } catch (err: any) {
      if (err.code === 11000) {
        const collidingField = Object.keys(err.keyPattern || {})[0];
        console.warn(
          `[Register] Collision on field: ${collidingField} on attempt ${attempt}`,
        );

        if (collidingField === "user_id") {
          console.warn(
            `[Register] user_id collision on attempt ${attempt}, regenerating...`,
          );
          user.user_id = generateUserId();
          continue;
        } else if (
          collidingField === "pwd_issued_id" ||
          collidingField === "form_id" ||
          collidingField === "card_id"
        ) {
          console.warn(
            `[Register] ${collidingField} collision, setting to undefined`,
          );
          user[collidingField] = undefined;
          continue;
        } else if (
          collidingField === "email" ||
          collidingField === "contact_number"
        ) {
          console.error(`[Register] Critical collision on ${collidingField}`);
          throw err;
        }
      }
      throw err;
    }
  }
  throw new Error(
    "Failed to generate a unique user ID after multiple attempts. Please try again.",
  );
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

    // Validate required fields
    if (
      !first_name ||
      !last_name ||
      !email ||
      !password ||
      !date_of_birth ||
      !contact_number
    ) {
      res.status(400).json({
        message:
          "Please fill in all required fields: first name, last name, email, password, date of birth, and contact number.",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: "Invalid email format." });
      return;
    }

    // Validate password length
    if (password.length < 8) {
      res
        .status(400)
        .json({ message: "Password must be at least 8 characters." });
      return;
    }

    // Validate contact number
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(contact_number)) {
      res.status(400).json({
        message: "Contact number must start with 09 and be 11 digits.",
      });
      return;
    }

    // Validate date of birth
    const dob = new Date(date_of_birth);
    if (isNaN(dob.getTime())) {
      res
        .status(400)
        .json({ message: "Invalid date of birth format. Use YYYY-MM-DD." });
      return;
    }
    if (dob > new Date()) {
      res
        .status(400)
        .json({ message: "Date of birth cannot be in the future." });
      return;
    }

    // Check duplicates
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      res
        .status(409)
        .json({ message: "An account with this email already exists." });
      return;
    }

    const existingPhone = await User.findOne({ contact_number });
    if (existingPhone) {
      res.status(409).json({
        message: "An account with this contact number already exists.",
      });
      return;
    }

    // Validate sex enum
    if (sex && !["Male", "Female", "Other"].includes(sex)) {
      res.status(400).json({ message: "Sex must be Male, Female, or Other." });
      return;
    }

    // Validate suffix enum
    if (
      suffix &&
      !["Jr.", "Sr.", "II", "III", "IV", "V", ""].includes(suffix)
    ) {
      res.status(400).json({ message: "Invalid suffix value." });
      return;
    }

    // Generate initial user_id
    const initialUserId = generateUserId();
    console.log(`[Register] Generated initial user_id: ${initialUserId}`);

    // Build user document
    const userData = {
      user_id: initialUserId,
      first_name,
      middle_name: middle_name || "",
      last_name,
      suffix: suffix || "",
      sex: sex || "Other",
      date_of_birth: dob,
      address: {
        street: address?.street || "",
        barangay: address?.barangay || "",
        city_municipality: address?.city_municipality || "",
        province: address?.province || "",
        region: address?.region || "",
        zip_code: address?.zip_code || "",
        country: address?.country || "Philippines",
        type: address?.type || "Permanent",
        ...(address?.coordinates && { coordinates: address.coordinates }),
      },
      contact_number,
      email: email.toLowerCase(),
      password,
      role: "User",
      status: "Active",
      is_verified: false,
      is_email_verified: false,
      pwd_issued_id: undefined,
      form_id: undefined,
      card_id: undefined,
      avatar_url: undefined,
      created_by: undefined,
      updated_by: undefined,
    };

    const user = new User(userData);

    // Save with retry logic
    await saveUserWithRetry(user);
    console.log(
      "[Auth] User registered successfully with user_id:",
      user.user_id,
    );

    // ── Send Welcome SMS (non-blocking) ─────────────────────────────────────
    const welcomeMessage = getWelcomeMessage(user.first_name);

    // Send SMS in background
    sendSMS(user.contact_number, welcomeMessage)
      .then((smsResult) => {
        if (smsResult) {
          console.log(
            `[SMS] Welcome SMS sent to ${user.contact_number}, ID: ${smsResult.message_id}`,
          );
        } else {
          console.log(
            `[SMS] Failed to send welcome SMS to ${user.contact_number}`,
          );
        }
      })
      .catch((err) => {
        console.error(`[SMS] Error sending welcome SMS:`, err);
      });
    // ────────────────────────────────────────────────────────────────────────

    const { access_token, refresh_token } = signTokens(
      user._id.toString(),
      user.user_id,
    );

    res.status(201).json({
      access_token,
      refresh_token,
      user: user.toPublic(),
      sms_notification: {
        sent: true,
        message: "Welcome SMS will be sent to your registered number.",
      },
    });
  } catch (err: any) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      console.error(
        `[Register] Duplicate key on field: ${field}, value:`,
        err.keyValue?.[field],
      );

      let message = "An account with this information already exists.";
      if (field === "email")
        message = "An account with this email already exists.";
      else if (field === "contact_number")
        message = "An account with this contact number already exists.";
      else if (field === "user_id")
        message = "Failed to generate a unique user ID. Please try again.";
      else if (field === "form_id")
        message = "Form ID conflict. Please try again.";
      else if (field === "card_id")
        message = "Card ID conflict. Please try again.";
      else if (field === "pwd_issued_id")
        message = "PWD ID conflict. Please try again.";

      res.status(409).json({ message });
      return;
    }

    console.error("Register error:", err);
    res
      .status(500)
      .json({ message: err.message || "Server error. Please try again." });
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

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    if (user.status === "Suspended") {
      res.status(403).json({
        message:
          "Your account has been suspended. Please contact PDAO office for assistance.",
      });
      return;
    }

    if (user.status === "Inactive") {
      res.status(403).json({
        message:
          "Your account is inactive. Please contact PDAO office to reactivate.",
      });
      return;
    }

    if (user.status === "Pending") {
      res.status(403).json({
        message:
          "Your account is pending approval. Please wait for verification.",
      });
      return;
    }

    try {
      const { access_token, refresh_token } = signTokens(
        user._id.toString(),
        user.user_id,
      );

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
    if (!refreshSecret) throw new Error("JWT refresh secret is not configured");

    let payload;
    try {
      payload = jwt.verify(refresh_token, refreshSecret) as {
        sub: string;
        userId: string;
        tokenType?: string;
      };
    } catch (err: any) {
      console.error("Refresh token verification failed:", err.message);

      if (err.name === "TokenExpiredError") {
        res.status(401).json({
          message: "Refresh token expired. Please login again.",
          code: "REFRESH_TOKEN_EXPIRED",
        });
        return;
      }
      if (err.name === "JsonWebTokenError") {
        res.status(401).json({
          message: "Invalid refresh token.",
          code: "INVALID_REFRESH_TOKEN",
        });
        return;
      }
      throw err;
    }

    if (payload.tokenType && payload.tokenType !== "refresh") {
      res.status(401).json({
        message: "Invalid token type.",
        code: "INVALID_TOKEN_TYPE",
      });
      return;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({
        message: "User not found.",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    if (user.status !== "Active") {
      res.status(403).json({
        message: "Account is not active.",
        code: "ACCOUNT_INACTIVE",
      });
      return;
    }

    console.log("[Auth] Token refresh successful for user:", user.user_id);

    const { access_token, refresh_token: new_refresh } = signTokens(
      user._id.toString(),
      user.user_id,
    );

    res.json({
      access_token,
      refresh_token: new_refresh,
      user: user.toPublic(),
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({
      message: "Invalid or expired refresh token.",
      code: "REFRESH_FAILED",
    });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ user_id: req.userId });

    if (!user) {
      console.log("[Auth] User not found for user_id:", req.userId);
      res.status(404).json({ message: "User not found." });
      return;
    }

    if (user.status !== "Active" && user.status !== "Pending") {
      res.status(403).json({ message: "Account is not active." });
      return;
    }

    res.json({ user: user.toPublic() });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

router.post("/logout", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    console.log("[Auth] User logged out:", req.userId);
    res.json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Server error during logout." });
  }
});

// ── POST /api/auth/change-password ────────────────────────────────────────────

router.post(
  "/change-password",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        res
          .status(400)
          .json({ message: "Current password and new password are required." });
        return;
      }

      if (new_password.length < 8) {
        res
          .status(400)
          .json({ message: "New password must be at least 8 characters." });
        return;
      }

      const user = await User.findOne({ user_id: req.userId }).select(
        "+password",
      );
      if (!user) {
        res.status(404).json({ message: "User not found." });
        return;
      }

      const isMatch = await user.comparePassword(current_password);
      if (!isMatch) {
        res.status(401).json({ message: "Current password is incorrect." });
        return;
      }

      user.password = new_password;
      await user.save();

      res.json({ success: true, message: "Password changed successfully." });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ message: "Server error." });
    }
  },
);

// ── PATCH /api/auth/update-profile ────────────────────────────────────────────

router.patch(
  "/update-profile",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        first_name,
        middle_name,
        last_name,
        suffix,
        sex,
        address,
        contact_number,
      } = req.body;

      const user = await User.findOne({ user_id: req.userId });
      if (!user) {
        res.status(404).json({ message: "User not found." });
        return;
      }

      if (first_name) user.first_name = first_name;
      if (middle_name !== undefined) user.middle_name = middle_name;
      if (last_name) user.last_name = last_name;
      if (suffix !== undefined) user.suffix = suffix;
      if (sex && ["Male", "Female", "Other"].includes(sex)) user.sex = sex;

      if (contact_number) {
        const phoneRegex = /^09\d{9}$/;
        if (!phoneRegex.test(contact_number)) {
          res.status(400).json({
            message: "Contact number must start with 09 and be 11 digits.",
          });
          return;
        }

        const existingPhone = await User.findOne({
          contact_number,
          user_id: { $ne: req.userId },
        });
        if (existingPhone) {
          res.status(409).json({ message: "Contact number already in use." });
          return;
        }

        user.contact_number = contact_number;
      }

      if (address) {
        user.address = { ...user.address, ...address };
      }

      user.updated_by = req.userId;
      await user.save();

      res.json({
        success: true,
        message: "Profile updated successfully.",
        user: user.toPublic(),
      });
    } catch (err) {
      console.error("Update profile error:", err);
      res.status(500).json({ message: "Server error." });
    }
  },
);

export default router;
