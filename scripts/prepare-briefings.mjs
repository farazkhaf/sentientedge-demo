// One-time snapshot editing utility. Never runs as part of the application.
import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(`lib/data/${name}.json`, root), "utf8"));
const news = await read("news");
const social = await read("social");
const geometry = await read("neighborhoods_boundaries");
const areas = geometry.features.map(({ properties }) => ({
  id: properties.id,
  name: properties.name,
}));
const env = await readFile(new URL(".env.local", root), "utf8");
const key = env.match(/^OPENAI_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
if (!key)
  throw new Error(
    "OPENAI_API_KEY is required for one-time summary preparation.",
  );
const sectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    themes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          recordIds: { type: "array", items: { type: "string" } },
        },
        required: ["title", "summary", "recordIds"],
      },
    },
  },
  required: ["headline", "summary", "themes"],
};
const areaSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    news: sectionSchema,
    social: sectionSchema,
    combined: sectionSchema,
  },
  required: ["id", "news", "social", "combined"],
};
const schema = {
  type: "object",
  additionalProperties: false,
  properties: { areas: { type: "array", items: areaSchema } },
  required: ["areas"],
};
const instructions = `Write concise product briefings for a frozen Miami urban intelligence workspace. Use only the supplied curated records. No research, no invented numbers, forecasts, causes or consensus. Describe what the records report, not independently verified city conditions. News and community material overlap: do not treat them as independent confirmations. Community material includes reported resident perspectives and journalism, not a representative survey. Attribute attitudes to the actual speaker: a developer's promotional quote is NOT evidence that residents welcome, celebrate or support a project. Do not infer neighborhood-wide opinion from a record's positive/negative tone. News sections use ONLY news input; community sections use ONLY social input. Combined sections may use both. Use compact plain language; avoid claims of a citywide boom or market momentum based on a few curated stories.
For EACH area write: a news briefing, a community briefing, and a combined briefing. Each headline is an informative 5–11 word takeaway, NOT a generic label. Each summary is 35–65 words. Each section has 2 or 3 meaningful themes, each with a short title, 15–35 word explanation, and 1–3 record IDs that directly support it. Prefix every news ID with news: and every community ID with social: to prevent ID collisions. Combined themes may use either. Do not refer to data availability or demo status repeatedly; focus on useful reported context. Summaries must balance opportunities with concerns present in the records. Avoid promotional claims, vague adjectives, Markdown and boilerplate. Record dates need not be current: do not say a past event just happened. Only use supplied area IDs.`;
async function generate(input, responseSchema, prompt = instructions) {
  const constrained = JSON.parse(JSON.stringify(responseSchema));
  const allowed = input.flatMap((a) =>
    [...a.news, ...a.social].map((x) => x.id),
  );
  const constrain = (s, kind = "combined") => {
    if (s.properties?.recordIds)
      s.properties.recordIds.items.enum = allowed.filter(
        (id) => kind === "combined" || id.startsWith(kind + ":"),
      );
    for (const [name, v] of Object.entries(s.properties || {}))
      constrain(v, ["news", "social", "combined"].includes(name) ? name : kind);
    if (s.items) constrain(s.items, kind);
  };
  constrain(constrained);
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      reasoning: { effort: "none" },
      store: false,
      instructions: prompt,
      input: JSON.stringify(input),
      max_output_tokens: 12500,
      text: {
        format: {
          type: "json_schema",
          name: "snapshot_briefings",
          strict: true,
          schema: constrained,
        },
      },
    }),
    signal: AbortSignal.timeout(150000),
  });
  if (!res.ok)
    throw new Error(`Summary preparation returned HTTP ${res.status}`);
  const result = await res.json();
  const text = result.output
    .flatMap((x) => x.content || [])
    .filter((x) => x.type === "output_text")
    .map((x) => x.text)
    .join("");
  return JSON.parse(text);
}
const entries = areas.map((a) => ({
  ...a,
  news: (news.find((x) => x.neighborhood_id === a.id)?.events || []).map(
    (e) => ({
      id: `news:${e.id}`,
      category: e.category,
      text: e.summary,
      date: e.timestamp.slice(0, 10),
    }),
  ),
  social: (social.find((x) => x.neighborhood_id === a.id)?.posts || []).map(
    (e) => ({
      id: `social:${e.id}`,
      tone: e.sentiment,
      text: e.text,
      date: e.timestamp.slice(0, 10),
    }),
  ),
}));
const groups = [entries.slice(0, 8), entries.slice(8, 16), entries.slice(16)];
const sections = (
  await Promise.all(groups.map((g) => generate(g, schema)))
).flatMap((x) => x.areas);
for (const a of sections) {
  const original = entries.find((x) => x.id === a.id);
  if (!original) throw new Error("Unknown area in summary");
  const ids = new Set([...original.news, ...original.social].map((x) => x.id));
  for (const section of [a.news, a.social, a.combined])
    for (const t of section.themes)
      if (!t.recordIds.length || t.recordIds.some((id) => !ids.has(id)))
        throw new Error(`Invalid supporting record for ${a.id}`);
}
if (new Set(sections.map((x) => x.id)).size !== areas.length)
  throw new Error("Summary coverage is incomplete");
const citySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    news: sectionSchema,
    social: sectionSchema,
    combined: sectionSchema,
  },
  required: ["news", "social", "combined"],
};
const city = await generate(
  entries,
  citySchema,
  `Write a Miami-wide news briefing, community briefing and combined briefing from the supplied curated neighborhood records. Summarize cross-area themes, not a list of neighborhood blurbs. A headline is 5–11 words; summary is 55–85 words; each section has 3 themes, each title 3–7 words and explanation 25–45 words. Cite themes using 2–4 supplied record IDs prefixed news: or social:. News uses ONLY news records; community uses ONLY social records; combined may use both. Use only the records. Do not invent citywide measurements, forecasts, causal relationships or a representative public consensus. Attribute opinions to the actual speaker; developer promotional claims do not demonstrate resident support. Each theme's citations must support ALL named neighborhoods and factual claims in that theme. Frame news and resident concerns as reported perspectives. Avoid inferring a citywide boom or market momentum from curated stories. The records are a frozen snapshot and dates vary; avoid 'today', 'currently', or live reporting language. No repetitive caveats or Markdown.`,
);
const ids = new Set(
  entries.flatMap((a) => [...a.news, ...a.social].map((x) => x.id)),
);
for (const s of Object.values(city))
  for (const t of s.themes)
    if (t.recordIds.some((id) => !ids.has(id)))
      throw new Error("Invalid city evidence");
await writeFile(
  new URL("lib/data/briefings.json", root),
  JSON.stringify(
    { id: "miami-briefings-2026-05", label: "May 2026", areas: sections, city },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${sections.length} area briefings and Miami overview from existing records.`,
);
