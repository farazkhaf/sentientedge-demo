"use client";
import { useDataset } from "./dataset-provider";

import { useState } from "react";
import {
  Bookmark,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  GitCompareArrows,
  X,
  ArrowUpRight,
  ChartNoAxesCombined,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppStore } from "@/lib/store/app-store";

import { TREND_CONFIG, type LayerType } from "@/lib/types/data";
import {
  currency,
  dateLabel,
  dimensions,
  distribution,
  monthlyActivity,
  signed,
  sourceCount,
  type BriefingKind,
  type BriefingSection,
  type EvidenceRecord,
} from "@/lib/intelligence/briefings";
import { PermitActivity } from "./context-inspection";

type PanelTab = "briefing" | "permits" | LayerType;
const tabs: { id: PanelTab; label: string }[] = [
  { id: "briefing", label: "Briefing" },
  { id: "news", label: "News" },
  { id: "social", label: "Community" },
  { id: "demographics", label: "Demographics" },
  { id: "crime", label: "Safety" },
  { id: "amenities", label: "Amenities" },
];

export function EvidenceCard({
  record,
  showArea = false,
}: {
  record: EvidenceRecord;
  showArea?: boolean;
}) {
  const significance = record.significance;
  return (
    <article
      className={`se-evidence ${record.tone ? `tone-${record.tone}` : ""}`}
    >
      <div className="se-record-meta">
        <span>{showArea ? record.areaName : record.category}</span>
        <time>{dateLabel(record.date)}</time>
      </div>
      <div className="se-record-signal">
        {record.kind === "news" ? (
          <span className="se-importance">
            Significance{" "}
            <strong>
              {significance == null ? "—" : significance.toFixed(2)}
            </strong>
            <i style={{ width: `${(significance ?? 0) * 100}%` }} />
          </span>
        ) : (
          <span className={`se-tone ${record.tone}`}>
            {record.tone} perspective
          </span>
        )}
      </div>
      <p>{record.text}</p>
      <div className="se-source-links">
        {record.sources.map((s, i) => (
          <a
            key={`${s.url}-${i}`}
            href={s.url}
            target="_blank"
            rel="noreferrer"
          >
            {s.name}
            <ExternalLink size={11} />
          </a>
        ))}
      </div>
    </article>
  );
}

