import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getSegmentsWorkPath, updateSegmentSuttaId, type SegmentDocument } from "@/lib/segmentArtifacts";

export const Route = createFileRoute("/dev/pipeline")({
  component: PipelineMonitor,
});

const COLUMNS = [
  { label: "INGEST", key: "source" },
  { label: "DOWNLOAD", key: "audio" },
  { label: "TRANSCRIPTION", key: "transcript" },
  { label: "SUTTA MATCH", key: "sutta_match" },
  { label: "SEGMENTATION", key: "segments" },
  { label: "AUDIO TIMESTAMPS", key: "audio_timestamps" },
  { label: "CONTENT GEN", key: "generation" },
  { label: "VALIDATION", key: "validation" },
  { label: "SEAL TO GCS", key: "seal" },
  { label: "UPLOAD", key: "upload" },
];

const proofHref = (proofPath: string) => `/work-api?p=${encodeURIComponent(proofPath)}`;
const workHref = (workPath: string) => `/work-api?p=${encodeURIComponent(workPath)}`;

const doneStatuses = new Set(["completed", "valid", "sealed", "uploaded", "selected"]);

type StatusInfo = {
  text: string;
  color: string;
  background: string;
  border: string;
  raw: string;
};

const emptyStatus: StatusInfo = {
  text: "-",
  color: "#64748b",
  background: "#f8fafc",
  border: "#e2e8f0",
  raw: "wait",
};

function statusInfoFromRaw(rawStatus: string): StatusInfo {
  const status = rawStatus.toLowerCase();

  if (doneStatuses.has(status)) {
    return { text: "DONE", color: "#166534", background: "#dcfce7", border: "#86efac", raw: status };
  }
  if (status === "running") {
    return { text: "RUNNING", color: "#92400e", background: "#fef3c7", border: "#fcd34d", raw: status };
  }
  if (status === "queued") {
    return { text: "QUEUED", color: "#1d4ed8", background: "#dbeafe", border: "#93c5fd", raw: status };
  }
  if (status === "failed") {
    return { text: "FAILED", color: "#b91c1c", background: "#fee2e2", border: "#fecaca", raw: status };
  }
  if (status.includes("review")) {
    return { text: "REVIEW", color: "#9a3412", background: "#ffedd5", border: "#fdba74", raw: status };
  }

  return emptyStatus;
}

