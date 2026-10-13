"use client";
import { useDataset } from "./dataset-provider";

import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Copy, MapPin, X } from "lucide-react";
import type { HotspotFeature } from "@/lib/types/data";
import {
  placeArea,
  placeCategories,
  placeName,
} from "@/lib/intelligence/places";
import { currency, dateLabel } from "@/lib/intelligence/briefings";

import { useAppStore } from "@/lib/store/app-store";

export function PlaceDetailPanel({
  place,
  back,
  close,
}: {
  place: HotspotFeature;
  back: () => void;
  close: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const area = placeArea(place.geometry.coordinates);
  const maximum = Math.max(1, ...Object.values(place.properties.categories));
  return (
    <aside
      className="se-context-panel se-place-panel"
      aria-label="Selected place details"
    >
      <button className="se-context-back" onClick={back}>
        <ArrowLeft size={13} />
        {area ? area.name : "Miami overview"}
      </button>
      <header className="se-context-header">
        <div>
          <span className="se-eyebrow">Place intelligence</span>
          <h1>{placeName(place)}</h1>
        </div>
        <div className="se-context-actions">
          <button
            aria-label="Close details panel"
            title="Close details panel"
            onClick={close}
          >
            <X size={17} />
          </button>
        </div>
      </header>
      <div className="se-context-scroll">
        <p className="se-place-location">
          <MapPin size={12} />
          Miami{area ? ` / ${area.name}` : ""}
        </p>
        <div className="se-place-measure">
          <strong>
            {place.properties.amenity_count}
            <span>amenities nearby</span>
          </strong>
          <span>
            <b>{place.properties.radius_m} m</b>radius shown on map
          </span>
        </div>
        <div className="se-place-distribution">
          <div>
            <span>Amenities by category</span>
            <small>Count</small>
          </div>
          {placeCategories.map((category) => {
            const count = place.properties.categories[category.id] ?? 0;
            return (
              <div className="se-place-bar" key={category.id}>
                <span>{category.label}</span>
                <i>
                  <span
                    style={{
                      width: `${(count / maximum) * 100}%`,
                      background: category.color,
                    }}
                  />
                </i>
                <b>{count}</b>
              </div>
            );
          })}
        </div>
        <div className="se-place-examples">
          <span>Nearby places in the records</span>
          <p>
            {place.properties.sample_names.slice(0, 4).join(" · ") ||
              "No place names recorded for this cluster."}
          </p>
        </div>
        <button className="se-place-area-link" onClick={back}>
          <span>
            <small>Neighborhood context</small>
            <strong>{area?.name ?? "Miami overview"}</strong>
          </span>
          <ArrowUpRight size={16} />
        </button>
        <button
          className="se-text-button se-place-copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `${place.geometry.coordinates[1].toFixed(6)}, ${place.geometry.coordinates[0].toFixed(6)}`,
              );
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy size={12} />
          {copied ? "Coordinates copied" : "Copy coordinates"}
        </button>
      </div>
    </aside>
  );
}

export function PermitActivity({
  id,
  readBriefing,
}: {
  id: string | null;
  readBriefing: () => void;
}) {
  const { dataService, permits } = useDataset();

  const records = id
    ? permits.filter((p) => p.neighborhood_id === id)
    : permits;
  if (!records.length)
    return (
      <section className="se-narrative">
        <h2>No permit observations</h2>
        <p>This area has no permit totals in the included records.</p>
        <button className="se-place-area-link" onClick={readBriefing}>
          Read neighborhood intelligence
          <ArrowUpRight size={14} />
        </button>
      </section>
    );
  const count = records.reduce((sum, p) => sum + p.permit_count_30d, 0);
  const value = records.reduce((sum, p) => sum + p.total_value_30d, 0);
  const residential = count
    ? records.reduce(
        (sum, p) => sum + p.residential_ratio * p.permit_count_30d,
        0,
      ) / count
    : null;
  const dates = records.map((p) => p.last_updated.slice(0, 10)).sort();
  const date =
    dates[0] === dates.at(-1)
      ? dateLabel(dates[0])
      : `${dateLabel(dates[0])} – ${dateLabel(dates.at(-1)!)}`;
  const sorted = [...records].sort(
    (a, b) => b.permit_count_30d - a.permit_count_30d,
  );
  const maximum = Math.max(1, ...records.map((p) => p.permit_count_30d));
  return (
    <>
      <section className="se-narrative se-permit-overview">
        <span className="se-eyebrow">Development activity</span>
        <h2>{id ? "Building permits" : "Where Miami is building"}</h2>
        <p>
          30-day observations ending {date}.{" "}
          {id
            ? "Permit activity within the selected analytical area."
            : `Neighborhood totals across ${records.length} analytical areas.`}
        </p>
        <div className="se-permit-facts">
          <div>
            <span>Permits · 30 days</span>
            <strong>{count.toLocaleString("en-US")}</strong>
          </div>
          <div>
            <span>Declared value · 30 days</span>
            <strong>{currency(value)}</strong>
          </div>
          <div>
            <span>Residential share</span>
            <strong>
              {residential == null ? "—" : `${Math.round(residential * 100)}%`}
            </strong>
          </div>
          <div>
            <span>Average permit value</span>
            <strong>{count ? currency(value / count) : "—"}</strong>
          </div>
        </div>
      </section>
      {!id && (
        <section className="se-section">
          <div className="se-section-title">
            <h3>Activity by neighborhood</h3>
            <span>Permits · 30 days</span>
          </div>
          <div className="se-permit-areas">
            {sorted.map((p) => (
              <button
                key={p.neighborhood_id}
                onClick={() =>
                  useAppStore
                    .getState()
                    .setSelectedNeighborhood(p.neighborhood_id)
                }
              >
                <span>
                  {
                    dataService.getAllDataForNeighborhood(p.neighborhood_id)
                      ?.name
                  }
                </span>
                <i>
                  <i
                    style={{
                      width: `${(p.permit_count_30d / maximum) * 100}%`,
                    }}
                  />
                </i>
                <b>{p.permit_count_30d}</b>
              </button>
            ))}
          </div>
        </section>
      )}
      <button className="se-place-area-link" onClick={readBriefing}>
        <span>
          <small>Explore the wider context</small>
          <strong>
            {id
              ? "Read neighborhood intelligence"
              : "Read Miami’s city briefing"}
          </strong>
        </span>
        <ArrowUpRight size={16} />
      </button>
    </>
  );
}
