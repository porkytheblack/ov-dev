/**
 * Deterministic ROI color palette.
 *
 * Colors are assigned by an ROI's index in the created_at-ordered list, so a
 * given zone keeps its color across the canvas, the legend and the list as
 * long as the ordering is stable.
 *
 * Constraints these hexes satisfy:
 *  - High chroma, mid-light: legible as a 2px stroke AND a translucent fill on
 *    both bright daytime footage and washed-out IR / night footage.
 *  - The app accent amber (`--accent` ≈ #f5ad4a) is deliberately EXCLUDED so a
 *    "selected" (accent-emphasized) ROI never visually collides with a zone
 *    that merely happens to be drawn in amber.
 *  - Hues are spread around the wheel and kept distinguishable from each other.
 */
export const ROI_PALETTE = [
  "#38bdf8", // sky blue
  "#34d399", // emerald
  "#f472b6", // pink
  "#a78bfa", // violet
  "#facc15", // yellow (cooler / greener than the accent amber)
  "#fb7185", // rose
  "#22d3ee", // cyan
  "#4ade80", // green
  "#c084fc", // purple
  "#60a5fa", // indigo-blue
] as const;

/**
 * Stable color for the ROI at `index` in the (created_at-ordered) ROI list.
 * Wraps if there are more ROIs than palette entries. Negative / non-finite
 * indices fall back to the first color.
 */
export function roiColor(index: number): string {
  if (!Number.isFinite(index) || index < 0) return ROI_PALETTE[0];
  return ROI_PALETTE[Math.floor(index) % ROI_PALETTE.length];
}
