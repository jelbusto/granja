export const THEMES = ["azul", "verde", "violeta"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_HEX: Record<Theme, string> = {
  azul: "#2563eb",
  verde: "#16a34a",
  violeta: "#7c3aed",
};
