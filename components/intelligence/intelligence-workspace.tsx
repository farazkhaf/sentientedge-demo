"use client";
import { useDataset } from "./dataset-provider";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Home,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store/app-store";

import { IntelligenceControls } from "./layer-controls";
import { IntelligenceMap } from "./intelligence-map";
import { DataDetailPanel } from "./intelligence-panel";
import { AreaComparison } from "./area-comparison";
import { IntelligenceHome } from "./intelligence-home";
import { InvestigationAssistant } from "./investigation-assistant";
import { useInvestigation } from "./use-investigation";
import type { InvestigationAction } from "@/lib/intelligence/assistant-contract";
import type { HotspotFeature } from "@/lib/types/data";
import type { MapMode } from "@/lib/intelligence/presentation";
import { placeArea, placeName } from "@/lib/intelligence/places";
import { PlaceDetailPanel } from "./context-inspection";

export function IntelligenceWorkspace() {
  const { dataService } = useDataset();

  const {
    appMode,
    setAppMode,
    selectedNeighborhood,
    setSelectedNeighborhood,
    comparisonMode,
    toggleComparisonMode,
    sidebarOpen,
    toggleSidebar,
    detailPanelOpen,
    toggleDetailPanel,
  } = useAppStore();
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [mapVisited, setMapVisited] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("profile");
  const [selectedPlace, setSelectedPlace] = useState<HotspotFeature | null>(
    null,
  );
  useEffect(() => {
    if (appMode === "explore") setMapVisited(true);
  }, [appMode]);
  useEffect(() => {
    if (
      selectedPlace &&
      (comparisonMode ||
        (placeArea(selectedPlace.geometry.coordinates)?.id ?? null) !==
          selectedNeighborhood)
    )
      setSelectedPlace(null);
  }, [selectedNeighborhood, comparisonMode, selectedPlace]);
  const view =
    appMode === "home" ? "home" : comparisonMode ? "compare" : "explore";
  const session = useInvestigation(view);
  const openInvestigation = (action: InvestigationAction) => {
    setSelectedNeighborhood(action.areaIds[0] ?? null);
    useAppStore.setState({
      appMode: "explore",
      selectedNeighborhood: action.areaIds[0] ?? null,
      detailPanelOpen: true,
      comparisonMode: action.view === "compare",
      comparisonNeighborhoods:
        action.view === "compare"
          ? action.areaIds
          : useAppStore.getState().comparisonNeighborhoods,
      activeLayers: action.dimensions,
    });
    setSelectedPlace(null);
    setMapMode(action.layer);
    setAssistantOpen(false);
  };
  const [query, setQuery] = useState("");
  const [finding, setFinding] = useState(false);
  const neighborhoods = dataService.getAllNeighborhoods();
  const matches = neighborhoods.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()),
  );
  const select = (id: string) => {
    setAppMode("explore");
    if (comparisonMode) toggleComparisonMode();
    setSelectedPlace(null);
    setSelectedNeighborhood(id);
    setQuery("");
    setFinding(false);
  };
  return (
    <main
      className={`se-app ${appMode === "home" ? "se-home" : ""} ${sidebarOpen ? "" : "se-controls-collapsed"} ${comparisonMode ? "se-comparing" : ""}`}
    >
      <header className="se-app-header">
        <button
          className="se-sidebar-toggle"
          aria-label={
            appMode === "home"
              ? "Home"
              : sidebarOpen
                ? "Hide layer controls"
                : "Show layer controls"
          }
          onClick={() => appMode !== "home" && toggleSidebar()}
        >
          {appMode === "home" ? (
            <Home size={18} />
          ) : sidebarOpen ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>
        <a
          className="se-brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setAppMode("home");
            setAssistantOpen(false);
          }}
        >
          <strong>SentientEdge</strong>
          <small>MIAMI</small>
        </a>
        <nav className="se-main-nav" aria-label="Workspace navigation">
          <button
            className={appMode === "home" ? "is-active" : ""}
            onClick={() => {
              setAppMode("home");
              setAssistantOpen(false);
            }}
          >
            Home
          </button>
          <button
            className={appMode !== "home" && !comparisonMode ? "is-active" : ""}
            onClick={() => {
              setAppMode("explore");
              if (comparisonMode) toggleComparisonMode();
            }}
          >
            Explore
          </button>
          <button
            className={appMode !== "home" && comparisonMode ? "is-active" : ""}
            onClick={() => {
              setAppMode("explore");
              if (!comparisonMode) toggleComparisonMode();
            }}
          >
            Compare
          </button>
        </nav>
        <div className="se-finder">
          <Search size={15} />
          <input
            aria-label="Find a Miami neighborhood"
            placeholder="Find a neighborhood…"
            value={query}
            onFocus={() => setFinding(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setFinding(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFinding(false);
              if (e.key === "Enter" && matches[0]) select(matches[0].id);
            }}
          />
          <button
            title="Choose neighborhood"
            aria-label="Choose neighborhood"
            onClick={() => setFinding((v) => !v)}
          >
            <ChevronDown size={13} />
          </button>
          {finding && (
            <>
              <button
                className="se-finder-dismiss"
                aria-label="Close neighborhood search"
                onClick={() => setFinding(false)}
              />
              <div className="se-finder-menu">
                <button
                  onClick={() => {
                    setAppMode("explore");
                    setSelectedPlace(null);
                    if (comparisonMode) toggleComparisonMode();
                    setSelectedNeighborhood(null);
                    setQuery("");
                    setFinding(false);
                  }}
                >
                  <Map size={14} />
                  Miami overview
                </button>
                {matches.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => select(a.id)}
                    className={selectedNeighborhood === a.id ? "is-active" : ""}
                  >
                    {a.name}
                  </button>
                ))}
                {!matches.length && <span>No neighborhood matches.</span>}
              </div>
            </>
          )}
        </div>
        {appMode !== "home" && (
          <button
            className="se-header-ask"
            onClick={() => setAssistantOpen(true)}
          >
            <Sparkles size={14} />
            Ask
          </button>
        )}
        <button
          className="se-snapshot-button"
          onClick={() => setSnapshotOpen(true)}
        >
          <i />
          Demo snapshot<span>May 2026</span>
          <ChevronDown size={12} />
        </button>
      </header>
      {appMode === "home" && (
        <IntelligenceHome open={openInvestigation} session={session} />
      )}
      {(appMode === "explore" || mapVisited) && (
        <div className="se-app-body" hidden={appMode === "home"}>
          {sidebarOpen && <IntelligenceControls onSelectArea={select} />}
          <div
            className={`se-canvas ${!comparisonMode && !detailPanelOpen ? "se-details-closed" : ""}`}
          >
            <IntelligenceMap
              visible={appMode === "explore"}
              mode={mapMode}
              place={selectedPlace}
              onModeChange={(mode) => {
                setMapMode(mode);
                setSelectedPlace(null);
                if (mode === "permits")
                  useAppStore.setState({ detailPanelOpen: true });
              }}
              onPlaceSelect={(place) => {
                if (place)
                  setSelectedNeighborhood(
                    placeArea(place.geometry.coordinates)?.id ?? null,
                  );
                setSelectedPlace(place);
              }}
              openDetails={
                !detailPanelOpen && !comparisonMode
                  ? () => toggleDetailPanel()
                  : undefined
              }
              detailsLabel={
                selectedPlace
                  ? placeName(selectedPlace)
                  : (neighborhoods.find(
                      (area) => area.id === selectedNeighborhood,
                    )?.name ?? "Miami overview")
              }
            />
            {comparisonMode ? (
              <AreaComparison />
            ) : (
              detailPanelOpen &&
              (selectedPlace ? (
                <PlaceDetailPanel
                  key={selectedPlace.properties.id}
                  place={selectedPlace}
                  back={() => {
                    setSelectedNeighborhood(
                      placeArea(selectedPlace.geometry.coordinates)?.id ?? null,
                    );
                    setSelectedPlace(null);
                  }}
                  close={toggleDetailPanel}
                />
              ) : (
                <DataDetailPanel
                  key={`${selectedNeighborhood ?? "miami"}:${mapMode}`}
                  permitMode={mapMode === "permits"}
                  close={toggleDetailPanel}
                />
              ))
            )}
          </div>
        </div>
      )}
      {appMode !== "home" && (
        <Dialog open={assistantOpen} onOpenChange={setAssistantOpen}>
          <DialogContent
            className="se-assistant-dialog"
            showCloseButton={false}
            aria-describedby={undefined}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Ask SentientEdge</DialogTitle>
            </DialogHeader>
            <InvestigationAssistant
              session={session}
              open={openInvestigation}
              close={() => setAssistantOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="se-snapshot-dialog">
          <DialogHeader>
            <span className="se-eyebrow">About this workspace</span>
            <DialogTitle>Miami · May 2026 snapshot</DialogTitle>
          </DialogHeader>
          <p>
            SentientEdge combines neighborhood profiles, geographic layers,
            reported developments, and community perspectives in one desktop
            investigation workspace.
          </p>
          <section>
            <h3>How to read this demonstration</h3>
            <p>
              Numeric profiles, permits, incident counts, and historical series
              are illustrative fixtures carried forward from the existing
              project. News and community records are curated and source linked.
              Their summaries were prepared once from those records; they are
              not live reporting or a representative survey.
            </p>
          </section>
          <section>
            <h3>Indices & the geographic blend</h3>
            <p>
              Dimension indices run from −1 to +1. The weighted profile is the
              average of enabled dimensions, weighted by your sliders and the
              stored record-quality factor. Zero weight excludes a dimension.
              Higher news activity means more activity in its index; it does not
              imply a positive outcome. Community tone is distinct from news
              significance, which runs from 0 to 1.
            </p>
            <p>
              These indices support exploration of this snapshot. They do not
              rank neighborhood quality or measure statistical confidence.
            </p>
          </section>
          <section>
            <h3>Evidence & dates</h3>
            <p>
              Counts refer to the records actually included. News and community
              material can cover the same story, so their counts are not
              deduplicated event totals. Dates are the stored record dates.
              Source links are retained for investigation and have not been
              reverified in this pass.
            </p>
          </section>
        </DialogContent>
      </Dialog>
    </main>
  );
}
