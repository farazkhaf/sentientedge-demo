"use client";
import { useDataset } from "./dataset-provider";
import { useEffect, useState } from "react";
import { GitCompareArrows, Plus, X } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";

import { currency, dimensions, signed } from "@/lib/intelligence/briefings";

const colors = ["#4f8b85", "#b58c57", "#778ca9", "#a07c97"];
export function AreaComparison({ compact = false }: { compact?: boolean }) {
  const { dataService, areaBriefing, recordsFor, permits } = useDataset();

  const {
    comparisonNeighborhoods: ids,
    addToComparison,
    removeFromComparison,
    clearComparison,
    toggleComparisonMode,
    activeLayers,
    layerWeights,
  } = useAppStore();
  const [pair, setPair] = useState<string[]>([]);
  useEffect(() => {
    setPair((previous) =>
      [
        ...previous.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !previous.includes(id)),
      ].slice(0, 2),
    );
  }, [ids]);
  const validPair = pair.filter((id) => ids.includes(id));
  const shownIds =
    compact && ids.length > 2
      ? [...validPair, ...ids.filter((id) => !validPair.includes(id))].slice(
          0,
          2,
        )
      : ids;
  const areas = shownIds.map(
    (id) => dataService.getAllDataForNeighborhood(id)!,
  );
  const available = dataService
    .getAllNeighborhoods()
    .filter((a) => !ids.includes(a.id));
  const profiles = areas.map((a) =>
    dataService.calculateCompositeScore(a.id, activeLayers, layerWeights),
  );
  const highestIncome = [...areas].sort(
    (a, b) =>
      (b.demographics?.metrics.median_income ?? 0) -
      (a.demographics?.metrics.median_income ?? 0),
  );
  const incomeGap =
    highestIncome.length > 1
      ? highestIncome[0].demographics!.metrics.median_income -
        highestIncome.at(-1)!.demographics!.metrics.median_income
      : 0;
  return (
    <section className="se-comparison" aria-label="Area comparison">
      {!compact && (
        <header>
          <div>
            <span className="se-eyebrow">Aligned neighborhood profiles</span>
            <h2>
              <GitCompareArrows size={19} />
              Area comparison <small>{ids.length} / 4</small>
            </h2>
          </div>
          <div className="se-comparison-actions">
            {ids.length < 4 && (
              <label>
                <Plus size={14} />
                <select
                  aria-label="Add neighborhood to comparison"
                  value=""
                  onChange={(e) =>
                    e.target.value && addToComparison(e.target.value)
                  }
                >
                  <option value="">Add neighborhood</option>
                  {available.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={clearComparison}>Clear</button>
            <button
              onClick={toggleComparisonMode}
              aria-label="Close comparison"
            >
              <X size={18} />
            </button>
          </div>
        </header>
      )}
      {compact && (
        <div className="se-mobile-comparison-toolbar">
          <span>
            {ids.length
              ? `${ids.length} selected · aligned profiles`
              : "Choose areas to compare"}
          </span>
          <button onClick={toggleComparisonMode} aria-label="Close comparison">
            <X size={18} />
          </button>
        </div>
      )}
      <div
        className={`se-comparison-scroll ${!areas.length ? "is-empty" : ""}`}
      >
        {compact && (
          <div className="se-mobile-comparison-setup">
            <div className="se-mobile-comparison-setup-actions">
              {ids.length < 2 && (
                <label>
                  <Plus size={14} />
                  <select
                    aria-label="Add neighborhood to comparison"
                    value=""
                    onChange={(event) =>
                      event.target.value && addToComparison(event.target.value)
                    }
                  >
                    <option value="">
                      {ids.length ? "Add second area" : "Add neighborhood"}
                    </option>
                    {available.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {ids.length > 0 && (
                <button onClick={clearComparison}>Clear selection</button>
              )}
            </div>
            {ids.length >= 2 && (
              <div className="se-mobile-comparison-pair">
                <span>
                  {ids.length > 2
                    ? `Viewing two of ${ids.length} selected areas`
                    : "Compare side by side"}
                </span>
                <div>
                  {shownIds.map((id, index) => (
                    <label key={index}>
                      Area {index === 0 ? "A" : "B"}
                      <select
                        aria-label={`Comparison area ${index === 0 ? "A" : "B"}`}
                        value={id}
                        onChange={(event) => {
                          const next = [...shownIds];
                          next[index] = event.target.value;
                          if (ids.length > 2) setPair(next);
                          else
                            useAppStore.setState({
                              comparisonNeighborhoods: next,
                            });
                        }}
                      >
                        {dataService
                          .getAllNeighborhoods()
                          .filter(
                            (area) => ids.length <= 2 || ids.includes(area.id),
                          )
                          .map((area) => (
                            <option
                              key={area.id}
                              value={area.id}
                              disabled={shownIds[1 - index] === area.id}
                            >
                              {area.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!areas.length ? (
          <div className="se-comparison-empty">
            <GitCompareArrows size={28} />
            <h3>Compare Miami neighborhoods</h3>
            <p>
              {compact
                ? "Choose two areas above."
                : "Select two to four areas on the map or add them above."}{" "}
              Their dimension scores, local context, and reported developments
              will align here.
            </p>
            <button
              className="se-primary-button"
              onClick={() => {
                addToComparison("brickell");
                addToComparison("allapattah");
              }}
            >
              Start with Brickell & Allapattah
            </button>
          </div>
        ) : (
          <div className="se-comparison-data">
            <table className="se-comparison-table">
              <thead>
                <tr>
                  <th>
                    Dimension / metric <small>Units shown per row</small>
                  </th>
                  {areas.map((a, i) => (
                    <th key={a.id}>
                      <div style={{ borderTopColor: colors[i] }}>
                        <span>{a.name}</span>
                        <button
                          aria-label={`Remove ${a.name} from comparison`}
                          onClick={() => removeFromComparison(a.id)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="se-composite-row">
                  <th>
                    Weighted profile index
                    <small>Current layer blend · −1 to +1</small>
                  </th>
                  {profiles.map((p, i) => (
                    <td key={areas[i].id}>
                      <strong
                        style={{
                          color: dataService.getScoreColor(p.composite_score),
                        }}
                      >
                        {p.breakdown.length ? signed(p.composite_score) : "—"}
                      </strong>
                      <small>{p.breakdown.length} dimensions</small>
                    </td>
                  ))}
                </tr>
                {dimensions.map((d) => (
                  <tr key={d.id}>
                    <th>
                      <i style={{ background: d.color }} />
                      {d.label}
                      <small>
                        {d.id === "news"
                          ? "Activity index"
                          : d.id === "social"
                            ? "Tone index"
                            : "Profile index"}{" "}
                        · −1 to +1
                      </small>
                    </th>
                    {areas.map((a) => {
                      const score = dataService.getDimensionScore(a.id, d.id);
                      return (
                        <td key={a.id}>
                          <div className="se-comparison-index">
                            <span className="se-index-track">
                              <i className="se-index-zero" />
                              {score != null && (
                                <i
                                  className="se-index-fill"
                                  style={{
                                    width: `${(score + 1) * 50}%`,
                                    background:
                                      dataService.getScoreColor(score),
                                  }}
                                />
                              )}
                            </span>
                            <b
                              style={{
                                color:
                                  score == null
                                    ? "#8f9694"
                                    : dataService.getScoreColor(score),
                              }}
                            >
                              {score == null ? "—" : signed(score)}
                            </b>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="se-table-group">
                  <th colSpan={areas.length + 1}>Local context</th>
                </tr>
                <tr>
                  <th>
                    Median household income<small>USD · snapshot</small>
                  </th>
                  {areas.map((a) => (
                    <td key={a.id}>
                      {a.demographics
                        ? currency(a.demographics.metrics.median_income)
                        : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>
                    Population density<small>Residents / km² · snapshot</small>
                  </th>
                  {areas.map((a) => (
                    <td key={a.id}>
                      {a.demographics?.metrics.population_density.toLocaleString() ??
                        "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>
                    Walkability<small>Index · 0–100</small>
                  </th>
                  {areas.map((a) => (
                    <td key={a.id}>{a.amenities?.walkability_score ?? "—"}</td>
                  ))}
                </tr>
                <tr>
                  <th>
                    Building permits<small>Count · stored 30-day window</small>
                  </th>
                  {areas.map((a) => (
                    <td key={a.id}>
                      {permits.find((p) => p.neighborhood_id === a.id)
                        ?.permit_count_30d ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>
                    News / community records
                    <small>Supplied record counts</small>
                  </th>
                  {areas.map((a) => (
                    <td key={a.id}>
                      {recordsFor(a.id, "news").length} /{" "}
                      {recordsFor(a.id, "social").length}
                    </td>
                  ))}
                </tr>
                <tr className="se-table-group">
                  <th colSpan={areas.length + 1}>
                    Reported developments & perspectives
                  </th>
                </tr>
                <tr className="se-comparison-narratives">
                  <th>
                    Neighborhood briefing
                    <small>Context behind the numbers</small>
                  </th>
                  {areas.map((a) => (
                    <td key={a.id}>
                      <strong>{areaBriefing(a.id)!.combined.headline}</strong>
                      <p>{areaBriefing(a.id)!.combined.summary}</p>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {areas.length > 1 && (
              <div className="se-comparison-takeaway">
                <strong>Reading the differences</strong>
                <p>
                  {highestIncome[0].name} has the highest stored median
                  household income in this selection, with a{" "}
                  {currency(incomeGap)} gap to {highestIncome.at(-1)!.name}.
                  News activity and community tone describe different
                  dimensions; use the briefings to investigate what drives each
                  area's profile.
                </p>
              </div>
            )}
            {areas.length === 1 && (
              <p className="se-caption se-comparison-hint">
                Add another neighborhood to see the differences alongside one
                another.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
