"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  detailAnchors,
  detailHeights,
  nearestDetailAnchor,
  type DetailAnchor,
} from "@/lib/intelligence/mobile-layout";

export function MobileWorkspace({
  map,
  children,
  title,
  score,
  anchor,
  onAnchorChange,
}: {
  map: ReactNode;
  children: ReactNode;
  title: string;
  score?: string;
  anchor: DetailAnchor;
  onAnchorChange: (anchor: DetailAnchor) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    y: number;
    reveal: number;
    current: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [height, setHeight] = useState(600);
  useEffect(() => {
    const element = root.current!;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.contentRect.height),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const reveal = detailHeights(height)[anchor];
  useEffect(() => {
    if (!drag.current)
      root.current?.style.setProperty("--se-detail-height", `${reveal}px`);
  }, [reveal]);
  const finish = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    root.current?.classList.remove("is-dragging");
    const next = cancelled
      ? anchor
      : nearestDetailAnchor(current.height, current.current);
    root.current?.style.setProperty(
      "--se-detail-height",
      `${detailHeights(current.height)[next]}px`,
    );
    onAnchorChange(next);
    suppressClick.current = current.moved || cancelled;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const step = (direction: number) => {
    const index = detailAnchors.indexOf(anchor);
    onAnchorChange(detailAnchors[Math.max(0, Math.min(2, index + direction))]);
  };
  return (
    <div ref={root} className="se-mobile-workspace" data-anchor={anchor}>
      <div className="se-mobile-map-region">{map}</div>
      <section className="se-mobile-details" aria-label="Map details">
        <button
          className="se-sheet-handle"
          aria-label={anchor === "reading" ? "Show more map" : "Expand details"}
          aria-describedby="se-sheet-help"
          aria-expanded={anchor !== "map"}
          aria-controls="se-mobile-detail-content"
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            suppressClick.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              y: event.clientY,
              reveal,
              current: reveal,
              height,
              moved: false,
            };
            root.current?.classList.add("is-dragging");
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const current = drag.current;
            const limits = detailHeights(current.height);
            current.moved ||= Math.abs(event.clientY - current.y) > 5;
            current.current = Math.max(
              limits.map,
              Math.min(
                limits.reading,
                current.reveal + current.y - event.clientY,
              ),
            );
            root.current?.style.setProperty(
              "--se-detail-height",
              `${current.current}px`,
            );
          }}
          onPointerUp={(event) => finish(event)}
          onPointerCancel={(event) => finish(event, true)}
          onLostPointerCapture={(event) => finish(event, true)}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onAnchorChange(
              detailAnchors[(detailAnchors.indexOf(anchor) + 1) % 3],
            );
          }}
          onKeyDown={(event) => {
            suppressClick.current = false;
            if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            if (event.key === "Home") onAnchorChange("map");
            else if (event.key === "End") onAnchorChange("reading");
            else step(event.key === "ArrowUp" ? 1 : -1);
          }}
        >
          <i aria-hidden="true" />
          <span>
            <strong>{title}</strong>
            <small>
              {anchor === "map"
                ? "Swipe up for details"
                : anchor === "reading"
                  ? "Swipe down for the map"
                  : score
                    ? "Weighted profile · −1 to +1"
                    : "Map & intelligence"}
            </small>
          </span>
          {score && (
            <b aria-label={`Weighted profile index ${score}`}>{score}</b>
          )}
          {anchor === "reading" ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronUp size={16} />
          )}
        </button>
        <span id="se-sheet-help" className="sr-only">
          Drag up or down, tap, or use the arrow keys to switch between map,
          balanced, and reading views.
        </span>
        <div
          id="se-mobile-detail-content"
          className="se-mobile-detail-content"
          inert={anchor === "map" ? true : undefined}
        >
          {children}
        </div>
      </section>
    </div>
  );
}