function ThemeBriefing({
  section,
  city,
}: {
  section: BriefingSection;
  city: boolean;
}) {
  const { evidenceById } = useDataset();

  return (
    <div className="se-themes">
      {section.themes.map((theme, index) => {
        const records = theme.recordIds
          .map((id) => evidenceById.get(id))
          .filter((r): r is EvidenceRecord => Boolean(r));
        return (
          <details className="se-theme" key={theme.title}>
            <summary>
              <span className="se-theme-number">0{index + 1}</span>
              <span>
                <strong>{theme.title}</strong>
                <p>{theme.summary}</p>
                <small>
                  {records.length} supporting record
                  {records.length === 1 ? "" : "s"}
                </small>
              </span>
              <ChevronRight size={16} className="se-disclosure" />
            </summary>
            <div className="se-theme-evidence">
              {records.map((r) => (
                <EvidenceCard key={r.id} record={r} showArea={city} />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function HorizontalBars({
  rows,
  suffix = "",
  color = "#688f86",
  max,
}: {
  rows: { label: string; value: number }[];
  suffix?: string;
  color?: string;
  max?: number;
}) {
  const highest = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="se-bars">
      {rows.map((r) => (
        <div className="se-bar-row" key={r.label}>
          <span>{r.label.replaceAll("_", " ")}</span>
          <div>
            <i
              style={{
                width: `${Math.min(100, (r.value / highest) * 100)}%`,
                background: color,
              }}
            />
          </div>
          <strong>
            {r.value.toLocaleString()}
            {suffix}
          </strong>
        </div>
      ))}
    </div>
  );
}

function RecordAnalysis({
  records,
  kind,
}: {
  records: EvidenceRecord[];
  kind: "news" | "social";
}) {
  const counts = distribution(records, kind === "news" ? "category" : "tone");
  const activity = monthlyActivity(records);
  const sources = sourceCount(records);
  return (
    <section className="se-section se-record-analysis">
      <div className="se-section-title">
        <h3>
          {kind === "news" ? "Coverage & activity" : "Reported perspectives"}
        </h3>
        <span>{sources} sources</span>
      </div>
      <HorizontalBars
        rows={counts}
        color={kind === "news" ? "#688da6" : "#b69663"}
      />
      {activity.length > 1 && (
        <div className="se-activity-chart">
          <div className="se-chart-label">
            Records by month{" "}
            <span>
              Record dates · {activity[0].month} – {activity.at(-1)!.month}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={115}>
            <BarChart
              data={activity}
              margin={{ top: 8, right: 0, left: -24, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--se-line)" />
              <XAxis
                dataKey="month"
                tickFormatter={(v) =>
                  new Date(`${v}-01T00:00:00Z`).toLocaleDateString("en-US", {
                    month: "short",
                    timeZone: "UTC",
                  })
                }
                tick={{ fontSize: 11, fill: "var(--se-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--se-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(v) => String(v)}
                contentStyle={{
                  fontSize: 12,
                  borderColor: "var(--se-line)",
                  borderRadius: 6,
                }}
              />
              <Bar
                isAnimationActive={false}
                dataKey="count"
                name="Records"
                fill={kind === "news" ? "#688da6" : "#b69663"}
                radius={[2, 2, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function DimensionProfile({
  id,
  onSelect,
}: {
  id: string;
  onSelect: (tab: PanelTab) => void;
}) {
  const { dataService } = useDataset();

  const { activeLayers, layerWeights } = useAppStore();
  return (
    <section className="se-section">
      <div className="se-section-title">
        <h3>Dimension profile</h3>
        <span>−1 to +1</span>
      </div>
      <div className="se-dimension-profile">
        {dimensions.map((d) => {
          const score = dataService.getDimensionScore(id, d.id);
          const included =
            activeLayers.includes(d.id) && layerWeights[d.id] > 0;
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={included ? "" : "is-excluded"}
            >
              <span
                className="se-dimension-dot"
                style={{ background: d.color }}
              />
              <span className="se-dimension-label">
                {d.label}
                <small>
                  {d.id === "news"
                    ? "Activity"
                    : d.id === "social"
                      ? "Tone"
                      : included
                        ? `${layerWeights[d.id].toFixed(1)}× weight`
                        : "Outside current blend"}
                </small>
              </span>
              <span className="se-index-track">
                <i className="se-index-zero" />
                {score !== null && (
                  <i
                    className="se-index-fill"
                    style={{
                      width: `${(score + 1) * 50}%`,
                      background: dataService.getScoreColor(score),
                    }}
                  />
                )}
              </span>
              <strong
                style={{
                  color:
                    score == null
                      ? "#89918f"
                      : dataService.getScoreColor(score),
                }}
              >
                {score == null ? "—" : signed(score)}
              </strong>
              <ChevronRight size={13} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProfileDetail({ id, layer }: { id: string; layer: LayerType }) {
  const { dataService } = useDataset();

  const data = dataService.getAllDataForNeighborhood(id)!;
  const definition = dimensions.find((d) => d.id === layer)!;
  const score = dataService.getDimensionScore(id, layer);
  const trend = dataService.getTrendData(
    id,
    layer,
    TREND_CONFIG[layer].default_window,
  );
  if (score == null)
    return (
      <div className="se-empty">
        <h3>No safety profile for this area</h3>
        <p>Explore its other dimensions or return to the combined briefing.</p>
      </div>
    );
  return (
    <>
      <section className="se-index-detail">
        <span className="se-eyebrow">{definition.meaning}</span>
        <div>
          <strong style={{ color: dataService.getScoreColor(score) }}>
            {signed(score)}
          </strong>
          <span>
            −1 <i /> +1
          </span>
        </div>
        <div className="se-index-track">
          <i
            className="se-index-fill"
            style={{
              width: `${(score + 1) * 50}%`,
              background: dataService.getScoreColor(score),
            }}
          />
          <i className="se-index-zero" />
        </div>
      </section>
      {layer === "demographics" && data.demographics && (
        <>
          <section className="se-section">
            <h3>Population & households</h3>
            <div className="se-metric-grid">
              <div>
                <span>Population density</span>
                <strong>
                  {data.demographics.metrics.population_density.toLocaleString()}
                  <small> / km²</small>
                </strong>
              </div>
              <div>
                <span>Median household income</span>
                <strong>
                  {currency(data.demographics.metrics.median_income)}
                </strong>
              </div>
              <div>
                <span>Homeownership</span>
                <strong>{data.demographics.metrics.homeownership}%</strong>
              </div>
              <div>
                <span>College educated</span>
                <strong>
                  {(data.demographics.metrics.education.bachelors ?? 0) +
                    (data.demographics.metrics.education.graduate ?? 0)}
                  %
                </strong>
              </div>
            </div>
          </section>
          <section className="se-section">
            <div className="se-section-title">
              <h3>Age distribution</h3>
              <span>Share of residents</span>
            </div>
            <HorizontalBars
              rows={Object.entries(
                data.demographics.metrics.age_distribution,
              ).map(([key, value]) => ({
                label:
                  (
                    {
                      under_18: "Under 18",
                      "18_34": "18–34",
                      "35_54": "35–54",
                      "55_plus": "55+",
                    } as Record<string, string>
                  )[key] ?? key,
                value,
              }))}
              suffix="%"
              max={100}
              color={definition.color}
            />
          </section>
        </>
      )}
      {layer === "crime" && data.crime && (
        <section className="se-section">
          <div className="se-section-title">
            <h3>Incident mix</h3>
            <span>Stored category counts</span>
          </div>
          <HorizontalBars
            rows={Object.entries(data.crime.crime_types).map(
              ([key, value]) => ({
                label: (
                  {
                    violent: "Violent",
                    property: "Property",
                    quality_of_life: "Quality of life",
                  } as Record<string, string>
                )[key],
                value,
              }),
            )}
            color={definition.color}
          />
          <p className="se-caption">
            Category counts provide context; a reporting interval is not
            supplied.
          </p>
        </section>
      )}
      {layer === "amenities" && data.amenities && (
        <>
          <section className="se-section">
            <div className="se-walkability">
              <div>
                <span className="se-eyebrow">Walkability index</span>
                <strong>
                  {data.amenities.walkability_score}
                  <small> / 100</small>
                </strong>
              </div>
              <p>Explore nearby amenity clusters on the map.</p>
            </div>
          </section>
          <section className="se-section">
            <div className="se-section-title">
              <h3>Category access</h3>
              <span>Index · 0–100</span>
            </div>
            <HorizontalBars
              rows={Object.entries(data.amenities.categories).map(
                ([label, value]) => ({
                  label: label[0].toUpperCase() + label.slice(1),
                  value,
                }),
              )}
              max={100}
              color={definition.color}
            />
          </section>
        </>
      )}
      <section className="se-section">
        <div className="se-section-title">
          <h3>Index history</h3>
          <ChartNoAxesCombined size={15} />
        </div>
        {trend ? (
          <>
            <div className="se-chart-label">
              {dateLabel(trend.points[0].date)} –{" "}
              {dateLabel(trend.points.at(-1)!.date)}
              <span>
                {signed(trend.points.at(-1)!.score - trend.points[0].score)}{" "}
                index points
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart
                data={trend.points}
                margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--se-line)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })
                  }
                  tick={{ fontSize: 11, fill: "var(--se-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  domain={[-1, 1]}
                  ticks={[-1, 0, 1]}
                  tick={{ fontSize: 11, fill: "var(--se-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(v) => dateLabel(String(v))}
                  formatter={(v) => [signed(Number(v)), "Index"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Area
                  isAnimationActive={false}
                  type="linear"
                  dataKey="score"
                  stroke={definition.color}
                  fill={definition.color}
                  fillOpacity={0.08}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="se-caption">
            A compatible history is not available for this profile.
          </p>
        )}
      </section>
    </>
  );
}

export function DataDetailPanel({
  permitMode = false,
  close,
}: {
  permitMode?: boolean;
  close: () => void;
}) {
  const { dataService, briefings, areaBriefing, recordsFor } = useDataset();

  const {
    selectedNeighborhood: id,
    activeLayers,
    layerWeights,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    setSelectedNeighborhood,
    comparisonMode,
    toggleComparisonMode,
    addToComparison,
  } = useAppStore();
  const [tab, setTab] = useState<PanelTab>(permitMode ? "permits" : "briefing");
  const [areaQuery, setAreaQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tone, setTone] = useState("all");
  const kind: BriefingKind =
    tab === "social" ? "social" : tab === "news" ? "news" : "combined";
  const area = id ? areaBriefing(id) : null;
  const data = id ? dataService.getAllDataForNeighborhood(id) : null;
  const section = area ? area[kind] : briefings.city[kind];
  const records = recordsFor(id, kind);
  const newsRecords = recordsFor(id, "news");
  const socialRecords = recordsFor(id, "social");
  const index = id
    ? dataService.calculateCompositeScore(id, activeLayers, layerWeights)
    : null;
  const saved = watchlist.some((w) => w.neighborhoodId === id);
  const sources = sourceCount(records);
  const areas = dataService
    .getAllNeighborhoods()
    .filter((a) => a.name.toLowerCase().includes(areaQuery.toLowerCase()));
  const filtered = records
    .filter(
      (r) =>
        (category === "all" || r.category === category) &&
        (tone === "all" || r.tone === tone),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const profileTab =
    tab === "demographics" || tab === "crime" || tab === "amenities";
  return (
    <aside
      className="se-context-panel"
      aria-label={id ? `${data?.name} intelligence` : "Miami intelligence"}
    >
      <header className="se-context-header">
        <div>
          {id ? (
            <button
              className="se-context-breadcrumb se-eyebrow"
              onClick={() => setSelectedNeighborhood(null)}
              aria-label="Return to Miami overview"
            >
              Miami <ChevronRight size={10} /> Neighborhood intelligence
            </button>
          ) : (
            <span className="se-eyebrow">
              City intelligence / 23 analytical areas
            </span>
          )}
          <h1>{data?.name ?? "Miami"}</h1>
        </div>
        <div className="se-context-actions">
          {id && (
            <>
              <button
                title={saved ? "Remove saved area" : "Save area"}
                aria-label={saved ? "Remove saved area" : "Save area"}
                className={saved ? "is-active" : ""}
                onClick={() =>
                  saved
                    ? removeFromWatchlist(id)
                    : addToWatchlist({
                        neighborhoodId: id,
                        addedAt: new Date().toISOString(),
                      })
                }
              >
                {saved ? <Check size={17} /> : <Bookmark size={17} />}
              </button>
              <button
                title="Add to comparison"
                aria-label="Add to comparison"
                onClick={() => {
                  if (!comparisonMode) toggleComparisonMode();
                  addToComparison(id);
                }}
              >
                <GitCompareArrows size={17} />
              </button>
            </>
          )}
          <button
            title="Close details panel"
            aria-label="Close details panel"
            onClick={close}
          >
            <X size={17} />
          </button>
        </div>
      </header>
      {index && (
        <div className="se-profile-heading">
          <div>
            <span>Weighted profile index</span>
            <small>{index.breakdown.length} active dimensions · −1 to +1</small>
          </div>
          <strong
            style={{ color: dataService.getScoreColor(index.composite_score) }}
          >
            {index.breakdown.length ? signed(index.composite_score) : "—"}
          </strong>
        </div>
      )}
      {permitMode && (
        <nav className="se-panel-mode-switch" aria-label="Record view">
          <button
            className={tab === "permits" ? "is-active" : ""}
            onClick={() => setTab("permits")}
          >
            Permit activity
          </button>
          <button
            className={tab !== "permits" ? "is-active" : ""}
            onClick={() => setTab("briefing")}
          >
            {id ? "Area intelligence" : "City intelligence"}
          </button>
        </nav>
      )}
      {tab !== "permits" && (
        <nav
          className={`se-panel-tabs ${id ? "has-profile-tabs" : ""}`}
          aria-label="Intelligence dimensions"
        >
          {tabs
            .filter((t) => id || ["briefing", "news", "social"].includes(t.id))
            .map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "is-active" : ""}
                onClick={() => {
                  setTab(t.id);
                  setCategory("all");
                  setTone("all");
                }}
              >
                {t.label}
              </button>
            ))}
        </nav>
      )}
      <div className="se-context-scroll">
        {tab === "permits" ? (
          <PermitActivity id={id} readBriefing={() => setTab("briefing")} />
        ) : profileTab && id ? (
          <ProfileDetail id={id} layer={tab as LayerType} />
        ) : (
          <>
            <section className="se-narrative">
              <span className="se-eyebrow">
                {kind === "combined"
                  ? "Connected briefing"
                  : kind === "news"
                    ? "News & development briefing"
                    : "Community briefing"}
              </span>
              <h2>{section.headline}</h2>
              <p>{section.summary}</p>
            </section>
            <div className="se-briefing-facts">
              <div>
                <strong>{newsRecords.length}</strong>
                <span>News items</span>
              </div>
              <div>
                <strong>{socialRecords.length}</strong>
                <span>Community notes</span>
              </div>
              <div>
                <strong>{sources}</strong>
                <span>Sources</span>
              </div>
            </div>
            {id && tab === "briefing" && (
              <DimensionProfile id={id} onSelect={setTab} />
            )}
            {id && (tab === "news" || tab === "social") && (
              <div className="se-small-index">
                <span>{dimensions.find((d) => d.id === tab)!.meaning}</span>
                <strong
                  style={{
                    color: dataService.getScoreColor(
                      dataService.getDimensionScore(id, tab) ?? 0,
                    ),
                  }}
                >
                  {signed(dataService.getDimensionScore(id, tab) ?? 0)}
                </strong>
                <span className="se-index-track">
                  <i
                    className="se-index-fill"
                    style={{
                      width: `${((dataService.getDimensionScore(id, tab) ?? 0) + 1) * 50}%`,
                      background: dataService.getScoreColor(
                        dataService.getDimensionScore(id, tab) ?? 0,
                      ),
                    }}
                  />
                  <i className="se-index-zero" />
                </span>
              </div>
            )}
            <section className="se-section se-theme-section">
              <div className="se-section-title">
                <h3>{id ? "What to investigate" : "Across the city"}</h3>
                <span>Open a theme for evidence</span>
              </div>
              <ThemeBriefing section={section} city={!id} />
            </section>
            {(tab === "news" || tab === "social") && (
              <RecordAnalysis records={records} kind={tab} />
            )}
            {!id && (
              <section className="se-section">
                <div className="se-section-title">
                  <h3>Neighborhood briefings</h3>
                  <span>{areas.length} areas</span>
                </div>
                <input
                  className="se-area-filter"
                  placeholder="Filter neighborhoods…"
                  value={areaQuery}
                  onChange={(e) => setAreaQuery(e.target.value)}
                  aria-label="Filter neighborhood briefings"
                />
                <div className="se-area-briefings">
                  {areas.map((a) => {
                    const b = areaBriefing(a.id)![kind];
                    const score = dataService.calculateCompositeScore(
                      a.id,
                      activeLayers,
                      layerWeights,
                    );
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedNeighborhood(a.id)}
                      >
                        <div>
                          <strong>{a.name}</strong>
                          {score.breakdown.length > 0 && (
                            <span
                              style={{
                                color: dataService.getScoreColor(
                                  score.composite_score,
                                ),
                              }}
                            >
                              {signed(score.composite_score)}
                            </span>
                          )}
                          <ArrowUpRight size={14} />
                        </div>
                        <p>{b.headline}</p>
                        <small>
                          {recordsFor(a.id, kind).length} linked records
                        </small>
                      </button>
                    );
                  })}
                  {!areas.length && (
                    <p className="se-caption">
                      No neighborhoods match that name.
                    </p>
                  )}
                </div>
              </section>
            )}
            <details className="se-all-records">
              <summary>
                <span>
                  Browse supporting records <small>{records.length}</small>
                </span>
                <ChevronRight size={16} className="se-disclosure" />
              </summary>
              <div className="se-record-filters">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Filter records by category"
                >
                  <option value="all">All topics</option>
                  {Array.from(new Set(records.map((r) => r.category))).map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
                {kind !== "news" && (
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    aria-label="Filter community records by tone"
                  >
                    <option value="all">All tones</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                )}
              </div>
              <div className="se-record-list">
                {filtered.map((r) => (
                  <EvidenceCard record={r} key={r.id} showArea={!id} />
                ))}
                {!filtered.length && (
                  <p className="se-caption">No records match these filters.</p>
                )}
              </div>
            </details>
            <a
              className="se-export"
              href={`/api/intelligence?${id ? `area=${id}&` : ""}kind=${kind}&format=markdown`}
            >
              <Download size={14} />
              Export this briefing
            </a>
          </>
        )}
      </div>
    </aside>
  );
}
