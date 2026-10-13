"use client";
import { useDataset } from "./dataset-provider";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import type {
  InvestigationArtifact,
  InvestigationMessage,
  InvestigationResponse,
} from "@/lib/intelligence/assistant-contract";

function reference(a: InvestigationArtifact) {
  if (a.type === "briefing")
    return { type: a.type, areaId: a.areaId, kind: a.kind };
  if (a.type === "comparison")
    return { type: a.type, areaIds: a.profiles.map((p) => p.id) };
  if (a.type === "map") return { type: a.type, ...a.action };
  if (a.type === "timeline")
    return { type: a.type, recordIds: a.records.map((r) => r.id) };
  return {
    type: a.type,
    title: a.title,
    areas:
      a.type === "chart"
        ? a.points.map((p) => p.label)
        : a.series.map((s) => s.name),
  };
}
export function useInvestigation(
  view: "home" | "explore" | "intelligence" | "compare",
) {
  const { availability } = useDataset();
  const [messages, setMessages] = useState<InvestigationMessage[]>([]);
  const history = useRef<InvestigationMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const send = async (question: string) => {
    const text = question.trim();
    if (!text || request.current || !availability.assistantAvailable) return;
    const previous =
      history.current.at(-1)?.role === "user"
        ? history.current.slice(0, -1)
        : history.current;
    const user: InvestigationMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      artifacts: [],
      evidence: [],
    };
    const next = [...previous, user];
    history.current = next;
    setMessages(next);
    setError("");
    setPending(true);
    const controller = new AbortController();
    request.current = controller;
    const state = useAppStore.getState();
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: next.slice(-11).map((m) => ({
            role: m.role,
            content: (
              m.text +
              (m.artifacts.length
                ? "\nDisplayed artifact references: " +
                  JSON.stringify(m.artifacts.map(reference))
                : "")
            ).slice(0, 6000),
          })),
          context: {
            selected: state.selectedNeighborhood,
            comparison: state.comparisonNeighborhoods,
            view,
            activeLayers: state.activeLayers,
            layerWeights: state.layerWeights,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "The assistant couldn't answer this question.",
        );
      const answer = result as InvestigationResponse;
      history.current = [
        ...next,
        { ...answer, role: "assistant", id: crypto.randomUUID() },
      ];
      setMessages(history.current);
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          e instanceof Error ? e.message : "Connection interrupted. Try again.",
        );
    } finally {
      request.current = null;
      setPending(false);
    }
  };
  return {
    available: availability.assistantAvailable,
    availabilityMessage: availability.message,
    messages,
    pending,
    error,
    send,
    reset: () => {
      if (!request.current) {
        history.current = [];
        setMessages([]);
        setError("");
      }
    },
    retry: () => send(history.current.at(-1)?.text ?? ""),
  };
}
export type InvestigationSession = ReturnType<typeof useInvestigation>;
