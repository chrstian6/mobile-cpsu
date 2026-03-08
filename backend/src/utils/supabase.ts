// backend/src/utils/supabase.ts
import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;
const BUCKET = "pwd-id-images";

export const getSupabase = () => {
  if (!_supabase) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; // Use anon key for client operations

    if (!url || !key) {
      throw new Error(
        "Supabase env vars not set: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY",
      );
    }

    console.log("[Supabase] Initializing client for Node.js");
    _supabase = createClient(url, key, {
      auth: {
        persistSession: false, // No need to persist sessions in backend
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabase;
};

export const uploadBufferToSupabase = async (
  buffer: Buffer,
  mimetype: string,
  filePath: string,
): Promise<string | null> => {
  try {
    const sb = getSupabase();

    // Clean the file path
    const cleanPath = filePath.replace(/\/+/g, "/");

    console.log(`[Supabase] Uploading to: ${BUCKET}/${cleanPath}`);
    console.log(
      `[Supabase] Buffer size: ${buffer.length} bytes, Type: ${mimetype}`,
    );

    // Upload the file
    const { error, data } = await sb.storage
      .from(BUCKET)
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

    // Get public URL
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(cleanPath);

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
): Promise<string | null> => {
  try {
    console.log(`[Supabase] Processing base64 upload for ${filePath}`);

    // Handle both with and without data URI prefix
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

    return await uploadBufferToSupabase(buffer, mimetype, filePath);
  } catch (err: any) {
    console.error(`[Supabase] Base64 error:`, err.message);
    return null;
  }
};
