export function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

export const STRENGTH_COLORS: Record<number, string> = {
  0: "#E5E7EB",
  1: "#DC2626",
  2: "#D97706",
  3: "#6366F1",
  4: "#16A34A",
};

export const STRENGTH_LABELS: Record<number, string> = {
  0: "",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};
