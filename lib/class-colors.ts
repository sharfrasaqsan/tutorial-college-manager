export interface ClassColorTheme {
  id: string;
  name: string;
  hex: string;          // Main brand / swatch hex
  accent: string;       // Accent / border stripe hex
  bg: string;           // Tinted container bg hex
  border: string;       // Container border hex
  text: string;         // Dark readable text hex
  badgeBg: string;      // Pill badge bg hex
  badgeText: string;    // Pill badge text hex
  badgeBorder: string;  // Pill badge border hex
}

export const CLASS_COLOR_PALETTE: ClassColorTheme[] = [
  {
    id: "blue",
    name: "Royal Blue",
    hex: "#2563EB",
    accent: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    text: "#1E40AF",
    badgeBg: "#DBEAFE",
    badgeText: "#1E3A8A",
    badgeBorder: "#93C5FD",
  },
  {
    id: "indigo",
    name: "Deep Indigo",
    hex: "#4F46E5",
    accent: "#4F46E5",
    bg: "#EEF2FF",
    border: "#C7D2FE",
    text: "#3730A3",
    badgeBg: "#E0E7FF",
    badgeText: "#312E81",
    badgeBorder: "#A5B4FC",
  },
  {
    id: "emerald",
    name: "Emerald Green",
    hex: "#059669",
    accent: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    text: "#065F46",
    badgeBg: "#D1FAE5",
    badgeText: "#064E3B",
    badgeBorder: "#6EE7B7",
  },
  {
    id: "purple",
    name: "Violet Purple",
    hex: "#7C3AED",
    accent: "#7C3AED",
    bg: "#FAF5FF",
    border: "#DDD6FE",
    text: "#5B21B6",
    badgeBg: "#EDE9FE",
    badgeText: "#4C1D95",
    badgeBorder: "#C4B5FD",
  },
  {
    id: "rose",
    name: "Crimson Rose",
    hex: "#E11D48",
    accent: "#E11D48",
    bg: "#FFF1F2",
    border: "#FECDD3",
    text: "#9F1239",
    badgeBg: "#FFE4E6",
    badgeText: "#881337",
    badgeBorder: "#FDA4AF",
  },
  {
    id: "amber",
    name: "Amber Gold",
    hex: "#D97706",
    accent: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#92400E",
    badgeBg: "#FEF3C7",
    badgeText: "#78350F",
    badgeBorder: "#FCD34D",
  },
  {
    id: "teal",
    name: "Ocean Teal",
    hex: "#0D9488",
    accent: "#0D9488",
    bg: "#F0FDFA",
    border: "#99F6E4",
    text: "#115E59",
    badgeBg: "#CCFBF1",
    badgeText: "#134E4A",
    badgeBorder: "#5EEAD4",
  },
  {
    id: "orange",
    name: "Sunset Orange",
    hex: "#EA580C",
    accent: "#EA580C",
    bg: "#FFF7ED",
    border: "#FED7AA",
    text: "#9A3412",
    badgeBg: "#FFEDD5",
    badgeText: "#7C2D12",
    badgeBorder: "#FDBA74",
  },
  {
    id: "sky",
    name: "Sky Blue",
    hex: "#0284C7",
    accent: "#0284C7",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    text: "#075985",
    badgeBg: "#E0F2FE",
    badgeText: "#0C4A6E",
    badgeBorder: "#7DD3FC",
  },
  {
    id: "pink",
    name: "Ruby Pink",
    hex: "#DB2777",
    accent: "#DB2777",
    bg: "#FDF2F8",
    border: "#FBCFE8",
    text: "#9D174D",
    badgeBg: "#FCE7F3",
    badgeText: "#831843",
    badgeBorder: "#F472B6",
  },
  {
    id: "lime",
    name: "Lime Green",
    hex: "#65A30D",
    accent: "#65A30D",
    bg: "#F7FEE7",
    border: "#D9F99D",
    text: "#3F6212",
    badgeBg: "#ECFCCB",
    badgeText: "#365314",
    badgeBorder: "#BEF264",
  },
  {
    id: "slate",
    name: "Slate Bronze",
    hex: "#475569",
    accent: "#475569",
    bg: "#F8FAFC",
    border: "#CBD5E1",
    text: "#334155",
    badgeBg: "#E2E8F0",
    badgeText: "#1E293B",
    badgeBorder: "#94A3B8",
  },
];

export const CLASS_COLORS_BY_ID: Record<string, ClassColorTheme> = Object.fromEntries(
  CLASS_COLOR_PALETTE.map((c) => [c.id, c])
);

export const DEFAULT_SUBJECT_COLORS: Record<string, string> = {
  english: "blue",
  eng: "blue",
  maths: "indigo",
  mat: "indigo",
  mathematics: "indigo",
  science: "emerald",
  sci: "emerald",
  ict: "purple",
  computer: "purple",
  it: "purple",
  tamil: "orange",
  tam: "orange",
  sinhala: "amber",
  sin: "amber",
  history: "slate",
  his: "slate",
  commerce: "teal",
  business: "teal",
  accounting: "teal",
  art: "pink",
  music: "pink",
  health: "lime",
  pe: "lime",
};

/**
 * High-contrast, diverse mapping for grade + subject combinations
 * Ensures that classes across different grades and subjects have vibrant, non-overlapping colors.
 */
