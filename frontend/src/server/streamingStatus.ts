import { createServerFn } from "@tanstack/start-client-core";

type CountRow = { label: string; count: number };
type JobRow = {
  jobId: string;
  workerType: string;
  suttaId: string;
  status: string;
  attemptCount: number;
  errorType: string;
};
type StageRow = {
  suttaId: string;
  stage: string;
  status: string;
  updatedAt: string;
};
type EventRow = {
  occurredAt: string;
  eventType: string;
  publisher: string;
  correlationId: string;
};
type SourceRow = {
  sourceId: string;
  sourceType: string;
  nikaya: string;
  book: string;
  suttaHint: string;
  status: string;
};
type WorkerRow = {
  name: string;
  status: string;
  lastEventId: string;
  updatedAt: string;
  isStale: boolean;
};

export type StreamingStatusSnapshot = {
  dbPath: string;
  exists: boolean;
  error?: string;
  tableCounts: CountRow[];
  eventsByType: CountRow[];
  jobsByStatus: { workerType: string; status: string; count: number }[];
  jobs: JobRow[];
  stages: StageRow[];
  events: EventRow[];
  sources: SourceRow[];
  workers: WorkerRow[];
};

function emptySnapshot(dbPath: string, exists: boolean, error?: string): StreamingStatusSnapshot {
  return {
    dbPath,
    exists,
    error,
    tableCounts: [],
    eventsByType: [],
    jobsByStatus: [],
    jobs: [],
    stages: [],
    events: [],
    sources: [],
    workers: [],
  };
}

export const getStreamingStatus = createServerFn({ method: "GET" }).handler(async () => {
  const [{ execFileSync }, fs, path] = await Promise.all([
    import("node:child_process"),
    import("node:fs"),
    import("node:path"),
  ]);
  const repoRoot = process.cwd();
  const defaultDbPath = path.join(repoRoot, "data", "work", "streaming", "pipeline.sqlite3");
  const dbPath = process.env.DAMA_STREAMING_DB || defaultDbPath;
  const exists = fs.existsSync(dbPath);
  if (!exists) return emptySnapshot(dbPath, false);

  try {
    // Using 'uv' directly if possible, or fallback to python -m uv
    const cmd = process.platform === 'win32' ? 'uv.exe' : 'uv';
    const raw = execFileSync(
      cmd,
      ["run", "python", "-m", "scripts2.streaming.status", "--db", dbPath, "snapshot"],
      { cwd: repoRoot, encoding: "utf8", timeout: 5000 },
    );
    const parsed = JSON.parse(raw) as Omit<StreamingStatusSnapshot, "dbPath" | "exists">;
    return {
      dbPath,
      exists,
      ...parsed,
    } satisfies StreamingStatusSnapshot;
  } catch (err: any) {
    console.error("Pipeline Monitor Error:", err.message);
    return emptySnapshot(dbPath, true, err.message);
  }
});
