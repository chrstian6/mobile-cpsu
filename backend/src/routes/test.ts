// backend/src/routes/test.ts
import { Router } from "express";
import { getSupabase } from "../utils/supabase";

const router = Router();

router.get("/test-supabase", async (req, res) => {
  try {
    const sb = getSupabase();

    // Test 1: List buckets
    const { data: buckets, error: bucketsError } =
      await sb.storage.listBuckets();

    if (bucketsError) {
      return res.status(500).json({
        success: false,
        error: bucketsError.message,
      });
    }

    // Test 2: Check if our bucket exists
    const bucketExists = buckets.some((b) => b.name === "pwd-id-images");

    // Test 3: Try to upload a tiny test file
    const testBuffer = Buffer.from("test");
    const testPath = `test/test-${Date.now()}.txt`;

    const { error: uploadError } = await sb.storage
      .from("pwd-id-images")
      .upload(testPath, testBuffer, {
        contentType: "text/plain",
        upsert: true,
      });

    // Test 4: Get public URL
    const { data: urlData } = sb.storage
      .from("pwd-id-images")
      .getPublicUrl(testPath);

    res.json({
      success: true,
      buckets: buckets.map((b) => b.name),
      bucketExists,
      uploadTest: uploadError ? "failed" : "success",
      uploadError: uploadError?.message,
      publicUrl: urlData.publicUrl,
      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
