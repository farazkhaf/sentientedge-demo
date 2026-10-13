import { createDataset } from "../lib/storage/dataset";
import { placeCategory } from "../lib/intelligence/places";
import type { WorkspaceSnapshot } from "../lib/storage/snapshot";
export function buildSeedSql(seedSnapshot: WorkspaceSnapshot) {
  const quote = (value: unknown) =>
    typeof value === "number"
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
  const rows: string[] = [];
  function insert(table: string, values: Record<string, unknown>) {
    rows.push(
      `INSERT OR REPLACE INTO ${table} (${Object.keys(values).join(",")}) VALUES (${Object.values(values).map(quote).join(",")});`,
    );
  }
  const dataset = createDataset(seedSnapshot);
  insert("snapshot_metadata", {
    id: seedSnapshot.briefings.id,
    label: seedSnapshot.briefings.label,
    version: 1,
  });
  for (const area of dataset.dataService.getAllNeighborhoods())
    insert("areas", area);
  for (const dimension of [
    "demographics",
    "crime",
    "amenities",
    "social",
    "news",
  ] as const)
    for (const original of seedSnapshot[dimension]) {
      const payload = { ...original } as Record<string, unknown>;
      delete payload.events;
      delete payload.posts;
      insert("profiles", {
        area_id: original.neighborhood_id,
        dimension,
        score: dataset.dataService.getDimensionScore(
          original.neighborhood_id,
          dimension,
        ),
        updated_at: original.last_updated,
        payload: JSON.stringify(payload),
      });
    }
  dataset.evidenceRecords.forEach((record, position) =>
    insert("records", {
      id: record.id,
      area_id: record.areaId,
      kind: record.kind,
      recorded_at: record.date,
      category: record.category,
      text: record.text,
      payload: JSON.stringify(record),
      position,
    }),
  );
  for (const area of [
    { id: "miami", ...seedSnapshot.briefings.city },
    ...seedSnapshot.briefings.areas,
  ])
    for (const kind of ["combined", "news", "social"] as const)
      insert("briefings", {
        area_id: area.id,
        kind,
        headline: area[kind].headline,
        summary: area[kind].summary,
        themes: JSON.stringify(area[kind].themes),
      });
  for (const permit of seedSnapshot.permits)
    insert("permits", {
      area_id: permit.neighborhood_id,
      count_30d: permit.permit_count_30d,
      declared_value: permit.total_value_30d,
      payload: JSON.stringify(permit),
    });
  seedSnapshot.places.forEach((place, position) =>
    insert("places", {
      id: place.properties.id,
      longitude: place.geometry.coordinates[0],
      latitude: place.geometry.coordinates[1],
      category: placeCategory(place).id,
      amenity_count: place.properties.amenity_count,
      radius_m: place.properties.radius_m,
      payload: JSON.stringify(place),
      position,
    }),
  );

  // No usage counters or owner controls are included in the public seed.
  return "BEGIN;\n" + rows.join("\n") + "\nCOMMIT;\n";
}
