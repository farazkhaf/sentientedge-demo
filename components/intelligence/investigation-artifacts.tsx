"use client";
import { useDataset } from "./dataset-provider";
import {
  ArrowUpRight,
  ChevronDown,
  FileText,
  GitCompareArrows,
  MapPin,
} from "lucide-react";
import {
  currency,
  dateLabel,
  dimensions,
  signed,
} from "@/lib/intelligence/briefings";
import type {
  InvestigationAction,
  InvestigationArtifact,
} from "@/lib/intelligence/assistant-contract";
import { EvidenceCard } from "./intelligence-panel";
import { useAppStore } from "@/lib/store/app-store";

const colors = ["#176a67", "#a47e48", "#6585a1", "#957896"];
export function InvestigationArtifactView({
  artifact: a,
  open,
}: {
  artifact: InvestigationArtifact;
  open: (action: InvestigationAction) => void;
}) {
  const { evidenceById } = useDataset();
  const names = (ids: string[]) =>
    ids.flatMap((id) => (evidenceById.has(id) ? [evidenceById.get(id)!] : []));

  const go = (
    areaIds: string[],
    view: InvestigationAction["view"] = "explore",
  ) =>
    open({
      areaIds,
      view,
      layer: "profile",
      dimensions: useAppStore.getState().activeLayers,
    });
  if (a.type === "briefing")
    return (
      <article className="se-artifact se-artifact-briefing">
        <header>
          <span>
            <FileText size={14} />
            {a.areaName} ·{" "}
            {a.kind === "social"
              ? "Community"
              : a.kind === "news"
                ? "News"
                : "Briefing"}
          </span>
          <a
            href={`/api/intelligence?${a.areaId ? `area=${encodeURIComponent(a.areaId)}&` : ""}kind=${a.kind}&format=markdown`}
            title="Download briefing"
          >
            Export <ArrowUpRight size={12} />
          </a>
        </header>
        <h3>{a.section.headline}</h3>
        <p>{a.section.summary}</p>
        {a.section.themes.map((theme, i) => (
          <details className="se-artifact-theme" key={theme.title}>
            <summary>
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>{theme.title}</span>
              <ChevronDown size={13} />
            </summary>
            <p>{theme.summary}</p>
            <div className="se-artifact-evidence">
              {names(theme.recordIds).map((r) => (
                <EvidenceCard key={r.id} record={r} showArea />
              ))}
            </div>
          </details>
        ))}
        <button
          className="se-artifact-open"
          onClick={() => go(a.areaId ? [a.areaId] : [], "intelligence")}
        >
          Investigate in the workspace <ArrowUpRight size={14} />
        </button>
      </article>
    );
  if (a.type === "comparison")
    return (
      <article className="se-artifact">
        <header>
          <span>
            <GitCompareArrows size={14} />
            Neighborhood comparison
          </span>
          <small>May 2026 reference</small>
        </header>
        <div className="se-artifact-table-scroll">
          <table className="se-artifact-table">
            <thead>
              <tr>
                <th>Dimension / metric</th>
                {a.profiles.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.profiles.some((p) => p.weightedProfile) && (
                <tr>
                  <th>
                    Weighted profile
                    <small>Selected layer blend · −1 to +1</small>
                  </th>
                  {a.profiles.map((p) => (
                    <td key={p.id}>
                      {p.weightedProfile?.value == null
                        ? "—"
                        : signed(p.weightedProfile.value)}
                      <small>
                        {p.weightedProfile?.dimensions ?? 0} dimensions
                      </small>
                    </td>
                  ))}
                </tr>
              )}
              {dimensions.map((d) => (
                <tr key={d.id}>
                  <th>
                    {d.label}
                    <small>
                      {d.id === "news"
                        ? "Activity"
                        : d.id === "social"
                          ? "Tone"
                          : "Profile"}{" "}
                      index · −1 to +1
                    </small>
                  </th>
                  {a.profiles.map((p) => {
                    const value = p.dimensions.find(
                      (i) => i.id === d.id,
                    )?.value;
                    return (
                      <td key={p.id}>{value == null ? "—" : signed(value)}</td>
                    );
                  })}
                </tr>
              ))}
              {(
                [
                  ["income", "Median income", "USD"],
                  ["density", "Population density", "people/km²"],
                  ["walkability", "Walkability", "0–100"],
                  ["permits", "Permits", "Preceding 30 days"],
                  ["news", "News", "Included records"],
                  ["community", "Community", "Included notes"],
                ] as const
              ).map(([metric, label, unit]) => (
                <tr key={metric}>
                  <th>
                    {label}
                    <small>{unit}</small>
                  </th>
                  {a.profiles.map((p) => (
                    <td key={p.id}>
                      {p.metrics[metric] == null
                        ? "—"
                        : metric === "income"
                          ? currency(p.metrics[metric])
                          : p.metrics[metric].toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="se-artifact-open"
          onClick={() =>
            go(
              a.profiles.map((p) => p.id),
              "compare",
            )
          }
        >
          Open full comparison <ArrowUpRight size={14} />
        </button>
      </article>
    );
  if (a.type === "chart") {
    const max = Math.max(...a.points.map((p) => p.value), 1);
    return (
      <article className="se-artifact">
        <header>
          <span>{a.title}</span>
          <small>{a.unit}</small>
        </header>
        <p className="se-artifact-period">{a.period}</p>
        <div
          className="se-artifact-bars"
          role="img"
          aria-label={`${a.title}: ${a.points.map((p) => `${p.label} ${p.value} ${a.unit}`).join(", ")}`}
        >
          {a.points.map((p, i) => (
            <div key={`${p.label}-${i}`}>
              <span>{p.label}</span>
              <div>
                <i
                  style={{
                    width: `${(p.value / max) * 100}%`,
                    background: colors[i % 4],
                  }}
                />
              </div>
              <b>
                {a.unit === "USD"
                  ? currency(p.value)
                  : p.value.toLocaleString()}
              </b>
            </div>
          ))}
        </div>
        {!a.points.length && <p>No matching values in the included records.</p>}
        {a.missing.length > 0 && (
          <p className="se-artifact-period">
            Unavailable: {a.missing.join(", ")}
          </p>
        )}
      </article>
    );
  }
  if (a.type === "trend") {
    const dates = a.series.flatMap((s) =>
      s.points.map((p) => Date.parse(p.date)),
    );
    const from = Math.min(...dates),
      to = Math.max(...dates);
    return (
      <article className="se-artifact">
        <header>
          <span>{a.title}</span>
          <small>{a.unit}</small>
        </header>
        {a.series.length > 0 && (
          <>
            <svg
              className="se-artifact-trend"
              viewBox="0 0 420 172"
              role="img"
              aria-label={a.title}
            >
              {[-1, 0, 1].map((v) => (
                <g key={v}>
                  <line
                    x1="28"
                    x2="404"
                    y1={18 + (1 - v) * 58}
                    y2={18 + (1 - v) * 58}
                    stroke="var(--se-line)"
                    strokeDasharray={v === 0 ? "3 4" : undefined}
                  />
                  <text
                    x="0"
                    y={22 + (1 - v) * 58}
                    fill="var(--se-muted)"
                    fontSize="10"
                  >
                    {v > 0 ? "+" : ""}
                    {v}
                  </text>
                </g>
              ))}
              {a.series.map((s, i) => (
                <polyline
                  key={s.name}
                  fill="none"
                  stroke={colors[i]}
                  strokeWidth="2.5"
                  points={s.points
                    .map(
                      (p) =>
                        `${28 + ((Date.parse(p.date) - from) / (to - from || 1)) * 376},${18 + (1 - p.score) * 58}`,
                    )
                    .join(" ")}
                />
              ))}
              <text x="28" y="160" fill="var(--se-muted)" fontSize="10">
                {dateLabel(new Date(from).toISOString())}
              </text>
              <text
                x="404"
                y="160"
                textAnchor="end"
                fill="var(--se-muted)"
                fontSize="10"
              >
                {dateLabel(new Date(to).toISOString())}
              </text>
            </svg>
            <div className="se-artifact-series">
              {a.series.map((s, i) => (
                <span key={s.name}>
                  <i style={{ background: colors[i] }} />
                  {s.name}
                </span>
              ))}
            </div>
            <details className="se-artifact-theme">
              <summary>
                View dated values
                <ChevronDown size={13} />
              </summary>
              {a.series.map((s) => (
                <div key={s.name}>
                  <strong>{s.name}</strong>
                  {s.points.map((p) => (
                    <div className="se-trend-value" key={p.date}>
                      <time>{dateLabel(p.date)}</time>
                      <b>{signed(p.score)}</b>
                    </div>
                  ))}
                </div>
              ))}
            </details>
          </>
        )}
        {a.missing.length > 0 && (
          <p className="se-artifact-period">
            Compatible history unavailable: {a.missing.join(", ")}
          </p>
        )}
      </article>
    );
  }
  if (a.type === "timeline")
    return (
      <article className="se-artifact">
        <header>
          <span>{a.title}</span>
          <small>
            {a.records.length} of {a.total} records
          </small>
        </header>
        <p className="se-artifact-period">
          Stored record dates · most recent first
        </p>
        <div className="se-artifact-timeline">
          {a.records.map((r) => (
            <details key={r.id}>
              <summary>
                <time>{dateLabel(r.date)}</time>
                <span>
                  <small>
                    {r.areaName} ·{" "}
                    {r.kind === "news" ? r.category : "Community"}
                  </small>
                  {r.text.split(/(?<=\.)\s/)[0]}
                </span>
                <ChevronDown size={13} />
              </summary>
              <EvidenceCard record={r} showArea />
            </details>
          ))}
        </div>
        {!a.records.length && <p>No matching records.</p>}
      </article>
    );
  return (
    <article className="se-artifact se-geographic-artifact">
      <header>
        <span>
          <MapPin size={15} />
          Geographic selection
        </span>
        <small>
          {a.action.layer === "permits"
            ? "Permit activity"
            : "Dimension profile"}
        </small>
      </header>
      <h3>
        {a.areaNames.length ? a.areaNames.join(" + ") : "Miami city overview"}
      </h3>
      <p>
        {a.action.view === "compare"
          ? "Compare aligned profiles with the selected neighborhoods highlighted."
          : "Open this selection with the requested geographic layer."}
      </p>
      <div className="se-geographic-dimensions">
        {a.action.dimensions.map((id) => (
          <span key={id}>{dimensions.find((d) => d.id === id)?.label}</span>
        ))}
      </div>
      <button className="se-artifact-open" onClick={() => open(a.action)}>
        Open in{" "}
        {a.action.view === "compare"
          ? "Compare"
          : a.action.view === "intelligence"
            ? "Intelligence"
            : "Explore"}
        <ArrowUpRight size={14} />
      </button>
    </article>
  );
}
