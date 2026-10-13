"use client";
import { useDataset } from "./dataset-provider";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  GitCompareArrows,
  Sparkles,
} from "lucide-react";
import { dimensions, signed, sourceCount } from "@/lib/intelligence/briefings";

import { useAppStore } from "@/lib/store/app-store";
import type { InvestigationAction } from "@/lib/intelligence/assistant-contract";
import type { InvestigationSession } from "./use-investigation";
import { InvestigationAssistant } from "./investigation-assistant";
import { CityPreview } from "./city-preview";

export function IntelligenceHome({
  open,
  session,
}: {
  open: (action: InvestigationAction) => void;
  session: InvestigationSession;
}) {
  const { dataService, briefings, areaBriefing, recordsFor } = useDataset();

  const {
    recentlyExplored,
    activeLayers,
    layerWeights,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
  } = useAppStore();
  const briefing = briefings.city.combined;
  const records = recordsFor(null);
  const go = (ids: string[], view: InvestigationAction["view"] = "explore") =>
    open({ areaIds: ids, view, layer: "profile", dimensions: activeLayers });
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [activeLayers, layerWeights]);
  const ranked = dataService
    .getAllNeighborhoods()
    .map((area) => ({
      area,
      index: dataService.calculateCompositeScore(
        area.id,
        activeLayers,
        layerWeights,
      ),
    }))
    .sort(
      (a, b) =>
        b.index.composite_score - a.index.composite_score ||
        a.area.name.localeCompare(b.area.name),
    );
  const pageCount = Math.ceil(ranked.length / 2);
  const offset = Math.min(page, pageCount - 1) * 2;
  const highlighted = ranked.slice(offset, offset + 2);
  const comparisonAreas = (
    highlighted.length > 1 ? highlighted : ranked.slice(-2)
  ).map((entry) => entry.area.id);
  const hasBlend = ranked.some((entry) => entry.index.breakdown.length > 0);
  const recent = recentlyExplored.filter((id) =>
    dataService.getAllDataForNeighborhood(id),
  );
  return (
    <div className="se-home-layout">
      <div className="se-home-scroll">
        <div className="se-home-content">
          <div className="se-home-intro">
            <div>
              <span className="se-eyebrow">
                Your urban intelligence workspace
              </span>
              <h1>A closer read of Miami.</h1>
              <p>
                Geographic profiles, reported developments, and community
                perspectives — connected in one place.
              </p>
              <button className="se-home-launch" onClick={() => go([])}>
                Explore the geographic workspace
                <ArrowUpRight size={14} />
              </button>
            </div>
            <CityPreview selected={null} open={() => go([])} />
          </div>
          <section className="se-home-briefing">
            <header>
              <span className="se-eyebrow">Across the city</span>
              <span>May 2026</span>
            </header>
            <h2>{briefing.headline}</h2>
            <p>{briefing.summary}</p>
            <div className="se-home-counts">
              <span>
                <b>{dataService.getAllNeighborhoods().length}</b>Analytical
                areas
              </span>
              <span>
                <b>{records.filter((r) => r.kind === "news").length}</b>News
                items
              </span>
              <span>
                <b>{records.filter((r) => r.kind === "social").length}</b>
                Community notes
              </span>
              <span>
                <b>{sourceCount(records)}</b>Source domains
              </span>
            </div>
            <div className="se-home-themes">
              {briefing.themes.slice(0, 3).map((theme, i) => (
                <button key={theme.title} onClick={() => go([])}>
                  <small>0{i + 1}</small>
                  <span>
                    <strong>{theme.title}</strong>
                    <p>{theme.summary}</p>
                    <small>{theme.recordIds.length} supporting records</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            <button
              className="se-home-ask"
              disabled={session.pending}
              onClick={() => {
                void session.send(
                  "Give me a Miami briefing with the supporting evidence.",
                );
              }}
            >
              <Sparkles size={14} />
              Investigate this briefing
              <ArrowUpRight size={13} />
            </button>
          </section>
          {recent.length > 0 && (
            <section
              className="se-home-recent"
              aria-label="Recently explored areas"
            >
              <header>
                <h2>Recently explored</h2>
                <span>Continue an investigation</span>
              </header>
              <div>
                {recent.map((id) => (
                  <button key={id} onClick={() => go([id])}>
                    <span>
                      {dataService.getAllDataForNeighborhood(id)!.name}
                    </span>
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="se-home-neighborhoods">
            <header>
              <div>
                <h2>Neighborhood highlights</h2>
                <p>
                  {hasBlend
                    ? "Ordered by your weighted profile · dimension indices −1 to +1."
                    : "Alphabetical · enable dimensions in Explore for weighted ordering."}
                </p>
              </div>
              <button onClick={() => go(comparisonAreas, "compare")}>
                <GitCompareArrows size={14} />
                Compare areas
              </button>
            </header>
            <div className="se-home-area-pagination">
              <span aria-live="polite">
                {offset + 1}–{Math.min(offset + 2, ranked.length)} of{" "}
                {ranked.length} neighborhoods
              </span>
              <div>
                <button
                  aria-label="Previous neighborhoods"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  aria-label="Next neighborhoods"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="se-home-area-grid" key={offset}>
              {highlighted.map(({ area: a, index }, position) => {
                const id = a.id;
                const saved = watchlist.some((w) => w.neighborhoodId === id);
                return (
                  <article key={id}>
                    <header>
                      <button
                        className="se-home-area-name"
                        aria-label={`Explore ${a.name}`}
                        onClick={() => go([id])}
                      >
                        {a.name}
                        <small className="se-area-rank">
                          {String(offset + position + 1).padStart(2, "0")}
                        </small>
                        <ArrowUpRight size={13} />
                      </button>
                      <button
                        aria-label={`${saved ? "Unsave" : "Save"} ${a.name}`}
                        title={saved ? "Remove saved area" : "Save area"}
                        onClick={() =>
                          saved
                            ? removeFromWatchlist(id)
                            : addToWatchlist({
                                neighborhoodId: id,
                                addedAt: new Date().toISOString(),
                              })
                        }
                      >
                        {saved ? <Check size={15} /> : <Bookmark size={15} />}
                      </button>
                    </header>
                    <h3>{areaBriefing(id)!.combined.headline}</h3>
                    <div className="se-home-area-profile">
                      <span>Weighted profile</span>
                      <b>
                        {index.breakdown.length
                          ? signed(index.composite_score)
                          : "—"}
                      </b>
                    </div>
                    <div className="se-home-dimension-metrics">
                      {dimensions.map((d) => {
                        const value = dataService.getDimensionScore(id, d.id);
                        return (
                          <div
                            key={d.id}
                            title={`${d.label}: ${value == null ? "Unavailable" : signed(value)}`}
                          >
                            <span>
                              <i style={{ background: d.color }} />
                              {d.label}
                            </span>
                            <b>{value == null ? "—" : signed(value)}</b>
                          </div>
                        );
                      })}
                    </div>
                    <footer>
                      <button onClick={() => go([id])}>
                        Read area briefing
                        <ChevronRight size={13} />
                      </button>
                      <span>{recordsFor(id).length} records</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="se-home-saved">
            <header>
              <h2>
                <Bookmark size={15} />
                Saved areas
              </h2>
              <span>{watchlist.length}</span>
            </header>
            {watchlist.length ? (
              <div>
                {watchlist.map((w) => (
                  <button
                    key={w.neighborhoodId}
                    onClick={() => go([w.neighborhoodId])}
                  >
                    {
                      dataService.getAllDataForNeighborhood(w.neighborhoodId)
                        ?.name
                    }
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
            ) : (
              <p>
                Save an area from a neighborhood card or the map to return to
                its briefing here.
              </p>
            )}
          </section>
        </div>
      </div>
      <InvestigationAssistant session={session} open={open} />
    </div>
  );
}
