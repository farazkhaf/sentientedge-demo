//lib\store\app-store.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LayerType, WatchlistItem } from "@/lib/types/data";

export type AppMode = "home" | "explore";

interface AppState {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  activeLayers: LayerType[];
  layerWeights: Record<LayerType, number>;
  selectedNeighborhood: string | null;

  comparisonMode: boolean;
  comparisonNeighborhoods: string[];

  watchlist: WatchlistItem[];
  recentlyExplored: string[];

  sidebarOpen: boolean;
  detailPanelOpen: boolean;

  setActiveLayers: (layers: LayerType[]) => void;
  toggleLayer: (layer: LayerType) => void;
  setLayerWeight: (layer: LayerType, weight: number) => void;
  setSelectedNeighborhood: (id: string | null) => void;
  toggleComparisonMode: () => void;
  addToComparison: (neighborhoodId: string) => void;
  removeFromComparison: (neighborhoodId: string) => void;
  clearComparison: () => void;
  addToWatchlist: (item: WatchlistItem) => void;
  removeFromWatchlist: (neighborhoodId: string) => void;
  toggleSidebar: () => void;
  toggleDetailPanel: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      appMode: "home",
      setAppMode: (mode) => set({ appMode: mode }),

      activeLayers: ["demographics", "crime", "amenities", "social", "news"],
      layerWeights: {
        demographics: 1,
        crime: 1,
        amenities: 1,
        social: 0.8,
        news: 0.6,
      },
      selectedNeighborhood: null,
      comparisonMode: false,
      comparisonNeighborhoods: [],
      watchlist: [],
      recentlyExplored: [],
      sidebarOpen: true,
      detailPanelOpen: true,

      setActiveLayers: (layers) => set({ activeLayers: layers }),
      toggleLayer: (layer) =>
        set((state) => ({
          activeLayers: state.activeLayers.includes(layer)
            ? state.activeLayers.filter((l) => l !== layer)
            : [...state.activeLayers, layer],
        })),
      setLayerWeight: (layer, weight) =>
        set((state) => ({
          layerWeights: { ...state.layerWeights, [layer]: weight },
        })),
      setSelectedNeighborhood: (id) =>
        set((state) => ({
          selectedNeighborhood: id,
          detailPanelOpen: true,
          recentlyExplored: id
            ? [
                id,
                ...state.recentlyExplored.filter((area) => area !== id),
              ].slice(0, 4)
            : state.recentlyExplored,
        })),
      toggleComparisonMode: () =>
        set((state) => ({
          comparisonMode: !state.comparisonMode,
          comparisonNeighborhoods: state.comparisonMode
            ? []
            : state.comparisonNeighborhoods,
        })),
      addToComparison: (neighborhoodId) =>
        set((state) => {
          if (state.comparisonNeighborhoods.includes(neighborhoodId))
            return state;
          if (state.comparisonNeighborhoods.length >= 4) return state;
          return {
            comparisonNeighborhoods: [
              ...state.comparisonNeighborhoods,
              neighborhoodId,
            ],
          };
        }),
      removeFromComparison: (neighborhoodId) =>
        set((state) => ({
          comparisonNeighborhoods: state.comparisonNeighborhoods.filter(
            (id) => id !== neighborhoodId,
          ),
        })),
      clearComparison: () => set({ comparisonNeighborhoods: [] }),
      addToWatchlist: (item) =>
        set((state) => {
          if (
            state.watchlist.some(
              (w) => w.neighborhoodId === item.neighborhoodId,
            )
          )
            return state;
          return { watchlist: [...state.watchlist, item] };
        }),
      removeFromWatchlist: (neighborhoodId) =>
        set((state) => ({
          watchlist: state.watchlist.filter(
            (w) => w.neighborhoodId !== neighborhoodId,
          ),
        })),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleDetailPanel: () =>
        set((state) => ({ detailPanelOpen: !state.detailPanelOpen })),
    }),
    {
      name: "sentient-edge-storage",
      partialize: (state) => ({
        activeLayers: state.activeLayers,
        layerWeights: state.layerWeights,
        watchlist: state.watchlist,
        recentlyExplored: state.recentlyExplored,
      }),
    },
  ),
);