export const CLASS_COMBINATION_COLORS: Record<string, string> = {
  // Grade 06
  "grade 06 english": "blue",
  "grade 6 english": "blue",
  "grade 06 maths": "amber",
  "grade 6 maths": "amber",
  "grade 06 mathematics": "amber",
  "grade 6 mathematics": "amber",
  "grade 06 science": "emerald",
  "grade 6 science": "emerald",
  "grade 06 ict": "purple",
  "grade 6 ict": "purple",

  // Grade 07
  "grade 07 english": "rose",
  "grade 7 english": "rose",
  "grade 07 maths": "indigo",
  "grade 7 maths": "indigo",
  "grade 07 mathematics": "indigo",
  "grade 7 mathematics": "indigo",
  "grade 07 science": "teal",
  "grade 7 science": "teal",
  "grade 07 ict": "pink",
  "grade 7 ict": "pink",

  // Grade 08
  "grade 08 english": "sky",
  "grade 8 english": "sky",
  "grade 08 maths": "orange",
  "grade 8 maths": "orange",
  "grade 08 mathematics": "orange",
  "grade 8 mathematics": "orange",
  "grade 08 science": "lime",
  "grade 8 science": "lime",
  "grade 08 ict": "slate",
  "grade 8 ict": "slate",

  // Grade 09
  "grade 09 english": "blue",
  "grade 9 english": "blue",
  "grade 09 maths": "amber",
  "grade 9 maths": "amber",
  "grade 09 science": "emerald",
  "grade 9 science": "emerald",
  "grade 09 ict": "purple",
  "grade 9 ict": "purple",

  // Grade 10
  "grade 10 english": "rose",
  "grade 10 maths": "indigo",
  "grade 10 science": "teal",
  "grade 10 ict": "pink",

  // Grade 11
  "grade 11 english": "sky",
  "grade 11 maths": "orange",
  "grade 11 science": "lime",
  "grade 11 ict": "slate",
};

/**
 * Deterministically hash any string into one of the palette colors.
 */
function hashStringToColor(str: string): ClassColorTheme {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CLASS_COLOR_PALETTE.length;
  return CLASS_COLOR_PALETTE[index];
}

/**
 * Resolves the color theme for a class, subject, or identifier.
 * Priority:
 * 1. Explicit color ID if specified and recognized in CLASS_COLOR_PALETTE
 * 2. Specific grade + subject or class name combination mapping for maximum diversity
 * 3. Standard subject mapping if subject matches common curriculum subjects
 * 4. Standard subject mapping from class name
 * 5. Deterministic hash of class ID / name
 */
export function getClassColor(
  target?:
    | {
        color?: string;
        subject?: string;
        name?: string;
        className?: string;
        grade?: string;
        id?: string;
      }
    | string
    | null
): ClassColorTheme {
  if (!target) {
    return CLASS_COLOR_PALETTE[0]; // Default blue
  }

  if (typeof target === "string") {
    const trimmed = target.trim();
    if (CLASS_COLORS_BY_ID[trimmed.toLowerCase()]) {
      return CLASS_COLORS_BY_ID[trimmed.toLowerCase()];
    }
    const lower = trimmed.toLowerCase();
    if (CLASS_COMBINATION_COLORS[lower]) {
      return CLASS_COLORS_BY_ID[CLASS_COMBINATION_COLORS[lower]] || CLASS_COLOR_PALETTE[0];
    }
    for (const [subKey, colorId] of Object.entries(DEFAULT_SUBJECT_COLORS)) {
      if (lower === subKey || lower.includes(subKey)) {
        return CLASS_COLORS_BY_ID[colorId] || CLASS_COLOR_PALETTE[0];
      }
    }
    return hashStringToColor(trimmed);
  }

  // Object passed
  // 1. Explicit color ID
  if (target.color && CLASS_COLORS_BY_ID[target.color.toLowerCase()]) {
    return CLASS_COLORS_BY_ID[target.color.toLowerCase()];
  }

  // 2. Specific class name or grade + subject combination
  const nameStr = (target.name || target.className || "").toLowerCase().trim();
  if (nameStr && CLASS_COMBINATION_COLORS[nameStr]) {
    return CLASS_COLORS_BY_ID[CLASS_COMBINATION_COLORS[nameStr]] || CLASS_COLOR_PALETTE[0];
  }

  if (target.grade && target.subject) {
    const comboStr = `${target.grade} ${target.subject}`.toLowerCase().trim();
    if (CLASS_COMBINATION_COLORS[comboStr]) {
      return CLASS_COLORS_BY_ID[CLASS_COMBINATION_COLORS[comboStr]] || CLASS_COLOR_PALETTE[0];
    }
  }

  // 3. Fallback to standard subject mapping
  if (target.subject) {
    const subLower = target.subject.toLowerCase().trim();
    for (const [subKey, colorId] of Object.entries(DEFAULT_SUBJECT_COLORS)) {
      if (subLower === subKey || subLower.includes(subKey)) {
        return CLASS_COLORS_BY_ID[colorId] || CLASS_COLOR_PALETTE[0];
      }
    }
  }

  // 4. Fallback to subject mapping from class name
  if (nameStr) {
    for (const [subKey, colorId] of Object.entries(DEFAULT_SUBJECT_COLORS)) {
      if (nameStr.includes(subKey)) {
        return CLASS_COLORS_BY_ID[colorId] || CLASS_COLOR_PALETTE[0];
      }
    }
    return hashStringToColor(nameStr);
  }

  if (target.id) {
    return hashStringToColor(target.id);
  }

  return CLASS_COLOR_PALETTE[0];
}
