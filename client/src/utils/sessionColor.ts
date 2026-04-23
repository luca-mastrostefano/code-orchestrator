/**
 * Deterministic visual identity for a session: a color picked from a fixed
 * 15-entry palette keyed off the session id, plus a matching foreground color
 * (black or white) chosen for contrast.
 */

const PALETTE = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#a855f7', // purple
  '#eab308', // yellow
  '#22c55e', // green
  '#0ea5e9', // sky
  '#e11d48', // rose
] as const;

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h |= 0; // force 32-bit
  }
  return Math.abs(h);
}

/**
 * Perceived-luminance threshold test (ITU-R BT.601) — gives a readable text
 * color without the gamma-correction complexity of the WCAG formula.
 * Background is hex #rrggbb (3 or 6 chars).
 */
function readableForeground(hex: string): '#000000' | '#ffffff' {
  const clean = hex.replace('#', '');
  const expanded = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return y > 150 ? '#000000' : '#ffffff';
}

export interface SessionColor {
  bg: string;
  fg: '#000000' | '#ffffff';
}

export function getSessionColor(sessionId: string): SessionColor {
  const index = hashString(sessionId) % PALETTE.length;
  const bg = PALETTE[index]!;
  return { bg, fg: readableForeground(bg) };
}
