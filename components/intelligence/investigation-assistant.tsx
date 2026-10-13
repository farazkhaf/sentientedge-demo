"use client";
import { useDataset } from "./dataset-provider";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import { useAppStore } from "@/lib/store/app-store";
import type { InvestigationAction } from "@/lib/intelligence/assistant-contract";
import type { InvestigationSession } from "./use-investigation";
import { InvestigationArtifactView } from "./investigation-artifacts";
import { EvidenceCard } from "./intelligence-panel";

function AnswerText({
  text,
  onEvidence,
}: {
  text: string;
  onEvidence: (id: string) => void;
}) {
  const { evidenceById } = useDataset();
  return (
    <div className="se-answer-text">
      {text
        .split(/\n+/)
        .filter(Boolean)
        .map((line, i) => (
          <p key={i}>
            {line
              .replace(/^#{1,3}\s+/, "")
              .split(/(\*\*[^*]+\*\*|\[(?:news|social):[^\]]+\]|\[profile\])/g)
              .map((part, j) =>
                part.startsWith("**") ? (
                  <strong key={j}>{part.slice(2, -2)}</strong>
                ) : /^\[(news|social):/.test(part) &&
                  evidenceById.has(part.slice(1, -1)) ? (
                  <button
                    key={j}
                    className="se-citation"
                    title="Read supporting record"
                    onClick={() => onEvidence(part.slice(1, -1))}
                  >
                    source
                  </button>
                ) : part === "[profile]" ? (
                  <span key={j} className="se-profile-reference">
                    profile
                  </span>
                ) : (
                  part
                ),
              )}
          </p>
        ))}
    </div>
  );
}
export function InvestigationAssistant({
  session,
  open,
  close,
}: {
  session: InvestigationSession;
  open: (action: InvestigationAction) => void;
  close?: () => void;
}) {
  const { dataService, evidenceById } = useDataset();

  const {
    selectedNeighborhood: selected,
    setSelectedNeighborhood,
    comparisonMode,
    comparisonNeighborhoods,
    appMode,
  } = useAppStore();
  const [draft, setDraft] = useState("");
  const [recordId, setRecordId] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const comparing =
    appMode === "explore" &&
    comparisonMode &&
    comparisonNeighborhoods.length > 0;
  const name = comparing
    ? comparisonNeighborhoods
        .map((id) => dataService.getAllDataForNeighborhood(id)?.name)
        .join(" + ")
    : selected
      ? dataService.getAllDataForNeighborhood(selected)?.name
      : "Miami";
  useEffect(() => {
    end.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [session.messages.length, session.pending, session.error]);
  const submit = () => {
    if (draft.trim() && !session.pending && session.available) {
      void session.send(draft);
      setDraft("");
    }
  };
  const prompts = comparing
    ? [
        `Explain the differences between ${name}`,
        `Compare news and community perspectives for ${name}`,
        `Chart included news counts for ${name}`,
      ]
    : selected
      ? [
          `Give me a briefing on ${name}`,
          `Show a timeline of developments in ${name}`,
          `Chart news topics in ${name}`,
        ]
      : [
          "What is happening across Miami?",
          "Compare Brickell and Allapattah",
          "Show a timeline of developments in Little Havana",
        ];
  return (
    <section className="se-assistant" aria-label="Urban intelligence assistant">
      <header>
        <div>
          <span className="se-eyebrow">AI-assisted investigation</span>
          <h2>
            <Sparkles size={17} />
            Ask SentientEdge
          </h2>
        </div>
        <div>
          <button
            title="New conversation"
            aria-label="New conversation"
            disabled={session.pending || !session.messages.length}
            onClick={() => {
              session.reset();
              setRecordId(null);
            }}
          >
            <RotateCcw size={15} />
          </button>
          {close && (
            <button aria-label="Close assistant" onClick={close}>
              <X size={17} />
            </button>
          )}
        </div>
      </header>
      <div className="se-assistant-context">
        <i />
        <strong>{name}</strong>
        <span>Workspace context</span>
        {(selected || comparing) && (
          <button
            onClick={() => {
              setSelectedNeighborhood(null);
              if (comparing)
                useAppStore.setState({
                  comparisonMode: false,
                  comparisonNeighborhoods: [],
                });
            }}
            title="Return workspace context to Miami"
            aria-label="Clear assistant neighborhood context"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div className="se-conversation">
        {!session.messages.length && (
          <div className="se-assistant-start">
            <span className="se-assistant-mark">
              <Sparkles size={23} />
            </span>
            <h3>Follow a question through the city.</h3>
            <p>
              Read neighborhood briefings, explore reported developments,
              compare areas, and carry your findings into the map.
            </p>
            <div>
              {prompts.map((p, i) => (
                <button
                  key={p}
                  disabled={!session.available || session.pending}
                  onClick={() => {
                    void session.send(p);
                  }}
                >
                  <small>0{i + 1}</small>
                  <span>{p}</span>
                  <ArrowUp size={13} />
                </button>
              ))}
            </div>
            <p className="se-assistant-capabilities">
              Briefings · comparisons · timelines · charts · map selections
            </p>
          </div>
        )}
        {session.messages.map((m) => (
          <article key={m.id} className={`se-chat-message se-chat-${m.role}`}>
            <span className="se-chat-role">
              {m.role === "user" ? "You" : "SentientEdge"}
            </span>
            {m.role === "user" ? (
              <p>{m.text}</p>
            ) : (
              <>
                <AnswerText text={m.text} onEvidence={setRecordId} />
                {m.artifacts.map((a, i) => (
                  <InvestigationArtifactView key={i} artifact={a} open={open} />
                ))}
                {m.evidence.length > 0 && (
                  <details className="se-assistant-sources">
                    <summary>
                      Supporting records <span>{m.evidence.length}</span>
                      <ChevronDown size={13} />
                    </summary>
                    {m.evidence.map((r) => (
                      <EvidenceCard key={r.id} record={r} showArea />
                    ))}
                  </details>
                )}
              </>
            )}
          </article>
        ))}
        {session.pending && (
          <div className="se-assistant-progress" role="status">
            <div>
              <LoaderCircle size={15} className="se-spin" />
              <span>Preparing your answer…</span>
            </div>
            <div className="se-answer-skeleton" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        {session.error && (
          <div className="se-assistant-error" role="alert">
            <p>{session.error}</p>
            <button
              onClick={() => {
                void session.retry();
              }}
            >
              Retry question
            </button>
          </div>
        )}
        <div ref={end} />
      </div>
      {recordId && evidenceById.has(recordId) && (
        <div className="se-cited-record">
          <header>
            <strong>Supporting record</strong>
            <button
              onClick={() => setRecordId(null)}
              aria-label="Close supporting record"
            >
              <X size={16} />
            </button>
          </header>
          <div>
            <EvidenceCard record={evidenceById.get(recordId)!} showArea />
          </div>
        </div>
      )}
      {!session.available && (
        <div className="se-assistant-paused" role="status">
          {session.availabilityMessage}
        </div>
      )}
      <form
        className="se-assistant-composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="se-question">
          Ask SentientEdge
        </label>
        <textarea
          id="se-question"
          ref={input}
          value={draft}
          disabled={!session.available}
          maxLength={2000}
          rows={2}
          placeholder={
            selected
              ? `Investigate ${name}…`
              : "Ask about Miami or a neighborhood…"
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || session.pending || !session.available}
          aria-label="Send question"
        >
          <ArrowUp size={18} />
        </button>
        <small>
          Answers use the included workspace data. Shift + Enter for a new line.
        </small>
      </form>
    </section>
  );
}
