import test from "node:test";
import assert from "node:assert/strict";
import {
  createInvestigationTools,
  type InvestigationEffects,
} from "../lib/intelligence/assistant-tools";
import { createDataset } from "../lib/storage/dataset";
import { seedSnapshot } from "../scripts/seed-fixtures";
const dataset = createDataset(seedSnapshot);
const { evidenceById, recordsFor } = dataset;
const { profile, runInvestigationTool } = createInvestigationTools(dataset);
const effects = (): InvestigationEffects => ({
  artifacts: [],
  evidenceIds: [],
});

test("assistant outputs preserve area scope, dimensions, missing values and supplied evidence", () => {
  const output = effects();
  runInvestigationTool(
    "read_briefing",
    { areaId: "allapattah", kind: "social" },
    output,
  );
  assert.equal(output.artifacts[0].type, "briefing");
  assert.ok(output.evidenceIds.length > 0);
  for (const id of output.evidenceIds) {
    assert.equal(evidenceById.get(id)?.areaId, "allapattah");
    assert.equal(evidenceById.get(id)?.kind, "social");
  }
  runInvestigationTool(
    "build_comparison",
    { areaIds: ["midtown", "brickell"] },
    output,
  );
  const comparison = output.artifacts[1];
  assert.equal(comparison.type, "comparison");
  if (comparison.type !== "comparison") return;
  assert.equal(
    comparison.profiles[0].dimensions.find((d) => d.id === "crime")?.value,
    null,
  );
  assert.equal(
    comparison.profiles[1].metrics.news,
    recordsFor("brickell", "news").length,
  );
  assert.equal(
    comparison.profiles[1].metrics.community,
    recordsFor("brickell", "social").length,
  );
});

test("chart counts and timeline coverage reconcile, with history gaps retained", () => {
  const output = effects();
  runInvestigationTool(
    "build_chart",
    { areaIds: [], metric: "news_categories" },
    output,
  );
  const chart = output.artifacts[0];
  assert.equal(chart.type, "chart");
  if (chart.type === "chart")
    assert.equal(
      chart.points.reduce((total, p) => total + p.value, 0),
      67,
    );
  const timeline = runInvestigationTool(
    "build_timeline",
    { areaIds: ["little_havana"], kind: "combined", query: "" },
    output,
  ) as { total: number; records: { areaId: string; date: string }[] };
  assert.equal(timeline.total, recordsFor("little_havana").length);
  assert.ok(timeline.records.every((r) => r.areaId === "little_havana"));
  assert.deepEqual(
    timeline.records.map((r) => r.date),
    timeline.records
      .map((r) => r.date)
      .sort()
      .reverse(),
  );
  runInvestigationTool(
    "build_trend",
    { areaIds: ["downtown_miami"], dimension: "amenities" },
    output,
  );
  const trend = output.artifacts.at(-1)!;
  assert.equal(trend.type, "trend");
  if (trend.type === "trend") {
    assert.equal(trend.series.length, 0);
    assert.deepEqual(trend.missing, ["Downtown Miami"]);
  }
  assert.equal(
    profile("brickell").metrics.news,
    recordsFor("brickell", "news").length,
  );
});

test("assistant comparison uses the actual selected layer blend", () => {
  const blend = {
    activeLayers: ["news", "amenities"] as ("news" | "amenities")[],
    layerWeights: {
      demographics: 0,
      crime: 0,
      amenities: 1.8,
      social: 0,
      news: 0,
    },
  };
  const output: InvestigationEffects = { ...effects(), blend };
  runInvestigationTool(
    "build_comparison",
    { areaIds: ["brickell", "allapattah"] },
    output,
  );
  const comparison = output.artifacts[0];
  if (comparison.type !== "comparison")
    return assert.fail("Expected a comparison");
  for (const p of comparison.profiles) {
    assert.equal(p.weightedProfile?.dimensions, 1);
    assert.ok(
      Math.abs(
        p.weightedProfile!.value! -
          p.dimensions.find((d) => d.id === "amenities")!.value!,
      ) < 1e-12,
    );
  }
});

test("tools reject unsupported areas, arbitrary metrics, duplicate comparison and invalid dates", () => {
  const output = effects();
  const call = (name: string, args: unknown) =>
    assert.ok("error" in (runInvestigationTool(name, args, output) as object));
  call("get_profiles", { areaIds: ["boston"] });
  call("build_chart", { areaIds: ["brickell"], metric: "housing_forecast" });
  call("build_comparison", { areaIds: ["brickell", "brickell"] });
  call("propose_map", {
    view: "compare",
    areaIds: ["brickell"],
    dimensions: ["news"],
    layer: "profile",
  });
  call("search_records", {
    areaIds: [],
    kind: "combined",
    query: "",
    category: "",
    tone: "all",
    startDate: "2026-06-01",
    endDate: "2026-05-01",
  });
  call("execute_script", { code: "anything" });
  assert.equal(output.artifacts.length, 0);
});
