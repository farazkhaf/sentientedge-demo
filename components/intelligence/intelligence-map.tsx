"use client";
import { useDataset } from "./dataset-provider";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  Crosshair,
  Layers3,
  LoaderCircle,
  MapPin,
  PanelRightOpen,
  SlidersHorizontal,
} from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";

import { currency, dimensions, signed } from "@/lib/intelligence/briefings";

import type { HotspotFeature } from "@/lib/types/data";
import {
  placeCatchment,
  placeCategory,
  placeName,
} from "@/lib/intelligence/places";
import {
  neighborhoodPreview,
  type MapMode,
} from "@/lib/intelligence/presentation";

const cityBounds: [[number, number], [number, number]] = [
  [-80.31, 25.705],
  [-80.137, 25.871],
];
const permitColor = (count: number) =>
  count >= 150
    ? "#4c4678"
    : count >= 100
      ? "#6f6a9d"
      : count >= 50
        ? "#938fb9"
        : count >= 20
          ? "#bbb9d5"
          : "#e1dfeb";
const comparisonColors = ["#4f8b85", "#b58c57", "#778ca9", "#a07c97"];

function placeHoverContent(place: HotspotFeature) {
  const wrapper = document.createElement("div");
  wrapper.className = "se-map-hover is-compact se-place-hover";
  const title = document.createElement("strong");
  title.textContent = placeName(place);
  const category = placeCategory(place);
  const kind = document.createElement("p");
  kind.className = "se-place-hover-kind";
  kind.textContent = category.label;
  const dot = document.createElement("i");
  dot.style.background = category.color;
  kind.prepend(dot);
  const metric = document.createElement("div");
  metric.className = "se-hover-blend";
  const label = document.createElement("span");
  label.textContent = `Amenities within ${place.properties.radius_m} m`;
  const count = document.createElement("b");
  count.textContent = String(place.properties.amenity_count);
  metric.append(label, count);
  const hint = document.createElement("small");
  hint.textContent = "Click for place details";
  wrapper.append(title, kind, metric, hint);
  return wrapper;
}

function hoverContent(
  id: string,
  mode: MapMode,
  compact: boolean,
  dataset: ReturnType<typeof useDataset>,
) {
  const { dataService, permits, areaBriefing } = dataset;
  const state = useAppStore.getState();
  const area = dataService.getAllDataForNeighborhood(id)!;
  const index = dataService.calculateCompositeScore(
    id,
    state.activeLayers,
    state.layerWeights,
  );
  const wrapper = document.createElement("div");
  wrapper.className = `se-map-hover ${compact ? "is-compact" : ""}`;
  const title = document.createElement("strong");
  title.textContent = area.name;
  wrapper.append(title);
  if (mode !== "profile") {
    const metric = document.createElement("div");
    metric.className = "se-hover-blend";
    const label = document.createElement("span");
    const number = document.createElement("b");
    const permit = permits.find((p) => p.neighborhood_id === id);
    label.textContent =
      mode === "permits" ? "Permits · 30 days" : "Walkability · / 100";
    number.textContent =
      mode === "permits"
        ? (permit?.permit_count_30d.toLocaleString("en-US") ?? "—")
        : String(area.amenities?.walkability_score ?? "—");
    metric.append(label, number);
    wrapper.append(metric);
    if (mode === "permits" && permit) {
      const value = document.createElement("p");
      value.textContent = `${currency(permit.total_value_30d)} declared value`;
      wrapper.append(value);
    }
    const hint = document.createElement("small");
    hint.textContent = state.comparisonMode
      ? "Click to add to comparison"
      : mode === "permits"
        ? "Click to inspect permit activity"
        : "Select a place marker for nearby amenities";
    wrapper.append(hint);
    return wrapper;
  }
  const headline = document.createElement("p");
  headline.textContent = areaBriefing(id)?.combined.headline ?? "";
  if (!compact) wrapper.append(headline);
  const blend = document.createElement("div");
  blend.className = "se-hover-blend";
  const label = document.createElement("span");
  label.textContent = "Weighted profile";
  const value = document.createElement("b");
  value.textContent = index.breakdown.length
    ? signed(index.composite_score)
    : "—";
  value.style.color = dataService.getScoreColor(index.composite_score);
  blend.append(label, value);
  wrapper.append(blend);
  const rows = document.createElement("div");
  rows.className = "se-hover-dimensions";
  dimensions.forEach((d) => {
    const row = document.createElement("div");
    const text = document.createElement("span");
    text.textContent = d.label;
    const score = dataService.getDimensionScore(id, d.id);
    const number = document.createElement("b");
    number.textContent = score == null ? "—" : signed(score);
    number.style.color =
      score == null ? "#89918f" : dataService.getScoreColor(score);
    row.append(text, number);
    rows.append(row);
  });
  if (!compact) wrapper.append(rows);
  const hint = document.createElement("small");
  hint.textContent = state.comparisonMode
    ? "Click to add to comparison"
    : "Click to open neighborhood briefing";
  wrapper.append(hint);
  return wrapper;
}

