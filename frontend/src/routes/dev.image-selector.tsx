import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Check, Image as ImageIcon, Search, X } from "lucide-react";

export const Route = createFileRoute("/dev/image-selector")({
  component: ImageSelectorScreen,
});

type Candidate = {
  panelId: string;
  imageUrl: string;
  localPath: string;
  title: string;
};

type Selection = {
  sutta_id: string;
  panel_id: string;
  image_url: string;
  status: string;
  selection_word: string;
  selection_reason: string;
  exact_sutta_text: string;
  selected_by: string;
  created_at: string;
};

function ImageSelectorScreen() {
  const { suttaId: initialSuttaId } = Route.useSearch() as { suttaId?: string };
  const [suttaId, setSuttaId] = useState(initialSuttaId || "");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/image-selector-api");
      if (!res.ok) throw new Error("API fail");
      const data = await res.json();
      setCandidates(data.candidates || []);
      setSelections(data.selections || {});

      // Auto-select if sutta has selection grunt
      if (initialSuttaId && data.selections[initialSuttaId]) {
        const sel = data.selections[initialSuttaId];
        setSelectedPanelId(sel.panel_id);
        setReason(sel.selection_reason);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!suttaId || !selectedPanelId) return;
    setSaving(true);
    setError(null);

    const panel = candidates.find(c => c.panelId === selectedPanelId);
    if (!panel) return;

    try {
      const res = await fetch("/image-selector-api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sutta_id: suttaId,
          panel_id: selectedPanelId,
          image_url: panel.imageUrl,
          selection_reason: reason,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save fail");
      }
      await fetchData();
      alert("Selection saved and approved grunt!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "40px" }}>Cave man loading images...</div>;

  const filtered = candidates.filter(c =>
    c.title.toLowerCase().includes(filter.toLowerCase()) ||
    c.panelId.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "sans-serif", padding: "40px" }}>
      <header style={{ marginBottom: "30px", borderBottom: "2px solid #e2e8f0", paddingBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 900 }}>IMAGE SELECTOR</h1>
          <p style={{ color: "#64748b", marginTop: "4px" }}>Match Buddha bones with mountain images. Grunt.</p>
        </div>
        <button onClick={() => window.history.back()} style={{ padding: "8px 16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>Back to Dash</button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "30px" }}>
        {/* Control Panel grunt */}
        <section style={{ background: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0", height: "fit-content", position: "sticky", top: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>SELECTION</h2>

          <label style={{ display: "block", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px" }}>SUTTA ID</span>
            <input
              value={suttaId}
              onChange={e => setSuttaId(e.target.value)}
              placeholder="e.g. AN 1.1"
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "16px", fontWeight: 700 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px" }}>WHY THIS IMAGE?</span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason for selection grunt..."
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", minHeight: "100px" }}
            />
          </label>

          <div style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px" }}>PANEL SELECTED</span>
            {selectedPanelId ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f0fdf4", padding: "10px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                <ImageIcon size={16} color="#166534" />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#166534" }}>{selectedPanelId}</span>
                <button onClick={() => setSelectedPanelId(null)} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer" }}><X size={14} /></button>
              </div>
            ) : (
              <div style={{ fontSize: "14px", color: "#94a3b8", italic: "true" }}>No panel picked yet. Grunt.</div>
            )}
          </div>

          {error && <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: "16px", fontWeight: 700 }}>{error}</div>}

          <button
            onClick={handleSave}
            disabled={!suttaId || !selectedPanelId || saving}
            style={{
              width: "100%", padding: "14px", borderRadius: "8px", border: "none",
              background: "#0f172a", color: "#ffffff", fontWeight: 800, fontSize: "14px",
              cursor: "pointer", opacity: (!suttaId || !selectedPanelId || saving) ? 0.5 : 1
            }}
          >
            {saving ? "SAVING..." : "APPROVE SELECTION"}
          </button>

          {selections[suttaId] && (
            <div style={{ marginTop: "20px", padding: "12px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase" }}>Current Selection</div>
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "4px" }}>{selections[suttaId].panel_id}</div>
              <div style={{ fontSize: "11px", color: "#1d4ed8", marginTop: "2px" }}>{selections[suttaId].created_at}</div>
            </div>
          )}
        </section>

        {/* Gallery grunt */}
        <section>
          <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Search panels..."
                style={{ width: "100%", padding: "12px 12px 12px 40px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
            {filtered.map(c => {
              const isSelected = selectedPanelId === c.panelId;
              const isUsedElsewhere = Object.values(selections).some(s => s.panel_id === c.panelId && s.sutta_id !== suttaId);

              return (
                <div
                  key={c.panelId}
                  onClick={() => setSelectedPanelId(c.panelId)}
                  style={{
                    background: "#ffffff", borderRadius: "12px", border: `2px solid ${isSelected ? "#2563eb" : "#e2e8f0"}`,
                    overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
                    boxShadow: isSelected ? "0 10px 15px -3px rgba(37, 99, 235, 0.2)" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
                  }}
                >
                  <div style={{ aspectRatio: "4/3", background: "#f1f5f9", overflow: "hidden", position: "relative" }}>
                    <img src={c.imageUrl} alt={c.title} style={{ width: "100%", height: "100%", objectCover: "cover" }} />
                    {isSelected && (
                      <div style={{ position: "absolute", top: "8px", right: "8px", background: "#2563eb", color: "white", padding: "4px", borderRadius: "50%" }}>
                        <Check size={16} />
                      </div>
                    )}
                    {isUsedElsewhere && (
                      <div style={{ position: "absolute", bottom: "0", insetX: "0", background: "rgba(15, 23, 42, 0.6)", color: "white", fontSize: "9px", padding: "4px", textAlign: "center", fontWeight: 700 }}>
                        USED IN OTHER SUTTA
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "12px" }}>
                    <div style={{ fontWeight: 800, fontSize: "13px", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                    <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>{c.panelId}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
