import { z } from "zod";
import type { Dataset } from "@/lib/storage/dataset";
import { getAllNeighborhoods } from "@/lib/data/neighborhoods";
import { TREND_CONFIG } from "@/lib/types/data";
import { dimensions, distribution, sourceCount } from "./briefings";
import type {
  InvestigationAction,
  InvestigationArtifact,
  Profile,
} from "./assistant-contract";

export const areas = getAllNeighborhoods().map(({ id, name }) => ({
  id,
  name,
}));
export const isArea = (id: string) => areas.some((area) => area.id === id);
export type InvestigationEffects = {
  artifacts: InvestigationArtifact[];
  evidenceIds: string[];
  blend?: {
    activeLayers: Profile["dimensions"][number]["id"][];
    layerWeights: Record<Profile["dimensions"][number]["id"], number>;
  };
};

export function createInvestigationTools(dataset: Dataset) {
  const {
    dataService,
    permits,
    briefings,
    areaBriefing,
    recordsFor,
    evidenceById,
    evidenceRecords,
  } = dataset;
  const ids = z
    .array(z.string().refine(isArea, "Unknown Miami neighborhood"))
    .max(4);
  const dimension = z.enum([
    "demographics",
    "crime",
    "amenities",
    "social",
    "news",
  ]);
  const kind = z.enum(["combined", "news", "social"]);
  const metric = z.enum([
    "income",
    "density",
    "walkability",
    "permits",
    "news",
    "community",
    "news_categories",
    "community_tone",
  ]);
  const actionSchema = z
    .object({
      view: z.enum(["explore", "intelligence", "compare"]),
      areaIds: ids,
      layer: z.enum(["profile", "permits"]),
      dimensions: z.array(dimension).max(5),
    })
    .strict();
  const schemas = {
    lookup_areas: z.object({ query: z.string().max(100) }).strict(),
    read_briefing: z
      .object({
        areaId: z.string().refine((id) => id === "miami" || isArea(id)),
        kind,
      })
      .strict(),
    get_profiles: z.object({ areaIds: ids.min(1) }).strict(),
    search_records: z
      .object({
        areaIds: ids,
        kind,
        query: z.string().max(160),
        category: z.string().max(80),
        tone: z.enum(["all", "positive", "neutral", "negative"]),
        startDate: z.string().date().nullable(),
        endDate: z.string().date().nullable(),
      })
      .strict(),
    read_records: z
      .object({ recordIds: z.array(z.string().max(100)).min(1).max(8) })
      .strict(),
    build_comparison: z.object({ areaIds: ids.min(2) }).strict(),
    build_chart: z.object({ areaIds: ids, metric }).strict(),
    build_trend: z.object({ areaIds: ids.min(1), dimension }).strict(),
    build_timeline: z
      .object({ areaIds: ids, kind, query: z.string().max(160) })
      .strict(),
    propose_map: actionSchema,
  };
  const object = (properties: Record<string, unknown>) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
  const jsonIds = {
    type: "array",
    items: { type: "string", enum: areas.map((a) => a.id) },
    maxItems: 4,
  };
  const jsonKind = { type: "string", enum: kind.options };
  const jsonDimension = { type: "string", enum: dimension.options };
  const descriptions: Record<keyof typeof schemas, string> = {
    lookup_areas:
      "Resolve Miami neighborhood names to stable IDs. Empty query lists all 23. Geometry is not returned.",
    read_briefing:
      "Read and display a prepared city or area briefing and referenced evidence. areaId miami means city. Use for summaries, news or community briefings. Does not fetch fresh data.",
    get_profiles:
      "Read aligned dimension indices and raw reference metrics for 1–4 areas. Returns explicit units and missing values. No composite neighborhood-quality claim.",
    search_records:
      "Search included news/community records by area, kind, text, category, tone and dates. Empty areaIds means city. Empty query/category and null dates disable those filters. Returns exact total and up to 8 matching records.",
    read_records:
      "Retrieve full source-linked records by exact news: or social: IDs from search/briefings.",
    build_comparison:
      "Display an aligned table for 2–4 areas, including all five dimension scores and meaningful raw metrics. Use for a comparison request.",
    build_chart:
      "Display a horizontal bar chart calculated from the stored dataset. Income USD, density people/km², walkability 0–100, permits preceding 30d, news/community counts included records. Categories/tone group records; empty areaIds means city only for those distributions. No invented values.",
    build_trend:
      "Display line charts of compatible stored dimension index history for 1–4 areas. Returns actual dates and explicit missing areas; cannot fabricate unavailable history.",
    build_timeline:
      "Display up to 10 matching records ordered by their stored dates, most recent first. Record counts are not deduplicated events. Empty areaIds means city; empty query matches all.",
    propose_map:
      "Display a geographic action the user can open in the map workspace. Choose areas, profile/permits overlay, and enabled dimensions. Empty areas means Miami; compare requires 2–4. Nothing changes until the user opens it.",
  };
  const params: Record<keyof typeof schemas, unknown> = {
    lookup_areas: object({ query: { type: "string" } }),
    read_briefing: object({
      areaId: { type: "string", enum: ["miami", ...areas.map((a) => a.id)] },
      kind: jsonKind,
    }),
    get_profiles: object({ areaIds: { ...jsonIds, minItems: 1 } }),
    search_records: object({
      areaIds: jsonIds,
      kind: jsonKind,
      query: { type: "string" },
      category: { type: "string" },
      tone: {
        type: "string",
        enum: ["all", "positive", "neutral", "negative"],
      },
      startDate: { type: ["string", "null"] },
      endDate: { type: ["string", "null"] },
    }),
    read_records: object({
      recordIds: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8,
      },
    }),
    build_comparison: object({ areaIds: { ...jsonIds, minItems: 2 } }),
    build_chart: object({
      areaIds: jsonIds,
      metric: { type: "string", enum: metric.options },
    }),
    build_trend: object({
      areaIds: { ...jsonIds, minItems: 1 },
      dimension: jsonDimension,
    }),
    build_timeline: object({
      areaIds: jsonIds,
      kind: jsonKind,
      query: { type: "string" },
    }),
    propose_map: object({
      view: { type: "string", enum: ["explore", "intelligence", "compare"] },
      areaIds: jsonIds,
      layer: { type: "string", enum: ["profile", "permits"] },
      dimensions: { type: "array", items: jsonDimension, maxItems: 5 },
    }),
  };
  const investigationTools = Object.keys(schemas).map((name) => ({
    type: "function",
    name,
    description: descriptions[name as keyof typeof schemas],
    parameters: params[name as keyof typeof schemas],
    strict: true,
  }));
  function profile(id: string, blend?: InvestigationEffects["blend"]): Profile {
    const a = dataService.getAllDataForNeighborhood(id)!;
    const composite = blend
      ? dataService.calculateCompositeScore(
          id,
          blend.activeLayers,
          blend.layerWeights,
        )
      : null;
    return {
      id,
      name: a.name,
      headline: areaBriefing(id)?.combined.headline ?? "",
      ...(composite
        ? {
            weightedProfile: {
              value: composite.breakdown.length
                ? composite.composite_score
                : null,
              dimensions: composite.breakdown.length,
            },
          }
        : {}),
      dimensions: dimensions.map((d) => ({
        id: d.id,
        label: d.label,
        value: dataService.getDimensionScore(id, d.id),
      })),
      metrics: {
        income: a.demographics?.metrics.median_income ?? null,
        density: a.demographics?.metrics.population_density ?? null,
        walkability: a.amenities?.walkability_score ?? null,
        permits:
          permits.find((p) => p.neighborhood_id === id)?.permit_count_30d ??
          null,
        news: recordsFor(id, "news").length,
        community: recordsFor(id, "social").length,
      },
    };
  }
  const metricLabels = {
    income: ["Median household income", "USD", "May 2026 reference"],
    density: ["Population density", "people/km²", "May 2026 reference"],
    walkability: ["Walkability", "0–100 index", "May 2026 reference"],
    permits: ["Building permits", "permits", "Preceding 30 days · May 2026"],
    news: ["Included news", "records", "Included record dates"],
    community: ["Included community notes", "records", "Included record dates"],
  };
  function filtered(
    areaIds: string[],
    requestedKind: "combined" | "news" | "social",
    query: string,
  ) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return evidenceRecords.filter(
      (r) =>
        (!areaIds.length || areaIds.includes(r.areaId)) &&
        (requestedKind === "combined" || r.kind === requestedKind) &&
        terms.every((t) =>
          `${r.text} ${r.category} ${r.sources.map((s) => s.name).join(" ")}`
            .toLowerCase()
            .includes(t),
        ),
    );
  }
  function runInvestigationTool(
    name: string,
    args: unknown,
    effects: InvestigationEffects,
  ): unknown {
    if (!Object.hasOwn(schemas, name)) return { error: "Unknown tool" };
    const key = name as keyof typeof schemas;
    const parsed = schemas[key].safeParse(args);
    if (!parsed.success)
      return {
        error: "Invalid arguments",
        details: parsed.error.issues.map((i) => i.message),
      };
    const add = (artifact: InvestigationArtifact) => {
      if (
        effects.artifacts.length < 4 &&
        !effects.artifacts.some(
          (a) => JSON.stringify(a) === JSON.stringify(artifact),
        )
      )
        effects.artifacts.push(artifact);
    };
    if (key === "lookup_areas") {
      const { query } = parsed.data as z.infer<typeof schemas.lookup_areas>;
      const q = query.toLowerCase().replace(/[_/]+/g, " ").trim();
      return areas.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.replace(/[_/]+/g, " ").includes(q),
      );
    }
    if (key === "read_briefing") {
      const { areaId, kind } = parsed.data as z.infer<
        typeof schemas.read_briefing
      >;
      const section =
        areaId === "miami" ? briefings.city[kind] : areaBriefing(areaId)![kind];
      const artifact: InvestigationArtifact = {
        type: "briefing",
        areaId: areaId === "miami" ? null : areaId,
        areaName: areas.find((a) => a.id === areaId)?.name ?? "Miami",
        kind,
        section,
      };
      add(artifact);
      const refs = section.themes.flatMap((t) => t.recordIds);
      effects.evidenceIds.push(...refs);
      return {
        ...artifact,
        evidence: [...new Set(refs)]
          .slice(0, 8)
          .map((id) => evidenceById.get(id)),
      };
    }
    if (key === "get_profiles" || key === "build_comparison") {
      const { areaIds } = parsed.data as z.infer<typeof schemas.get_profiles>;
      if (new Set(areaIds).size !== areaIds.length)
        return { error: "Choose distinct areas" };
      const profiles = areaIds.map((id) => profile(id, effects.blend));
      if (key === "build_comparison") add({ type: "comparison", profiles });
      return {
        profiles,
        metricComparisons: (
          Object.keys(metricLabels) as (keyof typeof metricLabels)[]
        ).map((metric) => ({
          metric,
          descending: profiles
            .filter((p) => p.metrics[metric] !== null)
            .map((p) => ({ area: p.name, value: p.metrics[metric]! }))
            .sort((a, b) => b.value - a.value),
        })),
        units: metricLabels,
        indices:
          "−1 to +1; news dimension is an activity index, social dimension is a tone index",
        countMeaning:
          "metrics.news and metrics.community are actual included record counts. Do not infer volume from indices.",
        basis:
          "Numeric reference fixtures; news and community counts are included records, not events",
      };
    }
    if (key === "search_records" || key === "build_timeline") {
      const f = parsed.data as z.infer<typeof schemas.search_records>;
      if (f.startDate && f.endDate && f.startDate > f.endDate)
        return { error: "Start date must precede end date" };
      const records = filtered(f.areaIds, f.kind, f.query)
        .filter(
          (r) =>
            key === "build_timeline" ||
            ((!f.category ||
              r.category.toLowerCase() === f.category.toLowerCase()) &&
              (f.tone === "all" || r.tone === f.tone) &&
              (!f.startDate || r.date.slice(0, 10) >= f.startDate) &&
              (!f.endDate || r.date.slice(0, 10) <= f.endDate)),
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      const returned = records.slice(0, key === "build_timeline" ? 10 : 8);
      effects.evidenceIds.push(...returned.map((r) => r.id));
      if (key === "build_timeline")
        add({
          type: "timeline",
          title: "Reported developments & perspectives",
          records: returned,
          total: records.length,
        });
      return {
        total: records.length,
        sourceDomains: sourceCount(records),
        returned: returned.length,
        records: returned,
        dateMeaning: "Stored record dates",
      };
    }
    if (key === "read_records") {
      const { recordIds } = parsed.data as z.infer<typeof schemas.read_records>;
      effects.evidenceIds.push(
        ...recordIds.filter((id) => evidenceById.has(id)),
      );
      return recordIds.map(
        (id) => evidenceById.get(id) ?? { id, error: "Record not found" },
      );
    }
    if (key === "build_chart") {
      const { areaIds, metric } = parsed.data as z.infer<
        typeof schemas.build_chart
      >;
      let artifact: Extract<InvestigationArtifact, { type: "chart" }>;
      if (metric === "news_categories" || metric === "community_tone") {
        const records = filtered(
          areaIds,
          metric === "news_categories" ? "news" : "social",
          "",
        );
        artifact = {
          type: "chart",
          title:
            metric === "news_categories"
              ? "News by topic"
              : "Community notes by tone",
          unit: "included records",
          period: areaIds.length
            ? areaIds.map((id) => profile(id).name).join(" · ")
            : "Miami · all included records",
          points: distribution(
            records,
            metric === "news_categories" ? "category" : "tone",
          ),
          missing: [],
        };
      } else {
        if (!areaIds.length)
          return { error: "Choose 1–4 neighborhoods for this metric" };
        const profiles = areaIds.map((id) => profile(id));
        const [title, unit, period] = metricLabels[metric];
        artifact = {
          type: "chart",
          title,
          unit,
          period,
          points: profiles
            .filter((a) => a.metrics[metric] !== null)
            .map((a) => ({ label: a.name, value: a.metrics[metric]! })),
          missing: profiles
            .filter((a) => a.metrics[metric] === null)
            .map((a) => a.name),
        };
      }
      add(artifact);
      return artifact;
    }
    if (key === "build_trend") {
      const { areaIds, dimension } = parsed.data as z.infer<
        typeof schemas.build_trend
      >;
      const series = areaIds.map((id) => ({
        name: profile(id).name,
        points:
          dataService.getTrendData(
            id,
            dimension,
            TREND_CONFIG[dimension].default_window,
          )?.points ?? [],
      }));
      const artifact: InvestigationArtifact = {
        type: "trend",
        title: `${dimensions.find((d) => d.id === dimension)!.label} index history`,
        unit: "Index · −1 to +1",
        series: series.filter((s) => s.points.length),
        missing: series.filter((s) => !s.points.length).map((s) => s.name),
      };
      add(artifact);
      return artifact;
    }
    const action = parsed.data as InvestigationAction;
    if (action.view === "compare" && new Set(action.areaIds).size < 2)
      return { error: "Comparison requires 2–4 distinct areas" };
    const unique = {
      ...action,
      areaIds: [...new Set(action.areaIds)],
      dimensions: [...new Set(action.dimensions)],
    };
    add({
      type: "map",
      action: unique,
      areaNames: unique.areaIds.map((id) => profile(id).name),
    });
    return {
      proposed: unique,
      buttonLabel: `Open in ${unique.view === "compare" ? "Compare" : unique.view === "intelligence" ? "Intelligence" : "Explore"}`,
      requiresUserClick: true,
    };
  }

  return { investigationTools, profile, runInvestigationTool, actionSchema };
}
