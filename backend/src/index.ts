import * as dotenv from "dotenv";
dotenv.config();

// All other imports AFTER dotenv.config()
import mongoose from "mongoose";
import app from "./server";

const PORT = parseInt(process.env.PORT || "3000", 10); // Parse as number
const MONGODB_URI = process.env.MONGODB_URI as string;

// Validate required environment variables
const requiredEnvVars = ["JWT_SECRET", "JWT_REFRESH_SECRET", "MONGODB_URI"];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", "),
  );
  console.error("Please check your .env file");
  process.exit(1);
}

// Validate JWT secrets length
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn(
    "⚠️  JWT_SECRET is less than 32 characters. Consider using a stronger secret.",
  );
}

if (
  process.env.JWT_REFRESH_SECRET &&
  process.env.JWT_REFRESH_SECRET.length < 32
) {
  console.warn(
    "⚠️  JWT_REFRESH_SECRET is less than 32 characters. Consider using a stronger secret.",
  );
}

console.log("✅ Environment variables validated");
console.log(
  "📝 Using JWT_SECRET for access tokens and JWT_REFRESH_SECRET for refresh tokens",
);

// MongoDB connection with better error handling
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    // Listen on all network interfaces (0.0.0.0) to allow connections from other devices
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Access from mobile: http://YOUR_COMPUTER_IP:${PORT}`);
      console.log(`📍 Local access: http://localhost:${PORT}`);
      console.log(`🌐 Network access: http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});
