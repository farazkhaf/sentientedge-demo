"use client";
import { neighborhoodsGeoJSON } from "@/lib/data/neighborhoods";

import { ArrowUpRight } from "lucide-react";

import { areaPolygons } from "@/lib/intelligence/places";

const features = neighborhoodsGeoJSON.features;
const points = features.flatMap((f) =>
  areaPolygons(f.geometry).flatMap((rings) => rings.flat()),
);
const west = Math.min(...points.map((p) => p[0]));
const north = Math.max(...points.map((p) => p[1]));
const width =
  (Math.max(...points.map((p) => p[0])) - west) *
  Math.cos((north * Math.PI) / 180);
const height = north - Math.min(...points.map((p) => p[1]));
const scale = Math.min(260 / width, 145 / height);
const project = ([lng, lat]: number[]) => [
  22 +
    (260 - width * scale) / 2 +
    (lng - west) * Math.cos((north * Math.PI) / 180) * scale,
  12 + (145 - height * scale) / 2 + (north - lat) * scale,
];
const shapes = features.map((feature) => ({
  id: feature.properties.id,
  name: feature.properties.name,
  path: areaPolygons(feature.geometry)
    .flat()
    .map(
      (ring) =>
        ring
          .map(
            (point, i) =>
              `${i === 0 ? "M" : "L"}${project(point)
                .map((n) => n.toFixed(1))
                .join(",")}`,
          )
          .join("") + "Z",
    )
    .join(""),
}));

export function CityPreview({
  selected,
  open,
}: {
  selected: string | null;
  open: () => void;
}) {
  return (
    <button
      className="se-city-preview"
      onClick={open}
      aria-label="Open the Miami geographic workspace"
    >
      <span className="se-city-preview-heading">
        <span>Geographic workspace</span>
        <ArrowUpRight size={14} />
      </span>
      <svg
        viewBox="0 0 305 170"
        role="img"
        aria-label="Miami analytical areas with the selected neighborhood highlighted"
      >
        <path
          className="se-city-grid"
          d="M0 42H305M0 84H305M0 126H305M61 0V170M122 0V170M183 0V170M244 0V170"
        />
        {shapes.map((shape) => (
          <path
            key={shape.id}
            d={shape.path}
            fillRule="evenodd"
            className={shape.id === selected ? "is-selected" : "se-city-area"}
          >
            <title>{shape.name}</title>
          </path>
        ))}
        <text x="228" y="137" className="se-city-water">
          BISCAYNE
        </text>
        <text x="228" y="149" className="se-city-water">
          BAY
        </text>
      </svg>
      <span className="se-city-preview-footer">
        <span>
          {selected
            ? shapes.find((s) => s.id === selected)?.name
            : "23 analytical areas"}
        </span>
        <strong>Explore Miami</strong>
      </span>
    </button>
  );
}
