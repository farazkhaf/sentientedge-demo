"use client";
import { useEffect, useSyncExternalStore } from "react";

const query = "(max-width: 1059px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function useCompactWorkspace() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useAssistantViewport(open: boolean) {
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty(
        "--se-visual-height",
        `${viewport.height}px`,
      );
      document.documentElement.style.setProperty(
        "--se-visual-top",
        `${viewport.offsetTop}px`,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--se-visual-height");
      document.documentElement.style.removeProperty("--se-visual-top");
    };
  }, [open]);
}
