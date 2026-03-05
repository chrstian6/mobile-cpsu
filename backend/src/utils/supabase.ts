// backend/src/utils/supabase.ts
import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;
const BUCKET = "pwd-id-images";

export const getSupabase = () => {
  if (!_supabase) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        "Supabase env vars not set: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY",
      );
    }

    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      throw new Error(
        `Invalid SUPABASE_URL format: "${url}" — must start with https://`,
      );
    }

    console.log(
      "[Supabase] Initializing client with URL:",
      url.slice(0, 30) + "...",
    );
    _supabase = createClient(url, key);
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
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: mimetype, upsert: true });

    if (error) {
      console.error(`[Supabase] Upload error for ${filePath}:`, error.message);
      return null;
    }

    const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath);
    console.log(`✅ [Supabase] Uploaded ${filePath} → ${data.publicUrl}`);
    return data.publicUrl;
  } catch (err: any) {
    console.error(`[Supabase] Exception for ${filePath}:`, err.message);
    return null;
  }
};

export const uploadBase64ToSupabase = async (
  base64: string,
  filePath: string,
): Promise<string | null> => {
  try {
    // Strip data URI prefix if present: "data:image/jpeg;base64,..."
    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    const mimetype = match ? match[1] : "image/jpeg";
    const data = match ? match[2] : base64;
    const buffer = Buffer.from(data, "base64");

    if (buffer.length === 0) {
      console.warn(`[Supabase] base64 buffer empty for ${filePath}`);
      return null;
    }

    return uploadBufferToSupabase(buffer, mimetype, filePath);
  } catch (err: any) {
    console.error(
      `[Supabase] base64 upload error for ${filePath}:`,
      err.message,
    );
    return null;
  }
};
