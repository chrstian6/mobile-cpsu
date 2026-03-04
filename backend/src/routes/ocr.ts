// backend/src/routes/ocr.ts
import { Request, Response, Router } from "express";
import multer from "multer";
import { createWorker } from "tesseract.js";
import { AuthRequest } from "../middleware/auth";

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

type OcrRequest = AuthRequest & {
  file?: MulterFile;
};

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ── OCR helpers ───────────────────────────────────────────────────────────────

const cleanTrailing = (str: string): string =>
  str
    .replace(/[\|\[\]{}\\\/]+/g, "")
    .replace(/\s+[A-Z]{1,2}$/, "")
    .replace(/\s+\S{1,3}$/, (m) =>
      /^[a-zA-Z]{1,3}$/.test(m.trim()) && !/^(JR|SR|II|III|IV)$/i.test(m.trim())
        ? ""
        : m,
    )
    .trim();

const DISABILITY_LIST = [
  {
    label: "Deaf or Hard of Hearing",
    patterns: ["deaf", "hard of hearing", "hearing"],
  },
  { label: "Intellectual Disability", patterns: ["intellectual"] },
  { label: "Learning Disability", patterns: ["learning"] },
  { label: "Mental Disability", patterns: ["mental"] },
  {
    label: "Physical Disability (Orthopedic)",
    patterns: ["physical", "orthopedic"],
  },
  { label: "Psychological Disability", patterns: ["psycho", "psychological"] },
  {
    label: "Speech and Language Impairment",
    patterns: ["speech", "language impairment"],
  },
  { label: "Visual Disability", patterns: ["visual", "blind"] },
  { label: "Cancer (RA11215)", patterns: ["cancer"] },
  { label: "Rare Disease (RA19747)", patterns: ["rare disease"] },
  { label: "Autism", patterns: ["autism"] },
  { label: "ADHD", patterns: ["adhd"] },
  { label: "Cerebral Palsy", patterns: ["cerebral palsy"] },
  { label: "Chronic Illness", patterns: ["chronic"] },
  { label: "Congenital / Inborn", patterns: ["congenital", "inborn"] },
  { label: "Injury", patterns: ["injury"] },
] as const;

const matchDisability = (raw: string): string => {
  const lower = raw.toLowerCase();
  for (const { label, patterns } of DISABILITY_LIST) {
    if (patterns.some((p) => lower.includes(p))) return label;
  }
  return raw.replace(/[^A-Za-z\s\-\/()]/g, "").trim();
};

// ── Name validator ────────────────────────────────────────────────────────────
// Accepts ALL CAPS ("JUAN DELA CRUZ") and Title Case ("Erica Gellera")
const isLikelyName = (str: string, skipList: string[]): boolean => {
  const words = str.trim().split(/\s+/);
  if (words.length < 2) return false;
  if (str.length <= 5 || str.length >= 55) return false;
  if (/\d/.test(str)) return false;
  const upper = str.toUpperCase();
  if (skipList.some((kw) => upper.includes(kw))) return false;
  // Each word must start with a capital and contain only letters/dots
  const wordPattern = /^[A-Z][a-zA-Z.]*$/;
  if (!words.every((w) => wordPattern.test(w))) return false;
  return true;
};

