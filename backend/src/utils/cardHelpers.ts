// backend/src/utils/cardHelpers.ts
export const parseDate = (val: string | undefined): Date | null => {
  if (!val || val === "Not detected") return null;
  const mmddyyyy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// No more disability mapping - just return the raw value
export const normalizeDisability = (raw: string): string => {
  if (!raw || raw === "Not detected") return "Not detected";
  return raw.trim(); // Return exactly what was extracted
};

// No more blood type validation - just return the raw value
export const normalizeBloodType = (raw: string): string => {
  if (!raw || raw === "Not detected") return "Not detected";
  return raw.trim(); // Return exactly what was extracted
};
