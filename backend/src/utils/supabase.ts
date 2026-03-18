// backend/src/utils/supabase.ts
import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;

// ── Bucket names ──────────────────────────────────────────────────────────────

export const BUCKETS = {
  PWD_ID_IMAGES: "pwd-id-images",
  MEDICAL_CERTIFICATES: "medical-certificates",
  PRESCRIPTIONS: "prescriptions",
  BIRTH_CERTIFICATES: "birth-certificates", // ← NEW
  SUPPORTING_DOCUMENTS: "supporting-documents", // ← NEW
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// ── Supabase client (singleton) ───────────────────────────────────────────────

export const getSupabase = () => {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    // Backend uses service role key to bypass RLS for server-side uploads.
    // Falls back to anon key for local dev if service role key is not set.
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase env vars not set: SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY) + EXPO_PUBLIC_SUPABASE_URL",
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

// ── Supported mime types for document/image uploads ───────────────────────────

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/**
 * Parses a data URI and extracts { mimetype, base64Data }.
 * Supports image/* and application/pdf.
 * Falls back to image/jpeg if no data URI prefix is found.
 */
const parseBase64DataUri = (
  base64: string,
): { mimetype: string; base64Data: string } => {
  // Simple, reliable split on the first comma after ";base64,"
  if (base64.startsWith("data:")) {
    const commaIdx = base64.indexOf(",");
    if (commaIdx !== -1) {
      const header = base64.substring(5, commaIdx); // strip "data:"
      const semiIdx = header.indexOf(";");
      const mimetype = semiIdx !== -1 ? header.substring(0, semiIdx) : header;
      const base64Data = base64.substring(commaIdx + 1);
      console.log(
        `[Supabase] Parsed data URI — mime: ${mimetype}, data length: ${base64Data.length}`,
      );
      return { mimetype, base64Data };
    }
  }
  // No prefix — raw base64, assume JPEG
  console.log(`[Supabase] No data URI prefix found, assuming image/jpeg`);
  return { mimetype: "image/jpeg", base64Data: base64 };
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

    const { mimetype, base64Data } = parseBase64DataUri(base64);
    console.log(`[Supabase] Detected mimetype: ${mimetype}`);

    // Append correct extension to filePath if not already present
    const ext = MIME_EXTENSIONS[mimetype];
    const finalPath =
      ext && !filePath.includes(".") ? `${filePath}.${ext}` : filePath;

    const buffer = Buffer.from(base64Data, "base64");
    console.log(`[Supabase] Converted to buffer: ${buffer.length} bytes`);

    if (buffer.length === 0) {
      console.warn(`[Supabase] Empty buffer for ${filePath}`);
      return null;
    }

    return await uploadBufferToSupabase(buffer, mimetype, finalPath, bucket);
  } catch (err: any) {
    console.error(`[Supabase] Base64 error:`, err.message);
    return null;
  }
};