const parseIdFront = (text: string) => {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  console.log("Front ID lines:", lines);

  // ── Card ID ──────────────────────────────────────────────────────────────
  const cardIdMatch = text.match(/\b(\d{2}-\d{4}-\d{3}-\d{7})\b/);
  console.log("Card ID:", cardIdMatch?.[1] ?? "Not found");

  // ── Name ─────────────────────────────────────────────────────────────────
  const SKIP = [
    "REPUBLIC",
    "REGION",
    "PROVINCE",
    "MUNICIPALITY",
    "PERSON",
    "DISABILITIES",
    "AFFAIRS",
    "OFFICE",
    "VALID",
    "COUNTRY",
    "PDAO",
    "BARANGAY",
    "SIGNATURE",
    "TYPE",
    "NAME",
    "DATE",
    "BIRTH",
    "ADDRESS",
    "SEX",
    "CIVIL",
    "STATUS",
    "CONTACT",
    "EMERGENCY",
    "PHILIPPINES",
    "GOVERNMENT",
    "NATIONAL",
    "COMMISSION",
    "NCDA",
    "PWD",
    "ID",
    "IDENTIFICATION",
    "DISABILITY",
    "WESTERN",
    "VISAYAS",
    "NEGROS",
    "OCCIDENTAL",
    "HINIGARAN",
    "ANYWHERE",
    "COUNTRY",
  ];

  let name = "";

  // Primary strategy: find "Name" label and take the line above it
  for (let i = 1; i < lines.length; i++) {
    if (/^Name$/i.test(lines[i].trim())) {
      const candidate = lines[i - 1]
        .replace(/[=|~_\/\[\]{}]+/g, "") // strip noise chars
        .replace(/\s+[a-z]{1,4}$/, "") // strip trailing OCR noise e.g. "iy"
        .trim();
      if (isLikelyName(candidate, SKIP)) {
        name = cleanTrailing(candidate);
        console.log("Found name (above Name label):", name);
        break;
      }
    }
  }

  // Fallback: scan all lines for anything that looks like a person's name
  if (!name) {
    for (const line of lines) {
      const candidate = line
        .replace(/[=|~_\/\[\]{}]+/g, "")
        .replace(/\s+[a-z]{1,4}$/, "")
        .trim();
      if (isLikelyName(candidate, SKIP)) {
        name = cleanTrailing(candidate);
        console.log("Found name (fallback scan):", name);
        break;
      }
    }
  }

  // ── Barangay ─────────────────────────────────────────────────────────────
  let barangay = "";
  const brgyMatch = text.match(/Barangay[\s:_]+([A-Za-z][A-Za-z\s]*)/i);
  if (brgyMatch) {
    barangay = brgyMatch[1].trim().split("\n")[0].trim();
    console.log("Found barangay:", barangay);
  }
  if (!barangay) {
    for (let i = 0; i < lines.length; i++) {
      if (/barangay/i.test(lines[i])) {
        const inline = lines[i].replace(/barangay[\s:_]*/i, "").trim();
        if (inline && !SKIP.some((kw) => inline.toUpperCase().includes(kw))) {
          barangay = inline;
        } else if (
          i + 1 < lines.length &&
          !SKIP.some((kw) => lines[i + 1].toUpperCase().includes(kw))
        ) {
          barangay = lines[i + 1];
        }
        if (barangay) {
          console.log("Found barangay (fallback):", barangay);
          break;
        }
      }
    }
  }

  // ── Disability ────────────────────────────────────────────────────────────
  // Value is printed ABOVE the "Type of Disability" label on this card layout
  let disabilityRaw = "";

  for (let i = 0; i < lines.length; i++) {
    if (/type\s+of\s+disability/i.test(lines[i])) {
      // Primary: line BEFORE the label
      if (i > 0) {
        const candidate = lines[i - 1].trim();
        if (
          candidate &&
          !SKIP.some((kw) => candidate.toUpperCase().includes(kw))
        ) {
          disabilityRaw = candidate;
          console.log("Found disability (above label):", disabilityRaw);
          break;
        }
      }
      // Fallback: line AFTER the label
      if (i + 1 < lines.length) {
        disabilityRaw = lines[i + 1];
        console.log("Found disability (below label):", disabilityRaw);
      }
      break;
    }
  }

  // Last resort: keyword scan
  if (!disabilityRaw) {
    for (const { label, patterns } of DISABILITY_LIST) {
      for (const p of patterns) {
        const re = new RegExp(`\\b${p}\\b`, "i");
        if (re.test(text)) {
          disabilityRaw = label;
          console.log("Found disability (keyword scan):", disabilityRaw);
          break;
        }
      }
      if (disabilityRaw) break;
    }
  }

  return {
    card_id: cardIdMatch ? cardIdMatch[1] : "",
    name: name || "Not detected",
    barangay: barangay || "Not detected",
    type_of_disability: matchDisability(disabilityRaw) || "Not detected",
    raw_text: text,
  };
};

