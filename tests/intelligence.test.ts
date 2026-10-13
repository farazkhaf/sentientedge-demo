import test from "node:test";
import assert from "node:assert/strict";
import { dimensions } from "../lib/intelligence/briefings";
import { createDataset } from "../lib/storage/dataset";
import { seedSnapshot } from "../scripts/seed-fixtures";
const { dataService, briefings, areaBriefing, evidenceById, recordsFor } =
  createDataset(seedSnapshot);
import {
  areaPolygons,
  placeArea,
  placeCatchment,
  placeCategory,
  placeName,
} from "../lib/intelligence/places";
import hotspots from "../lib/data/hotspots.json";
import type { HotspotFeature } from "../lib/types/data";

test("place marker categories describe the anchor rather than surrounding amenities", () => {
  const park = hotspots.features[0] as HotspotFeature;
  assert.equal(park.properties.dominant[0], "retail");
  assert.equal(placeCategory(park).id, "parks");
  const places = hotspots.features as HotspotFeature[];
  assert.deepEqual(
    new Set(places.map((place) => placeCategory(place).id)),
    new Set(["parks", "schools", "healthcare"]),
  );
});

test("place inspection resolves geography and draws the recorded ground radius", () => {
  const place = hotspots.features[0] as HotspotFeature;
  assert.equal(placeName(place), "Mary Brickell Village Park");
  assert.equal(placeArea(place.geometry.coordinates)?.id, "brickell");
  assert.equal(placeArea([0, 0]), undefined);
  const ring = placeCatchment(place).geometry.coordinates[0];
  assert.deepEqual(ring[0], ring.at(-1));
  const radians = (n: number) => (n * Math.PI) / 180;
  const [lng, lat] = place.geometry.coordinates.map(radians);
  for (const point of ring) {
    const [otherLng, otherLat] = point.map(radians);
    const a =
      Math.sin((otherLat - lat) / 2) ** 2 +
      Math.cos(lat) * Math.cos(otherLat) * Math.sin((otherLng - lng) / 2) ** 2;
    const distance = 2 * 6371008.8 * Math.asin(Math.sqrt(a));
    assert.ok(Math.abs(distance - place.properties.radius_m) < 0.01);
  }
});

test("geographic previews support every single and multipart Miami boundary", () => {
  const boundaries = dataService.getNeighborhoodBoundaries().features;
  for (const feature of boundaries) {
    const polygons = areaPolygons(feature.geometry);
    assert.ok(polygons.length);
    for (const rings of polygons) {
      assert.ok(rings.length);
      for (const ring of rings) {
        assert.ok(ring.length >= 4);
        assert.ok(
          ring.every(
            (point) => Number.isFinite(point[0]) && Number.isFinite(point[1]),
          ),
        );
      }
    }
  }
  assert.ok(
    areaPolygons(
      boundaries.find((f) => f.properties.id === "little_havana")!.geometry,
    ).length > 1,
  );
});

test("every neighborhood and city briefing has resolvable, correctly scoped supporting records", () => {
  assert.equal(briefings.areas.length, 23);
  assert.equal(recordsFor(null, "news").length, 67);
  assert.equal(recordsFor(null, "social").length, 89);
  for (const area of dataService.getAllNeighborhoods()) {
    const briefing = areaBriefing(area.id)!;
    assert.ok(briefing);
    for (const kind of ["news", "social", "combined"] as const) {
      assert.ok(briefing[kind].summary);
      for (const theme of briefing[kind].themes)
        for (const id of theme.recordIds) {
          const record = evidenceById.get(id)!;
          assert.ok(record, id);
          assert.equal(record.areaId, area.id);
          if (kind !== "combined") assert.equal(record.kind, kind);
        }
    }
  }
  for (const kind of ["news", "social", "combined"] as const)
    for (const theme of briefings.city[kind].themes)
      for (const id of theme.recordIds) {
        assert.ok(evidenceById.has(id));
        if (kind !== "combined") assert.equal(evidenceById.get(id)!.kind, kind);
      }
});

test("the map blend uses the displayed dimension indices and excludes zero weights", () => {
  const layers = dimensions.map((d) => d.id);
  const weights = {
    demographics: 1,
    crime: 1,
    amenities: 1,
    social: 0.8,
    news: 0.6,
  };
  for (const area of dataService.getAllNeighborhoods()) {
    const result = dataService.calculateCompositeScore(
      area.id,
      layers,
      weights,
    );
    let numerator = 0,
      denominator = 0;
    for (const d of result.breakdown) {
      const layer = d.category as (typeof layers)[number];
      assert.equal(d.raw_score, dataService.getDimensionScore(area.id, layer));
      const effective = weights[layer] * d.data_quality;
      numerator += d.raw_score * effective;
      denominator += effective;
    }
    assert.ok(
      Math.abs(result.composite_score - numerator / denominator) < 1e-12,
    );
  }
  assert.equal(
    dataService.calculateCompositeScore("brickell", ["news"], {
      ...weights,
      news: 0,
    }).breakdown.length,
    0,
  );
  assert.equal(
    dataService.getTrendData("downtown_miami", "amenities", "90d"),
    null,
  );
});
