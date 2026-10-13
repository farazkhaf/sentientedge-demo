export type MapMode = "profile" | "places" | "permits";

// Hover previews never compete with the object already being inspected.
export function neighborhoodPreview(
  state: {
    mode: MapMode;
    panelOpen: boolean;
    selectedArea: string | null;
    inspectingPlace: boolean;
    comparison: boolean;
  },
  hoveredArea: string,
): "hidden" | "compact" | "full" {
  if (state.mode === "places") return "hidden";
  if (state.comparison) return "compact";
  if (state.panelOpen) {
    if (state.inspectingPlace) return "hidden";
    if (state.selectedArea) {
      if (state.mode === "permits" || state.selectedArea === hoveredArea)
        return "hidden";
      return "compact";
    }
  }
  return state.mode === "profile" ? "full" : "compact";
}
