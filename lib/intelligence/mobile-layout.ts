export type DetailAnchor = "map" | "balanced" | "reading";
export const detailAnchors: DetailAnchor[] = ["map", "balanced", "reading"];

export function detailHeights(
  height: number,
  peekHeight = 60,
): Record<DetailAnchor, number> {
  const usable = Math.max(240, height);
  return {
    map: peekHeight,
    balanced: usable - Math.min(300, usable * 0.43),
    reading: usable - Math.min(128, usable * 0.27),
  };
}

export function nearestDetailAnchor(
  height: number,
  reveal: number,
  peekHeight = 60,
): DetailAnchor {
  const positions = detailHeights(height, peekHeight);
  return detailAnchors.reduce((best, anchor) =>
    Math.abs(positions[anchor] - reveal) < Math.abs(positions[best] - reveal)
      ? anchor
      : best,
  );
}