function PipelineMonitor() {
  const [data, setData] = useState<any>(null);
  const [fetchError, setFetchError] = useState("");
  const [editor, setEditor] = useState<{
    sourceTitle: string;
    workPath: string;
    draft: string;
    suttaId: string;
    status: "idle" | "loading" | "saving" | "saved" | "error";
    error: string | null;
  } | null>(null);
  const fetchData = () => {
    fetch(`/pipeline-status-api?t=${Date.now()}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        const text = await res.text();
        return JSON.parse(text.replace(/^\uFEFF/, ""));
      })
      .then((snapshot) => {
        setData(snapshot);
        setFetchError("");
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : String(err));
      });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div style={{padding: '20px'}}>
        Loading pipeline monitor...
        {fetchError && <pre style={{ color: '#dc2626', marginTop: '12px' }}>{fetchError}</pre>}
      </div>
    );
  }

  const sources = data.sources || [];

  const getStatusInfo = (sutta: any, dbKey: string): StatusInfo => {
    const info = sutta.stages.find((st: any) => st.stage === dbKey);
    const status = info ? info.status.toLowerCase() : 'wait';

    return statusInfoFromRaw(status);
  };

  const nextActionFor = (sutta: any) => {
    for (const column of COLUMNS) {
      const info = getStatusInfo(sutta, column.key);
      if (info.raw === "failed") return `Fix ${column.label.toLowerCase()}`;
      if (info.raw === "queued") return `Run ${column.label.toLowerCase()}`;
      if (info.raw === "running") return `Watch ${column.label.toLowerCase()}`;
    }
    return "Ready";
  };

  const totals = sources.reduce(
    (acc: { sealed: number; queued: number; failed: number; uploaded: number }, sutta: any) => {
      const statuses = COLUMNS.map((column) => getStatusInfo(sutta, column.key));
      if (statuses.some((info) => info.raw === "sealed")) acc.sealed += 1;
      if (statuses.some((info) => info.raw === "queued")) acc.queued += 1;
      if (statuses.some((info) => info.raw === "failed")) acc.failed += 1;
      if (statuses.some((info) => info.raw === "uploaded" || info.raw === "completed")) {
        const upload = getStatusInfo(sutta, "upload");
        if (upload.raw === "completed" || upload.raw === "uploaded") acc.uploaded += 1;
      }
      return acc;
    },
    { sealed: 0, queued: 0, failed: 0, uploaded: 0 },
  );

  const summaryCards = [
    { label: "Sources", value: sources.length, color: "#0f172a" },
    { label: "Sealed", value: totals.sealed, color: "#166534" },
    { label: "Uploaded", value: totals.uploaded, color: "#0f766e" },
    { label: "Queued", value: totals.queued, color: "#1d4ed8" },
    { label: "Failures", value: totals.failed, color: totals.failed ? "#b91c1c" : "#64748b" },
  ];

  const openSegmentsEditor = async (sutta: any) => {
    const workPath = getSegmentsWorkPath(sutta.artifacts);

    if (!workPath) {
      setEditor({
        sourceTitle: sutta.title || sutta.suttaHint || "Untitled source",
        workPath: "",
        draft: "",
        suttaId: sutta.suttaHint || "",
        status: "error",
        error: "No segments artifact has been written for this source yet.",
      });
      return;
    }

    setEditor({
      sourceTitle: sutta.title || sutta.suttaHint || "Untitled source",
      workPath,
      draft: "",
      suttaId: sutta.suttaHint || "",
      status: "loading",
      error: null,
    });

    try {
      const response = await fetch(workHref(workPath), { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load segments (${response.status})`);
      const document = (await response.json()) as SegmentDocument;
      setEditor({
        sourceTitle: sutta.title || sutta.suttaHint || "Untitled source",
        workPath,
        draft: JSON.stringify(document, null, 2),
        suttaId: document.sutta_id || sutta.suttaHint || "",
        status: "idle",
        error: null,
      });
    } catch (error) {
      setEditor((current) =>
        current
          ? {
              ...current,
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            }
          : current,
      );
    }
  };

  const updateEditorSuttaId = (suttaId: string) => {
    setEditor((current) => {
      if (!current) return current;

      try {
        const document = JSON.parse(current.draft || "{}") as SegmentDocument;
        return {
          ...current,
          suttaId,
          draft: JSON.stringify(updateSegmentSuttaId(document, suttaId), null, 2),
          status: "idle",
          error: null,
        };
      } catch {
        return {
          ...current,
          suttaId,
          status: "error",
          error: "Fix the JSON before changing the sutta id.",
        };
      }
    });
  };

  const saveSegmentsEditor = async () => {
    if (!editor || !editor.workPath) return;

    let parsed: SegmentDocument;
    try {
      parsed = updateSegmentSuttaId(JSON.parse(editor.draft) as SegmentDocument, editor.suttaId);
    } catch {
      setEditor({ ...editor, status: "error", error: "Segments JSON is not valid." });
      return;
    }

    setEditor({ ...editor, status: "saving", error: null });
    try {
      const response = await fetch(workHref(editor.workPath), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed, null, 2),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Unable to save segments (${response.status})`);
      }
      setEditor({
        ...editor,
        draft: JSON.stringify(parsed, null, 2),
        suttaId: parsed.sutta_id || "",
        status: "saved",
        error: null,
      });
    } catch (error) {
      setEditor({
        ...editor,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '28px', background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'flex-end', marginBottom: '18px' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', color: '#64748b', fontWeight: 800 }}>LOCAL DATA PLANT</div>
          <h2 style={{ margin: '4px 0 0', fontSize: '26px', letterSpacing: 0 }}>Pipeline Monitor</h2>
        </div>
        <div style={{ fontSize: '12px', color: fetchError ? '#b91c1c' : '#64748b', fontWeight: 700 }}>
          {fetchError ? `Status refresh failed: ${fetchError}` : 'Refreshing every 2s'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        {summaryCards.map((card) => (
          <div key={card.label} style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>{card.label}</div>
            <div style={{ marginTop: '4px', fontSize: '24px', fontWeight: 900, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: '1180px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ borderBottom: '1px solid #cbd5e1', padding: '12px', textAlign: 'left', minWidth: '220px', fontSize: '11px', color: '#475569' }}>SUTTA / ARTIFACTS</th>
              <th style={{ borderBottom: '1px solid #cbd5e1', padding: '12px', textAlign: 'left', minWidth: '150px', fontSize: '11px', color: '#475569' }}>NEXT</th>
              {COLUMNS.map(c => (
                <th key={c.key} style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', fontSize: '10px', textAlign: 'center', color: '#475569', width: '86px' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((s: any, i: number) => (
              <tr key={i} style={{ background: i % 2 ? '#ffffff' : '#fbfdff' }}>
                <td style={{ borderBottom: '1px solid #e2e8f0', padding: '12px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 900, fontSize: '14px' }}>{s.suttaHint}</div>
                  {s.title && <div style={{ marginTop: '3px', color: '#64748b', fontSize: '11px', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>}
                  <div style={{ fontSize: '9px', fontWeight: 700, marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {s.proofs.validation && (
                      <a href={proofHref(s.proofs.validation)} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'none', border: '1px solid #bfdbfe', background: '#eff6ff', padding: '3px 5px', borderRadius: '4px' }}>Validation</a>
                    )}
                    {s.proofs.manifest && (
                      <a href={proofHref(s.proofs.manifest)} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'none', border: '1px solid #bfdbfe', background: '#eff6ff', padding: '3px 5px', borderRadius: '4px' }}>Manifest</a>
                    )}
                    {s.proofs.receipt && (
                      <a href={proofHref(s.proofs.receipt)} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'none', border: '1px solid #bfdbfe', background: '#eff6ff', padding: '3px 5px', borderRadius: '4px' }}>Receipt</a>
                    )}
                    {getSegmentsWorkPath(s.artifacts) && (
                      <button type="button" onClick={() => openSegmentsEditor(s)} style={{ color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '3px 5px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: 800 }}>
                        Segments
                      </button>
                    )}
                  </div>
                </td>
                <td style={{ borderBottom: '1px solid #e2e8f0', padding: '12px', verticalAlign: 'top', color: '#334155', fontSize: '12px', fontWeight: 800 }}>
                  {nextActionFor(s)}
                </td>
                {COLUMNS.map(c => {
                  const info = getStatusInfo(s, c.key);
                  return (
                    <td key={c.key} style={{ borderBottom: '1px solid #e2e8f0', padding: '10px 6px', textAlign: 'center', verticalAlign: 'top' }}>
                      <span style={{
                        display: 'inline-flex',
                        minWidth: '58px',
                        justifyContent: 'center',
                        border: `1px solid ${info.border}`,
                        background: info.background,
                        borderRadius: '999px',
                        padding: '4px 7px',
                        fontWeight: 900,
                        fontSize: '10px',
                        color: info.color,
                      }}>
                        {info.text}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '14px', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 800, color: '#475569' }}>
        <span>DONE = completed artifact or seal</span>
        <span>QUEUED = worker waiting</span>
        <span>RUNNING = active worker</span>
        <span>FAILED = needs repair</span>
      </div>

      {editor && (
        <div style={{ position: 'fixed', inset: '0 0 0 auto', width: 'min(720px, 100vw)', background: '#ffffff', borderLeft: '2px solid #0f172a', boxShadow: '-12px 0 30px rgba(15, 23, 42, 0.2)', padding: '24px', overflow: 'auto', zIndex: 50 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px' }}>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '0.08em', fontWeight: 800, color: '#0f766e' }}>SEGMENTATION INSPECTOR</div>
              <h3 style={{ margin: '4px 0 6px', fontSize: '20px' }}>{editor.sourceTitle}</h3>
              {editor.workPath && <div style={{ fontSize: '12px', color: '#64748b' }}>{editor.workPath}</div>}
            </div>
            <button type="button" onClick={() => setEditor(null)} style={{ border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '6px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 }}>
              Close
            </button>
          </div>

          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '14px' }}>
            SUTTA ID
            <input value={editor.suttaId} onChange={(event) => updateEditorSuttaId(event.target.value)} disabled={editor.status === 'loading' || !editor.workPath} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 12px', fontSize: '15px', fontWeight: 700 }} />
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#334155' }}>
            SEGMENTS JSON
            <textarea value={editor.draft} onChange={(event) => setEditor({ ...editor, draft: event.target.value, status: 'idle', error: null })} disabled={editor.status === 'loading' || !editor.workPath} spellCheck={false} style={{ minHeight: '420px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '12px', lineHeight: 1.5, resize: 'vertical' }} />
          </label>

          {editor.error && <div style={{ marginTop: '12px', color: '#b91c1c', fontSize: '13px', fontWeight: 700 }}>{editor.error}</div>}
          {editor.status === 'saved' && <div style={{ marginTop: '12px', color: '#15803d', fontSize: '13px', fontWeight: 700 }}>Saved.</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            {editor.workPath && (
              <a href={workHref(editor.workPath)} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '9px 12px', fontSize: '13px', fontWeight: 700 }}>
                Open Raw
              </a>
            )}
            <button type="button" onClick={saveSegmentsEditor} disabled={!editor.workPath || editor.status === 'loading' || editor.status === 'saving'} style={{ border: '1px solid #0f766e', background: editor.status === 'saving' ? '#99f6e4' : '#0f766e', color: editor.status === 'saving' ? '#134e4a' : 'white', borderRadius: '6px', padding: '9px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}>
              {editor.status === 'saving' ? 'Saving...' : 'Save Segments'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