export function IntelligenceMap({
  mode,
  place,
  visible,
  onModeChange,
  onPlaceSelect,
  openDetails,
  detailsLabel,
}: {
  mode: MapMode;
  place: HotspotFeature | null;
  visible: boolean;
  onModeChange: (mode: MapMode) => void;
  onPlaceSelect: (place: HotspotFeature | null) => void;
  openDetails?: () => void;
  detailsLabel: string;
}) {
  const dataset = useDataset();
  const { dataService, hotspotData, permits } = dataset;
  const markerCategories = [
    ...new Map(
      (hotspotData.features as HotspotFeature[]).map((place) => {
        const category = placeCategory(place);
        return [category.id, category] as const;
      }),
    ).values(),
  ];

  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const showHotspots = mode === "places";
  const showPermits = mode === "permits";
  const {
    activeLayers,
    layerWeights,
    selectedNeighborhood,
    comparisonMode,
    comparisonNeighborhoods,
    detailPanelOpen,
  } = useAppStore();
  const interaction = useRef({ mode, place, visible, onPlaceSelect });
  interaction.current = { mode, place, visible, onPlaceSelect };
  const resetHover = useRef<() => void>(() => {});
  const cameraScope = useRef("");

  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-80.216, 25.793],
        zoom: 11.55,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return;
    }
    map.current = instance;
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    instance.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100 }),
      "bottom-left",
    );
    popup.current = new maplibregl.Popup({
      className: "se-neighborhood-popup",
      closeButton: false,
      closeOnClick: false,
      offset: 15,
      maxWidth: "280px",
      subpixelPositioning: false,
    });
    const timeout = setTimeout(() => setFailed(true), 18000);
    instance.on("load", () => {
      clearTimeout(timeout);
      setFailed(false);
      for (const layer of instance.getStyle().layers) {
        if (layer.id === "water" && layer.type === "fill")
          instance.setPaintProperty(layer.id, "fill-color", "#bcd9e1");
        if (layer.type === "background")
          instance.setPaintProperty(layer.id, "background-color", "#f4f6f7");
        if (
          layer.type === "symbol" &&
          (layer.id.includes("poi") || layer.id.includes("housenumber"))
        )
          instance.setLayoutProperty(layer.id, "visibility", "none");
      }
      instance.addSource("neighborhoods", {
        type: "geojson",
        data: dataService.getNeighborhoodBoundaries(),
        promoteId: "id",
      });
      instance.addLayer({
        id: "neighborhood-fill",
        type: "fill",
        source: "neighborhoods",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#929b9b"],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.58,
            0.36,
          ],
        },
      });
      instance.addLayer({
        id: "neighborhood-lines",
        type: "line",
        source: "neighborhoods",
        paint: {
          "line-color": "#647c78",
          "line-width": 0.9,
          "line-opacity": 0.72,
        },
      });
      instance.addLayer({
        id: "neighborhood-selection",
        type: "line",
        source: "neighborhoods",
        paint: {
          "line-color": ["coalesce", ["get", "selectionColor"], "#245e5b"],
          "line-width": ["case", ["get", "selected"], 3, 0],
        },
      });
      instance.addSource("area-labels", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: dataService
            .getNeighborhoodBoundaries()
            .features.map((f) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: f.properties.centroid!,
              },
              properties: { name: f.properties.name },
            })),
        },
      });
      instance.addLayer({
        id: "neighborhood-labels",
        type: "symbol",
        source: "area-labels",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-max-width": 10,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#334846",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.7,
        },
      });
      instance.addSource("amenity-hotspots", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: (hotspotData.features as unknown as HotspotFeature[]).map(
            (f) => ({
              ...f,
              properties: {
                ...f.properties,
                color: placeCategory(f).color,
              },
            }),
          ),
        },
      });
      instance.addSource("place-catchment", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      instance.addLayer(
        {
          id: "place-catchment-fill",
          type: "fill",
          source: "place-catchment",
          paint: { "fill-color": "#176a67", "fill-opacity": 0.09 },
        },
        "neighborhood-labels",
      );
      instance.addLayer({
        id: "place-catchment-line",
        type: "line",
        source: "place-catchment",
        paint: {
          "line-color": "#176a67",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
      instance.addLayer({
        id: "amenity-dots",
        type: "circle",
        source: "amenity-hotspots",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            3,
            13,
            6,
            16,
            12,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 1,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      let hovered: string | null = null;
      let hoveredPlace: string | null = null;
      let placeTimer: ReturnType<typeof setTimeout> | null = null;
      const clearHover = () => {
        if (hovered)
          instance.setFeatureState(
            { source: "neighborhoods", id: hovered },
            { hover: false },
          );
        hovered = null;
        hoveredPlace = null;
        if (placeTimer) clearTimeout(placeTimer);
        placeTimer = null;
        popup.current?.remove();
      };
      resetHover.current = clearHover;
      instance.on("mousemove", (e) => {
        const state = useAppStore.getState();
        const current = interaction.current;
        if (!current.visible) {
          clearHover();
          return;
        }
        if (current.mode === "places") {
          const dot = !state.comparisonMode
            ? instance.queryRenderedFeatures(e.point, {
                layers: ["amenity-dots"],
              })[0]
            : null;
          const nextId = dot?.properties.id as string | undefined;
          instance.getCanvas().style.cursor = nextId ? "pointer" : "";
          if (
            !nextId ||
            (state.detailPanelOpen && current.place?.properties.id === nextId)
          ) {
            clearHover();
            return;
          }
          if (hoveredPlace === nextId) return;
          clearHover();
          hoveredPlace = nextId;
          const selected = (hotspotData.features as HotspotFeature[]).find(
            (place) => place.properties.id === nextId,
          );
          if (selected)
            placeTimer = setTimeout(() => {
              placeTimer = null;
              if (
                hoveredPlace !== nextId ||
                interaction.current.mode !== "places" ||
                !interaction.current.visible
              )
                return;
              popup.current
                ?.setDOMContent(placeHoverContent(selected))
                .setLngLat(selected.geometry.coordinates)
                .addTo(instance);
            }, 120);
          return;
        }
        const feature = instance.queryRenderedFeatures(e.point, {
          layers: ["neighborhood-fill"],
        })[0];
        const id = feature?.properties.id as string | undefined;
        if (!id) {
          clearHover();
          instance.getCanvas().style.cursor = "";
          return;
        }
        instance.getCanvas().style.cursor = "pointer";
        const preview = neighborhoodPreview(
          {
            mode: current.mode,
            panelOpen: state.detailPanelOpen,
            selectedArea: state.selectedNeighborhood,
            inspectingPlace: !!current.place,
            comparison: state.comparisonMode,
          },
          id,
        );
        if (preview === "hidden") {
          clearHover();
          return;
        }
        if (hovered !== id) {
          if (hovered)
            instance.setFeatureState(
              { source: "neighborhoods", id: hovered },
              { hover: false },
            );
          instance.setFeatureState(
            { source: "neighborhoods", id },
            { hover: true },
          );
          popup.current?.setDOMContent(
            hoverContent(id, current.mode, preview === "compact", dataset),
          );
          hovered = id;
        }
        instance.getCanvas().style.cursor = "pointer";
        popup.current?.setLngLat(e.lngLat);
        // addTo remounts an open popup; moving within an area only changes its position.
        if (popup.current && !popup.current.isOpen())
          popup.current.addTo(instance);
      });
      instance.on("mouseout", () => {
        clearHover();
        instance.getCanvas().style.cursor = "";
      });
      instance.on("movestart", clearHover);
      instance.on("click", (e) => {
        const state = useAppStore.getState();
        const current = interaction.current;
        const dot =
          current.mode === "places" && !state.comparisonMode
            ? instance.queryRenderedFeatures(e.point, {
                layers: ["amenity-dots"],
              })[0]
            : null;
        if (dot) {
          const selected = (hotspotData.features as HotspotFeature[]).find(
            (f) => f.properties.id === dot.properties.id,
          );
          if (selected) current.onPlaceSelect(selected);
          clearHover();
          return;
        }
        const feature = instance.queryRenderedFeatures(e.point, {
          layers: ["neighborhood-fill"],
        })[0];
        const id = feature?.properties?.id as string | undefined;
        if (!id) return;
        if (state.comparisonMode) state.addToComparison(id);
        else state.setSelectedNeighborhood(id);
        clearHover();
        current.onPlaceSelect(null);
      });
      instance.fitBounds(cityBounds, {
        padding: { top: 65, right: 35, bottom: 105, left: 35 },
        duration: 0,
      });
      setReady(true);
    });
    const observer = new ResizeObserver(() => {
      if (container.current?.clientWidth && container.current.clientHeight)
        instance.resize();
    });
    observer.observe(container.current);
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      resetHover.current();
      resetHover.current = () => {};
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const features = dataService
      .getNeighborhoodBoundaries()
      .features.map((f) => {
        const score = dataService.calculateCompositeScore(
          f.properties.id,
          activeLayers,
          layerWeights,
        );
        const permit = permits.find(
          (p) => p.neighborhood_id === f.properties.id,
        );
        const comparisonIndex = comparisonNeighborhoods.indexOf(
          f.properties.id,
        );
        return {
          ...f,
          properties: {
            ...f.properties,
            color: showPermits
              ? permit
                ? permitColor(permit.permit_count_30d)
                : "#c9cecb"
              : showHotspots
                ? "#b9cbc8"
                : score.breakdown.length
                  ? dataService.getScoreColor(score.composite_score)
                  : "#c9cecb",
            selected:
              comparisonIndex >= 0 || f.properties.id === selectedNeighborhood,
            selectionColor:
              comparisonIndex >= 0
                ? comparisonColors[comparisonIndex]
                : "#245e5b",
          },
        };
      });
    (
      map.current.getSource("neighborhoods") as maplibregl.GeoJSONSource
    ).setData({ type: "FeatureCollection", features });
    map.current.setLayoutProperty(
      "amenity-dots",
      "visibility",
      showHotspots ? "visible" : "none",
    );
    map.current.setPaintProperty("neighborhood-fill", "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      showPermits ? 0.82 : showHotspots ? 0.18 : 0.64,
      showPermits ? 0.68 : showHotspots ? 0.1 : 0.44,
    ]);
    map.current.setPaintProperty(
      "neighborhood-lines",
      "line-color",
      showPermits ? "#746d8b" : "#647c78",
    );
  }, [
    ready,
    activeLayers,
    layerWeights,
    selectedNeighborhood,
    comparisonNeighborhoods,
    showPermits,
    showHotspots,
  ]);

  useEffect(() => {
    resetHover.current();
  }, [
    mode,
    place,
    visible,
    detailPanelOpen,
    selectedNeighborhood,
    comparisonMode,
    activeLayers,
    layerWeights,
  ]);

  useEffect(() => {
    if (!ready || !map.current || !visible) return;
    map.current.resize();
    const scope = comparisonMode
      ? "comparison"
      : place
        ? `place:${place.properties.id}`
        : (selectedNeighborhood ?? "miami");
    if (cameraScope.current === scope) return;
    cameraScope.current = scope;
    if (place && !comparisonMode) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 500;
    if (comparisonMode) {
      map.current.fitBounds(cityBounds, {
        padding: { top: 48, right: 30, bottom: 30, left: 30 },
        duration,
      });
      return;
    }
    const feature = dataService
      .getNeighborhoodBoundaries()
      .features.find((f) => f.properties.id === selectedNeighborhood);
    if (feature) {
      const bounds = new maplibregl.LngLatBounds();
      const extend = (coordinates: unknown): void => {
        if (!Array.isArray(coordinates)) return;
        if (typeof coordinates[0] === "number")
          bounds.extend(coordinates as [number, number]);
        else coordinates.forEach(extend);
      };
      extend(feature.geometry.coordinates);
      map.current.fitBounds(bounds, {
        padding: { top: 85, right: 55, bottom: 115, left: 55 },
        maxZoom: 13.2,
        duration,
      });
    } else
      map.current.fitBounds(cityBounds, {
        padding: { top: 65, right: 35, bottom: 105, left: 35 },
        duration,
      });
  }, [ready, selectedNeighborhood, comparisonMode, place, visible]);

  useEffect(() => {
    if (!ready || !map.current) return;
    (
      map.current.getSource("place-catchment") as maplibregl.GeoJSONSource
    ).setData({
      type: "FeatureCollection",
      features: place ? [placeCatchment(place)] : [],
    });
    map.current.setPaintProperty("amenity-dots", "circle-stroke-color", [
      "case",
      ["==", ["get", "id"], place?.properties.id ?? ""],
      "#176a67",
      "#ffffff",
    ]);
    map.current.setPaintProperty("amenity-dots", "circle-stroke-width", [
      "case",
      ["==", ["get", "id"], place?.properties.id ?? ""],
      3,
      1.5,
    ]);
    if (place && !comparisonMode)
      map.current.easeTo({
        center: place.geometry.coordinates,
        zoom: Math.max(map.current.getZoom(), 14),
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 450,
      });
  }, [ready, place, comparisonMode]);

  return (
    <div className={`se-map ${ready ? "is-ready" : "is-loading"}`}>
      <div ref={container} className="se-map-canvas" />
      {!ready && (
        <div className="se-map-loading-cover">
          <div className="se-map-loading" role={failed ? "alert" : "status"}>
            {failed ? (
              <MapPin size={18} />
            ) : (
              <LoaderCircle className="se-spin" size={18} />
            )}
            <div>
              <strong>{failed ? "Map unavailable" : "Opening Miami"}</strong>
              <span>
                {failed
                  ? "Neighborhood briefings remain available."
                  : "Preparing the basemap and neighborhood layers…"}
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="se-map-tools" role="group" aria-label="Map mode">
        <button
          aria-pressed={mode === "profile"}
          className={mode === "profile" ? "is-active" : ""}
          onClick={() => onModeChange("profile")}
        >
          <SlidersHorizontal size={14} />
          Profile
        </button>
        <button
          aria-pressed={showHotspots}
          className={showHotspots ? "is-active" : ""}
          onClick={() => onModeChange("places")}
        >
          <MapPin size={14} />
          Places & amenities
        </button>
        <button
          aria-pressed={showPermits}
          className={showPermits ? "is-active" : ""}
          onClick={() => onModeChange("permits")}
        >
          <Layers3 size={14} />
          Building permits
        </button>
      </div>
      {openDetails && (
        <button
          className="se-map-details-toggle"
          onClick={openDetails}
          aria-label="Open details panel"
        >
          <PanelRightOpen size={15} />
          <span>
            <b>Details</b>
            <small>{detailsLabel}</small>
          </span>
        </button>
      )}
      {comparisonMode && (
        <div className="se-map-instruction">
          Select up to four neighborhoods on the map
        </div>
      )}
      <div className="se-map-legend">
        <div>
          <strong>
            {showPermits
              ? "Permits · 30-day count"
              : showHotspots
                ? "Places & amenities"
                : "Weighted profile index"}
          </strong>
          <button
            title="Fit Miami"
            aria-label="Fit Miami"
            onClick={() =>
              map.current?.fitBounds(cityBounds, {
                padding: { top: 65, right: 35, bottom: 105, left: 35 },
                duration: 500,
              })
            }
          >
            <Crosshair size={16} />
          </button>
        </div>
        {showHotspots ? (
          <div className="se-place-legend">
            <div className="se-marker-key">
              {markerCategories.map((category) => (
                <span key={category.id}>
                  <i style={{ background: category.color }} />
                  {category.label}
                </span>
              ))}
            </div>
            <span>
              Colors identify the anchor place. Hover a marker for a preview;
              click for nearby amenities.
            </span>
          </div>
        ) : (
          <>
            <div className="se-legend-ramp">
              {(showPermits
                ? ["#e1dfeb", "#bbb9d5", "#938fb9", "#6f6a9d", "#4c4678"]
                : ["#9d4c45", "#986f37", "#74817d", "#568369", "#35749b"]
              ).map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
            </div>
            <div className="se-legend-labels">
              {showPermits ? (
                <>
                  <span>0–19</span>
                  <span>20–49</span>
                  <span>50–99</span>
                  <span>100–149</span>
                  <span>150+</span>
                </>
              ) : (
                <>
                  <span>−1</span>
                  <span>−0.6</span>
                  <span>−0.3 / +0.3</span>
                  <span>+0.6</span>
                  <span>+1</span>
                </>
              )}
            </div>
          </>
        )}
        <small>
          {showPermits
            ? "Neighborhood permit totals"
            : showHotspots
              ? `${hotspotData.features.length} recorded clusters`
              : `${activeLayers.filter((l) => layerWeights[l] > 0).length} active dimensions · adjust weights in the sidebar`}
        </small>
      </div>
    </div>
  );
}