const parseIdBack = (text: string) => {
  console.log("Back ID raw text:", text);

  const addressMatch = text.match(/ADDRESS[\s:_]+([^\n]+)/i);
  const address = addressMatch ? addressMatch[1].trim() : "";

  const dobMatch = text.match(
    /DATE\s+OF\s+BIRTH[\s\S]{0,20}?(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{4})/i,
  );
  const dob = dobMatch ? dobMatch[1].replace(/\s/g, "") : "";

  const sexMatch = text.match(/SEX[\s:_]{0,5}(M(?:ale)?|F(?:emale)?)\b/i);
  let sex = "";
  if (sexMatch) {
    const raw = sexMatch[1].toUpperCase();
    sex = raw === "M" || raw === "MALE" ? "Male" : "Female";
  }

  const issuedMatch = text.match(
    /DATE\s+ISSUED[\s\S]{0,20}?(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{4})/i,
  );
  const dateIssued = issuedMatch ? issuedMatch[1].replace(/\s/g, "") : "";

  let bloodType = "";
  const btStandard = text.match(
    /BLOOD\s*TYPE[\s\S]{0,20}?(?<![A-Za-z])(AB|[ABO])\s*([+\-])?/i,
  );
  if (btStandard) {
    bloodType = (btStandard[1] + (btStandard[2] ?? "")).toUpperCase();
  } else {
    const btMisread = text.match(
      /BLOOD\s*TYPE[\s\S]{0,20}?(?<![A-Za-z\d])([09])\s*([%+\-])/i,
    );
    if (btMisread) {
      bloodType = "O" + (["%", "+"].includes(btMisread[2]) ? "+" : "-");
    }
  }

  const emergencyBlock = text.match(/EMERGENCY[\s\S]*?NAME[\s:_]+([^\n]+)/i);
  const emergencyName = emergencyBlock
    ? cleanTrailing(emergencyBlock[1].trim())
    : "";

  const cp1 = text.match(/CONTACT[^0-9\n]{0,25}(0\d{10})/i);
  const cp2 = text.match(/CONTACT[^\n]*\n\s*(0\d{10})/i);
  const cp3 = text.match(/CONTACT[\s\S]{0,40}(0\d{10})/i);
  const cp4 = text.match(/\b(09\d{9})\b/);
  const cpWinner = cp1 || cp2 || cp3 || cp4;
  const contactNo = cpWinner ? cpWinner[1].replace(/\s/g, "").slice(0, 13) : "";

  return {
    address: address || "Not detected",
    date_of_birth: dob || "Not detected",
    sex: sex || "Not detected",
    date_issued: dateIssued || "Not detected",
    blood_type: bloodType || "Not detected",
    emergency_contact_name: emergencyName || "Not detected",
    emergency_contact_number: contactNo || "Not detected",
    raw_text: text,
  };
};

// ── Route ─────────────────────────────────────────────────────────────────────

router.post(
  "/",
  upload.single("image"),
  async (req: OcrRequest, res: Response): Promise<void> => {
    try {
      const side = (req.body?.side as string) ?? "front";

      if (!req.file) {
        res.status(400).json({ error: "No image provided" });
        return;
      }

      console.log(`\n=== Processing ${side} image ===`);
      console.log(
        `File: ${req.file.originalname}, size: ${req.file.size} bytes`,
      );

      const worker = await createWorker("eng");
      const { data } = await worker.recognize(req.file.buffer);
      await worker.terminate();

      console.log(
        `\n[${side}] RAW OCR TEXT:\n${"-".repeat(40)}\n${data.text}\n${"-".repeat(40)}`,
      );

      const result =
        side === "back" ? parseIdBack(data.text) : parseIdFront(data.text);

      console.log(
        `\n[${side}] PARSED RESULT:\n${JSON.stringify(result, null, 2)}\n${"=".repeat(40)}\n`,
      );

      res.json(result);
    } catch (err: any) {
      console.error("[POST /api/ocr] Error:", err);
      res.status(500).json({
        error: err?.message ?? "OCR failed",
        details:
          process.env.NODE_ENV === "development" ? err?.stack : undefined,
      });
    }
  },
);

router.use((err: any, _req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 10MB." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  next(err);
});

export default router;
