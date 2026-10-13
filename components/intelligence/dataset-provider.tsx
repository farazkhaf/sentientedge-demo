"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createDataset, type Dataset } from "@/lib/storage/dataset";
import type {
  DemoAvailability,
  WorkspaceSnapshot,
} from "@/lib/storage/snapshot";

const Context = createContext<
  (Dataset & { availability: DemoAvailability }) | null
>(null);
export function useDataset() {
  const value = useContext(Context);
  if (!value)
    throw new Error("Workspace data must be loaded before rendering.");
  return value;
}
export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<React.ContextType<typeof Context>>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/workspace", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "The workspace could not be loaded.");
        setValue({
          ...createDataset(body.snapshot as WorkspaceSnapshot),
          availability: body.availability,
        });
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [attempt]);
  if (!value)
    return (
      <main className="se-workspace-status">
        <strong>
          SentientEdge <small>MIAMI</small>
        </strong>
        <section role={error ? "alert" : "status"}>
          {error ? (
            <>
              <h1>Workspace unavailable</h1>
              <p>{error}</p>
              <button onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            </>
          ) : (
            <>
              <LoaderCircle className="se-spin" size={24} />
              <h1>Opening Miami</h1>
              <p>Loading the city intelligence workspace…</p>
            </>
          )}
        </section>
      </main>
    );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
