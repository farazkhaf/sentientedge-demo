export type DetailAnchor = "map" | "balanced" | "reading";
export const detailAnchors: DetailAnchor[] = ["map", "balanced", "reading"];

export function detailHeights(height: number): Record<DetailAnchor, number> {
  const usable = Math.max(240, height);
  return {
    map: 80,
    balanced: usable - Math.min(300, usable * 0.43),
    reading: usable - Math.min(128, usable * 0.27),
  };
}

export function nearestDetailAnchor(
  height: number,
  reveal: number,
): DetailAnchor {
  const positions = detailHeights(height);
  return detailAnchors.reduce((best, anchor) =>
    Math.abs(positions[anchor] - reveal) < Math.abs(positions[best] - reveal)
      ? anchor
      : best,
  );
}
