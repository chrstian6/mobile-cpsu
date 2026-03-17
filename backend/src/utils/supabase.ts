// backend/src/utils/supabase.ts
import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;

// ── Bucket names ──────────────────────────────────────────────────────────────
export const BUCKETS = {
  PWD_ID_IMAGES: "pwd-id-images",
  MEDICAL_CERTIFICATES: "medical-certificates",
  PRESCRIPTIONS: "prescriptions", // Added prescriptions bucket
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

export const getSupabase = () => {
  if (!_supabase) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        "Supabase env vars not set: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY",
      );
    }

    console.log("[Supabase] Initializing client for Node.js");
    _supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabase;
};

// ── Core upload helpers ───────────────────────────────────────────────────────

export const uploadBufferToSupabase = async (
  buffer: Buffer,
  mimetype: string,
  filePath: string,
  bucket: BucketName = BUCKETS.PWD_ID_IMAGES,
): Promise<string | null> => {
  try {
    const sb = getSupabase();
    const cleanPath = filePath.replace(/\/+/g, "/");

    console.log(`[Supabase] Uploading to bucket "${bucket}": ${cleanPath}`);
    console.log(
      `[Supabase] Buffer size: ${buffer.length} bytes, Type: ${mimetype}`,
    );

    const { error, data } = await sb.storage
      .from(bucket)
      .upload(cleanPath, buffer, {
        contentType: mimetype,
        upsert: true,
        cacheControl: "3600",
      });

    if (error) {
      console.error(`[Supabase] Upload error:`, error);
      return null;
    }

    console.log(`[Supabase] Upload successful:`, data);

    const { data: urlData } = sb.storage.from(bucket).getPublicUrl(cleanPath);
    console.log(`✅ [Supabase] Public URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (err: any) {
    console.error(`[Supabase] Exception:`, err.message);
    return null;
  }
};

export const uploadBase64ToSupabase = async (
  base64: string,
  filePath: string,
  bucket: BucketName = BUCKETS.PWD_ID_IMAGES,
): Promise<string | null> => {
  try {
    console.log(
      `[Supabase] Processing base64 upload for ${filePath} → bucket "${bucket}"`,
    );

    let base64Data = base64;
    let mimetype = "image/jpeg";

    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      mimetype = match[1];
      base64Data = match[2];
      console.log(`[Supabase] Detected mimetype from data URI: ${mimetype}`);
    }

    const buffer = Buffer.from(base64Data, "base64");
    console.log(`[Supabase] Converted to buffer: ${buffer.length} bytes`);

    if (buffer.length === 0) {
      console.warn(`[Supabase] Empty buffer for ${filePath}`);
      return null;
    }

    return await uploadBufferToSupabase(buffer, mimetype, filePath, bucket);
  } catch (err: any) {
    console.error(`[Supabase] Base64 error:`, err.message);
    return null;
  }
};
