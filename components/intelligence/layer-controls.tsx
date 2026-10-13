"use client";
import { useDataset } from "./dataset-provider";
import {
  Bookmark,
  ChevronDown,
  Layers3,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";
import { dimensions } from "@/lib/intelligence/briefings";

export function IntelligenceControls({
  onSelectArea,
}: {
  onSelectArea?: (id: string) => void;
}) {
  const { dataService } = useDataset();

  const {
    activeLayers,
    layerWeights,
    toggleLayer,
    setLayerWeight,
    setActiveLayers,
    watchlist,
    removeFromWatchlist,
    setSelectedNeighborhood,
    selectedNeighborhood,
  } = useAppStore();
  return (
    <aside className="se-controls" aria-label="Geographic layers">
      <header>
        <Layers3 size={18} />
        <div>
          <h2>Intelligence layers</h2>
          <p>Shape the geographic profile</p>
        </div>
      </header>
      <div className="se-control-body">
        <span className="se-eyebrow">Dimensions</span>
        <div className="se-layer-list">
          {dimensions.map((d) => (
            <label
              className={`se-layer-row ${activeLayers.includes(d.id) ? "is-active" : ""}`}
              key={d.id}
            >
              <span
                className="se-layer-icon"
                style={{ color: d.color, background: `${d.color}14` }}
              >
                <i style={{ background: d.color }} />
              </span>
              <span>
                <strong>{d.label}</strong>
                <small>{d.short}</small>
              </span>
              <input
                type="checkbox"
                aria-label={`${d.label} layer`}
                checked={activeLayers.includes(d.id)}
                onChange={() => toggleLayer(d.id)}
              />
              <span className="se-switch" />
            </label>
          ))}
        </div>
        <div className="se-layer-presets">
          <button onClick={() => setActiveLayers(dimensions.map((d) => d.id))}>
            All dimensions
          </button>
          <button
            onClick={() =>
              setActiveLayers(["demographics", "crime", "amenities"])
            }
          >
            Base profile
          </button>
        </div>
        <details className="se-weight-controls" open>
          <summary>
            <SlidersHorizontal size={15} />
            <strong>Layer weights</strong>
            <ChevronDown size={14} />
          </summary>
          <p>Balance the dimensions that matter to your investigation.</p>
          {dimensions
            .filter((d) => activeLayers.includes(d.id))
            .map((d) => (
              <label key={d.id}>
                <span>
                  <i style={{ background: d.color }} />
                  {d.label}
                  <b>{layerWeights[d.id].toFixed(1)}×</b>
                </span>
                <input
                  type="range"
                  aria-label={`${d.label} weight`}
                  min={0}
                  max={2}
                  step={0.1}
                  value={layerWeights[d.id]}
                  onChange={(e) => setLayerWeight(d.id, Number(e.target.value))}
                />
              </label>
            ))}
          {!activeLayers.length && (
            <p>Select a dimension to adjust its weight.</p>
          )}
        </details>
        <section className="se-saved-areas">
          <div className="se-section-title">
            <h3>
              <Bookmark size={14} />
              Saved areas
            </h3>
            <span>{watchlist.length}</span>
          </div>
          {watchlist.length ? (
            watchlist.map((w) => (
              <div
                key={w.neighborhoodId}
                className={
                  selectedNeighborhood === w.neighborhoodId ? "is-active" : ""
                }
              >
                <button
                  onClick={() =>
                    (onSelectArea ?? setSelectedNeighborhood)(w.neighborhoodId)
                  }
                >
                  {dataService.getAllDataForNeighborhood(w.neighborhoodId)
                    ?.name ?? w.neighborhoodId}
                </button>
                <button
                  onClick={() => removeFromWatchlist(w.neighborhoodId)}
                  aria-label={`Remove ${w.neighborhoodId} from saved areas`}
                >
                  <X size={13} />
                </button>
              </div>
            ))
          ) : (
            <p>Save a neighborhood from its briefing to return to it here.</p>
          )}
        </section>
      </div>
      <footer>
        <i />
        <span>
          {activeLayers.filter((l) => layerWeights[l] > 0).length} dimensions in
          the current blend
        </span>
      </footer>
    </aside>
  );
}
