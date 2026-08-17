// Types & Interfaces for Sutta Explorer

interface SuttaEntry {
  sutta_id: string;
  title: string;
  sutta_name?: string;
  nikaya: string;
  folder: string;
  video_id: string;
  status: string;
  languages: Record<string, string>;
  sc_url?: string;
  last_edited_timestamp?: number;
}

interface SuttaRegistry {
  config: {
    nikaya_folders: Record<string, string>;
    audio_defaults: {
      fallback_audio_file: string;
      fallback_start_s: number;
      fallback_end_s: number;
    };
  };
  entries: Record<string, SuttaEntry>;
}

interface QuizOption {
  id: string;
  title: string;
  body?: string;
}

interface SuttaQuiz {
  quote: string;
  options: QuizOption[];
  goldOptionId: string;
  teacherSummary?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  pali?: string;
  description?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relation?: string;
  order?: number;
}

interface SuttaDetail {
  sutta_id: string;
  sutta_name?: string;
  names?: { official?: string };
  sutta?: string;
  transcript?: string;
  commentary?: string;
  quiz?: SuttaQuiz;
  knowledge_graph?: {
    nodes?: GraphNode[];
    edges?: GraphEdge[];
  };
  aud_file?: string;
  aud_start_s?: number;
  aud_end_s?: number;
  sc_url?: string;
  image_url?: string;
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

// Tree view Node structure
interface TreeNode {
  label: string;
  children?: TreeNode[];
}

// Global Application State
let appRegistry: SuttaRegistry | null = null;
let selectedSuttaId: string | null = null;
let currentLanguage: string = "en";
const detailCache: Record<string, SuttaDetail> = {};
let promptsMap: Record<string, string> = {};
let suttaChatHistory: ChatMessage[] = [];
let homeChatHistory: ChatMessage[] = [];

// Safe Element Retrieval Utility
function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Element with id '${id}' not found in DOM.`);
  return el;
}

// Helper: Check if entry is a real Sutta (filters out video/folder placeholders like "AN Book 5C...")
function isGenuineSutta(sid: string, entry: SuttaEntry): boolean {
  if (!sid || !entry) return false;
  const sLower = sid.toLowerCase();
  const folderLower = (entry.folder || "").toLowerCase();
  if (sLower.includes("book") || folderLower.startsWith("book")) {
    return false;
  }
  return true;
}

// Map book numbers to clean English labels
function getBookLabel(bookFolder: string, nikaya: string): string {
  const nik = (nikaya || "").toLowerCase();
  let clean = bookFolder.replace(/^book\s+/i, "").replace(/^[0_]+/, "").trim();
  if (clean.includes("_")) clean = clean.split("_")[0];
  if (clean.includes(" ")) clean = clean.split(" ")[0];
  
  const num = parseInt(clean);
  if (nik === "an") {
    const ordinals: Record<number, string> = {
      1: "Book 1 (Ones)",
      2: "Book 2 (Twos)",
      3: "Book 3 (Threes)",
      4: "Book 4 (Fours)",
      5: "Book 5 (Fives)",
      6: "Book 6 (Sixes)",
      7: "Book 7 (Sevens)",
      8: "Book 8 (Eights)",
      9: "Book 9 (Nines)",
      10: "Book 10 (Tens)",
      11: "Book 11 (Elevens)"
    };
    if (!isNaN(num) && ordinals[num]) {
      return ordinals[num];
    }
  }
  return clean ? `Book ${clean}` : "Book General";
}


// Translate raw Nikaya abbreviations
function getNikayaLabel(nik: string): string {
  const labels: Record<string, string> = {
    "an": "Anguttara Nikaya",
    "dn": "Digha Nikaya",
    "mn": "Majjhima Nikaya",
    "sn": "Samyutta Nikaya",
    "kn": "Khuddaka Nikaya"
  };
  return labels[nik.toLowerCase()] || nik.toUpperCase();
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("master.json");
    if (!response.ok) throw new Error("Registry load failed.");
    appRegistry = await response.json() as SuttaRegistry;

    // Load Prompts catalog
    await loadPrompts();

    // Build the Nikaya dropdown options list
    initNikayaSelector();
    
    // Wire up Routing
    window.addEventListener("hashchange", handleRouting);
    handleRouting(); // First check on load

  } catch (err) {
    console.error(err);
    getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> <span style="color:red;">Failed to load master registry catalog.</span>`;
  }
});

// Load and parse prompts.txt into sections
async function loadPrompts() {
  try {
    const res = await fetch("prompts.txt");
    if (!res.ok) return;
    const text = await res.text();
    
    let currentKey = "";
    let currentContent: string[] = [];
    
    text.split("\n").forEach(line => {
      const match = line.match(/^\[([a-zA-Z0-9_]+)\]$/);
      if (match) {
        if (currentKey) {
          promptsMap[currentKey] = currentContent.join("\n").trim();
        }
        currentKey = match[1];
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    });
    if (currentKey) {
      promptsMap[currentKey] = currentContent.join("\n").trim();
    }
  } catch (err) {
    console.warn("Prompts file loading skipped:", err);
  }
}

// Populates Nikaya capsule selector
function initNikayaSelector() {
  const sel = getEl<HTMLSelectElement>("nikayaSelector");
  sel.innerHTML = '<option value="">SELECT NIKAYA</option>';
  
  const nikayas = new Set<string>();
  Object.keys(appRegistry!.entries).forEach(sid => {
    const entry = appRegistry!.entries[sid];
    if (isGenuineSutta(sid, entry) && entry.nikaya) {
      nikayas.add(entry.nikaya.toLowerCase());
    }
  });
  
  Array.from(nikayas).sort().forEach(nik => {
    const opt = document.createElement("option");
    opt.value = nik;
    
    let hasComplete = false;
    Object.keys(appRegistry!.entries).forEach(sid => {
      const e = appRegistry!.entries[sid];
      if (isGenuineSutta(sid, e) && e.nikaya && e.nikaya.toLowerCase() === nik) {
        if (e.status === "COMPLETE") {
          hasComplete = true;
        }
      }
    });
    
    if (hasComplete) {
      opt.innerText = `🟢 ${getNikayaLabel(nik)}`;
      opt.style.color = "#065f46";
      opt.style.fontWeight = "bold";
    } else {
      opt.innerText = `⚪ ${getNikayaLabel(nik)}`;
      opt.style.color = "#6b7280";
    }
    sel.appendChild(opt);
  });
}

// Fired when user changes Nikaya
function onNikayaChange() {
  const nikVal = getEl<HTMLSelectElement>("nikayaSelector").value;
  const bookSel = getEl<HTMLSelectElement>("bookSelector");
  const suttaSel = getEl<HTMLSelectElement>("suttaSelector");
  
  bookSel.innerHTML = '<option value="">SELECT BOOK</option>';
  suttaSel.innerHTML = '<option value="">SELECT SUTTA</option>';
  
  if (!nikVal) {
    return;
  }
  
  const books = new Set<string>();
  Object.keys(appRegistry!.entries).forEach(sid => {
    const entry = appRegistry!.entries[sid];
    if (isGenuineSutta(sid, entry) && entry.nikaya.toLowerCase() === nikVal && entry.folder) {
      let bKey = entry.folder;
      if (nikVal === "an" && entry.folder.includes("_")) {
        bKey = entry.folder.split("_")[0];
      }
      books.add(bKey);
    }
  });
  
  const sortedBooks = Array.from(books).sort((a, b) => {
    const na = parseInt(a);
    const nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  
  sortedBooks.forEach(book => {
    const opt = document.createElement("option");
    opt.value = book;
    
    let hasComplete = false;
    Object.keys(appRegistry!.entries).forEach(sid => {
      const e = appRegistry!.entries[sid];
      if (isGenuineSutta(sid, e) && e.nikaya.toLowerCase() === nikVal && e.folder) {
        let bKey = e.folder;
        if (nikVal === "an" && e.folder.includes("_")) {
          bKey = e.folder.split("_")[0];
        }
        if (bKey === book && e.status === "COMPLETE") {
          hasComplete = true;
        }
      }
    });
    
    if (hasComplete) {
      opt.innerText = `🟢 ${getBookLabel(book, nikVal)}`;
      opt.style.color = "#065f46";
      opt.style.fontWeight = "bold";
    } else {
      opt.innerText = `⚪ ${getBookLabel(book, nikVal)}`;
      opt.style.color = "#6b7280";
    }
    bookSel.appendChild(opt);
  });
}
(window as any).onNikayaChange = onNikayaChange;

// Fired when user changes Book
function onBookChange() {
  const nikVal = getEl<HTMLSelectElement>("nikayaSelector").value;
  const bookVal = getEl<HTMLSelectElement>("bookSelector").value;
  const suttaSel = getEl<HTMLSelectElement>("suttaSelector");
  
  suttaSel.innerHTML = '<option value="">SELECT SUTTA</option>';
  
  if (!nikVal || !bookVal) {
    return;
  }
  
  const matchedSuttas: string[] = [];
  Object.keys(appRegistry!.entries).forEach(sid => {
    const entry = appRegistry!.entries[sid];
    if (!isGenuineSutta(sid, entry)) return;
    if (entry.nikaya.toLowerCase() === nikVal) {
      let bKey = entry.folder;
      if (nikVal === "an" && entry.folder.includes("_")) {
        bKey = entry.folder.split("_")[0];
      }
      if (bKey === bookVal) {
        matchedSuttas.push(sid);
      }
    }
  });
  
  matchedSuttas.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  
  matchedSuttas.forEach(sid => {
    const entry = appRegistry!.entries[sid];
    const opt = document.createElement("option");
    opt.value = sid;
    const isComplete = (entry.status === "COMPLETE");
    if (isComplete) {
      opt.innerText = `🟢 ${sid} - ${entry.title || "Untitled"}`;
      opt.style.color = "#065f46";
      opt.style.fontWeight = "bold";
    } else {
      opt.innerText = `⚪ ${sid} - ${entry.title || "Untitled"}`;
      opt.style.color = "#6b7280";
    }
    suttaSel.appendChild(opt);
  });
}
(window as any).onBookChange = onBookChange;


// Fired when user changes Sutta
function onSuttaChange() {
  const suttaVal = getEl<HTMLSelectElement>("suttaSelector").value;
  if (suttaVal) {
    window.location.hash = `/sutta/${suttaVal}`;
  }
}
(window as any).onSuttaChange = onSuttaChange;

// URL Hash Router
function handleRouting() {
  const hash = window.location.hash || "";
  let path = window.location.pathname;
  
  let targetSuttaId = "";
  if (hash.startsWith("#/sutta/")) {
    targetSuttaId = decodeURIComponent(hash.substring(8));
  } else if (path.includes("/sutta/")) {
    const idx = path.indexOf("/sutta/");
    targetSuttaId = decodeURIComponent(path.substring(idx + 7));
  }
  
  if (targetSuttaId) {
    selectSutta(targetSuttaId);
  } else {
    selectedSuttaId = null;
    getEl<HTMLSelectElement>("nikayaSelector").value = "";
    getEl<HTMLSelectElement>("bookSelector").innerHTML = '<option value="">BOOK</option>';
    getEl<HTMLSelectElement>("suttaSelector").innerHTML = '<option value="">SUTTA</option>';
    getEl("langToggleBtn").style.display = "none";
    
    getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> SUTTA DISCOURSE CATALOG EXPLORER`;
    resetLeftPane();
    showHomeView();
  }
}

// Language Switch Action
function toggleLanguage() {
  if (!selectedSuttaId || !appRegistry) return;
  const entry = appRegistry.entries[selectedSuttaId];
  if (!entry || !entry.languages) return;
  
  const langs = Object.keys(entry.languages);
  if (langs.length === 0) return;
  
  const idx = langs.indexOf(currentLanguage);
  currentLanguage = langs[(idx + 1) % langs.length];
  selectSutta(selectedSuttaId);
}
(window as any).toggleLanguage = toggleLanguage;

// Converts flat knowledge graph to recursive tree structure
function transformKnowledgeGraph(details: SuttaDetail): TreeNode | null {
  if (!details.knowledge_graph) return null;
  const kg = details.knowledge_graph;
  if (!kg.nodes || kg.nodes.length === 0) return null;
  
  const nodesMap = new Map<string, GraphNode>(kg.nodes.map(n => [n.id, n]));
  const edges = kg.edges || [];
  
  const targetIds = new Set<string>(edges.map(e => e.target));
  const potentialRoots = kg.nodes.filter(n => !targetIds.has(n.id) || n.type === "Support");
  const supportRoots = potentialRoots.filter(n => n.type === "Support");
  const roots = supportRoots.length > 0 ? supportRoots : potentialRoots;
  
  const buildTree = (nodeId: string): TreeNode => {
    const node = nodesMap.get(nodeId)!;
    const childEdges = edges
      .filter(e => e.source === nodeId && e.relation !== "PARALLEL_TO")
      .sort((a, b) => (a.order || 0) - (b.order || 0));
      
    const label = node.pali ? `${node.label} (${node.pali})` : node.label;
    
    return {
      label,
      children: childEdges.length > 0 ? childEdges.map(e => buildTree(e.target)) : undefined
    };
  };
  
  return {
    label: "TEACHING STRUCTURE",
    children: roots.map(r => buildTree(r.id))
  };
}

// Recursive Tree rendering helper
function renderTreeNodes(node: TreeNode, isRoot = false): string {
  const lineHtml = !isRoot ? `<div class="tree-node-line"></div>` : "";
  const rootClass = isRoot ? "root" : "";
  
  let childrenHtml = "";
  if (node.children && node.children.length > 0) {
    childrenHtml = `
      <div class="tree-children">
        ${node.children.map(child => renderTreeNodes(child, false)).join("")}
      </div>
    `;
  }
  
  return `
    <div class="tree-node">
      ${lineHtml}
      <div class="tree-node-content ${rootClass}">
        ${node.label}
      </div>
      ${childrenHtml}
    </div>
  `;
}

// Select and load Sutta details
async function selectSutta(suttaId: string) {
  if (!appRegistry) return;
  
  selectedSuttaId = suttaId;
  suttaChatHistory = []; // Reset REFLECT chat
  const entry = appRegistry.entries[suttaId];
  
  if (!entry) {
    getEl("suttaNotFoundCard").style.display = "flex";
    getEl("suttaViewActive").style.display = "none";
    getEl("errorDescription").innerText = `Sutta ${suttaId} not found in the universe catalog registry.`;
    getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> SUTTA NOT FOUND`;
    getEl("langToggleBtn").style.display = "none";
    return;
  }
  
  // Set dropdowns to match selected sutta
  const nikSel = getEl<HTMLSelectElement>("nikayaSelector");
  nikSel.value = entry.nikaya.toLowerCase();
  onNikayaChange();
  
  const bookSel = getEl<HTMLSelectElement>("bookSelector");
  if (entry.nikaya.toLowerCase() === "an" && entry.folder.includes("_")) {
    bookSel.value = entry.folder.split("_")[0];
  } else {
    bookSel.value = entry.folder;
  }
  onBookChange();
  
  const suttaSel = getEl<HTMLSelectElement>("suttaSelector");
  suttaSel.value = suttaId;
  
  // Set breadcrumbs text
  const nLabel = getNikayaLabel(entry.nikaya);
  const bLabel = getBookLabel(entry.folder, entry.nikaya);
  getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> ${nLabel} · ${bLabel} · ${suttaId}`;
  
  // Handle GHOST / Offline status (no local translation tracks)
  const hasLocalData = entry.languages && Object.keys(entry.languages).length > 0;
  if (!hasLocalData) {
    getEl("suttaNotFoundCard").style.display = "flex";
    getEl("suttaViewActive").style.display = "none";
    getEl("langToggleBtn").style.display = "none";
    
    const subtitle = entry.title ? `(${entry.title})` : "";
    getEl("errorDescription").innerHTML = `
      <div style="margin-bottom: 12px; font-weight:700;">Discourse Offline</div>
      <div style="font-size:0.9rem; margin-bottom: 16px;">Sutta <strong>${suttaId}</strong> ${subtitle} has not been downloaded locally.</div>
      ${entry.video_id ? `
        <div style="background:var(--bg-page); border:1px solid var(--border-color); padding:16px; border-radius:12px; text-align:left; max-width:440px; margin:auto; display:flex; flex-direction:column; gap:8px;">
          <strong style="color:var(--color-primary); font-size:0.85rem;">YouTube Video Available:</strong>
          <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius:8px; border:1px solid var(--border-color); background:#000;">
            <iframe src="https://www.youtube.com/embed/${entry.video_id}" style="position: absolute; top:0; left:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
          </div>
          <div style="font-size:0.8rem; text-align:center;">
            <a href="https://youtube.com/watch?v=${entry.video_id}" target="_blank" style="color:#60a5fa; text-decoration:underline;">Watch directly on YouTube</a>
          </div>
        </div>
      ` : `<div style="font-size:0.8rem; color:var(--text-muted);">No YouTube video links are mapped for this offline record.</div>`}
    `;
    
    // Reset Accordion contents
    getEl("suttaProse").innerHTML = "Sutta discourse is offline.";
    getEl("commentaryProse").innerHTML = "Commentary is offline.";
    getEl("treeVisualization").innerHTML = "Nodes not parsed.";
    getEl("practiceQuizCard").innerHTML = "Quiz questions not compiled.";
    
    const scUrl = entry.sc_url || "";
    getEl("suttaCentralMeta").innerHTML = scUrl ? `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <p style="font-size:0.9rem; color:var(--text-muted);">Access parallel translations, grammar tools, and Pali notes on SuttaCentral:</p>
        <a href="${scUrl}" target="_blank" class="go-back-btn" style="text-align:center; display:block; text-decoration:none;">Open on SuttaCentral ↗</a>
      </div>
    ` : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] SuttaCentral link not found in json.</div>`;
    
    getEl<HTMLImageElement>("leafImg").src = "";
    getEl<HTMLIFrameElement>("youtubePlayer").style.display = "none";
    getEl<HTMLVideoElement>("localVideoPlayer").style.display = "none";
    return;
  }
  
  updateLanguageButtonStyles();
  
  // Load data
  getEl("suttaNotFoundCard").style.display = "none";
  getEl("homeViewPane").style.display = "none";
  getEl("suttaViewActive").style.display = "flex";
  
  try {
    const candidateUrls: string[] = [];
    const nikFolder = appRegistry!.config.nikaya_folders[entry.nikaya.toLowerCase()] || "";
    const langSub = (currentLanguage === "ja" || currentLanguage === "jp") ? "/jp" : "";
    
    if (entry.languages && entry.languages[currentLanguage]) {
      let rawP = entry.languages[currentLanguage].replace(/\\/g, "/");
      if (rawP.startsWith("frontendoptimised2/")) {
        rawP = rawP.substring("frontendoptimised2/".length);
      }
      if (!rawP.startsWith("/")) rawP = "/" + rawP;
      candidateUrls.push(rawP);
      candidateUrls.push(rawP.substring(1));
      candidateUrls.push("../" + rawP.substring(1));
    }
    
    if (nikFolder && entry.folder) {
      candidateUrls.push(`/${nikFolder}/${entry.folder}${langSub}/${entry.folder}.json`);
      candidateUrls.push(`/downloads/${nikFolder}/${entry.folder}${langSub}/${entry.folder}.json`);
      candidateUrls.push(`downloads/${nikFolder}/${entry.folder}${langSub}/${entry.folder}.json`);
    }
    
    let details: SuttaDetail | null = null;
    let lastErr = "";
    for (const urlCandidate of candidateUrls) {
      try {
        const response = await fetch(urlCandidate + `?t=${Date.now()}`, { cache: "no-store" });
        if (response.ok) {
          details = await response.json() as SuttaDetail;
          break;
        } else {
          lastErr = `HTTP ${response.status} from ${urlCandidate}`;
        }
      } catch (e: any) {
        lastErr = e.message;
      }
    }
    
    if (!details) {
      if (currentLanguage === "ja" || currentLanguage === "jp") {
        details = {
          sutta_id: suttaId,
          sutta_name: `${entry.title || suttaId} (日本語)`,
          sutta: "[!] まだ日本語訳が生成されていません。「✦ RERUN GEMINI」をクリックして日本語コンテンツを生成してください。",
          commentary: "[!] 日本語の解説はまだありません。",
          transcript: "[!] 日本語の文字起こしはまだありません。"
        };
      } else {
        throw new Error(`Failed to fetch sutta data file (${lastErr}).`);
      }
    }

    
    renderSuttaUI(details, entry);
  } catch (err: any) {
    console.error(err);
    getEl("suttaNotFoundCard").style.display = "flex";
    getEl("suttaViewActive").style.display = "none";
    getEl("errorDescription").innerText = `Error loading Sutta details: ${err.message}`;
  }
}

function switchLanguage(lang: string) {
  currentLanguage = lang;
  updateLanguageButtonStyles();
  if (selectedSuttaId) {
    selectSutta(selectedSuttaId);
  }
}
(window as any).switchLanguage = switchLanguage;

function updateLanguageButtonStyles() {
  const enBtn = getEl("langEnBtn");
  const jpBtn = getEl("langJpBtn");
  if (enBtn && jpBtn) {
    if (currentLanguage === "ja" || currentLanguage === "jp") {
      jpBtn.style.background = "var(--color-primary)";
      jpBtn.style.color = "#fff";
      enBtn.style.background = "var(--bg-card)";
      enBtn.style.color = "var(--text-main)";
    } else {
      enBtn.style.background = "var(--color-primary)";
      enBtn.style.color = "#fff";
      jpBtn.style.background = "var(--bg-card)";
      jpBtn.style.color = "var(--text-main)";
    }
  }
}

// Inline Dev Admin Toolbar Renderer
function renderAdminToolbar(containerId: string, fieldKey: string, options: { canEdit?: boolean; canRerun?: boolean; canUpload?: string; canClone?: boolean }, currentValueGetter?: () => string) {
  const container = getEl(containerId);
  
  // Remove existing admin toolbar if present
  const oldTb = container.querySelector(".admin-toolbar");
  if (oldTb) oldTb.remove();
  
  const tb = document.createElement("div");
  tb.className = "admin-toolbar";
  
  const statusEl = document.createElement("div");
  statusEl.className = "admin-status";
  
  // Edit & Save button
  if (options.canEdit) {
    const editBtn = document.createElement("button");
    editBtn.className = "admin-btn primary";
    editBtn.innerText = "✎ EDIT";
    
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "admin-btn";
    cancelBtn.innerText = "❌ CANCEL";
    cancelBtn.style.display = "none";
    
    let isEditing = false;
    let textAreaEl: HTMLTextAreaElement | null = null;
    let originalHtml = "";
    
    cancelBtn.onclick = () => {
      if (isEditing) {
        isEditing = false;
        editBtn.innerText = "✎ EDIT";
        cancelBtn.style.display = "none";
        if (textAreaEl) textAreaEl.remove();
        Array.from(container.children).forEach(child => {
          if (child !== tb) (child as HTMLElement).style.display = "";
        });
      }
    };
    
    editBtn.onclick = async () => {
      if (!isEditing) {
        isEditing = true;
        editBtn.innerText = "💾 SAVE";
        cancelBtn.style.display = "inline-block";
        
        const val = currentValueGetter ? currentValueGetter() : container.innerText;
        
        Array.from(container.children).forEach(child => {
          if (child !== tb) (child as HTMLElement).style.display = "none";
        });
        
        textAreaEl = document.createElement("textarea");
        textAreaEl.className = "admin-textarea";
        textAreaEl.style.minHeight = "240px";
        textAreaEl.style.fontSize = "0.98rem";
        textAreaEl.style.lineHeight = "1.6";
        textAreaEl.style.padding = "12px";
        textAreaEl.value = val.trim();
        container.insertBefore(textAreaEl, tb);
      } else {
        if (textAreaEl && selectedSuttaId) {
          statusEl.className = "admin-status";
          statusEl.innerText = "Saving changes...";
          try {
            const newVal = textAreaEl.value;
            const res = await fetch("/api/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sutta_id: selectedSuttaId,
                lang: currentLanguage,
                field: fieldKey,
                value: newVal
              })
            });
            const data = await res.json();
            if (res.ok) {
              statusEl.className = "admin-status ok";
              statusEl.innerText = "Saved ✓";
              isEditing = false;
              editBtn.innerText = "✎ EDIT";
              cancelBtn.style.display = "none";
              setTimeout(() => selectSutta(selectedSuttaId!), 600);
            } else {
              throw new Error(data.error || "Save failed");
            }
          } catch (err: any) {
            statusEl.className = "admin-status err";
            statusEl.innerText = `Error ✗: ${err.message}`;
          }
        }
      }
    };
    tb.appendChild(editBtn);
    tb.appendChild(cancelBtn);
  }
  
  // Rerun Gemini Button
  if (options.canRerun) {
    const rerunBtn = document.createElement("button");
    rerunBtn.className = "admin-btn";
    rerunBtn.innerText = "✦ RERUN GEMINI";
    
    let isPromptOpen = false;
    let promptAreaEl: HTMLTextAreaElement | null = null;
    let runActionBtn: HTMLButtonElement | null = null;
    
    rerunBtn.onclick = () => {
      if (!isPromptOpen) {
        isPromptOpen = true;
        const defaultPrompt = promptsMap[fieldKey] || `Generate updated ${fieldKey} for sutta {sid}.\n\nTranscript: {transcript}`;
        
        promptAreaEl = document.createElement("textarea");
        promptAreaEl.className = "admin-textarea";
        promptAreaEl.value = defaultPrompt;
        
        runActionBtn = document.createElement("button");
        runActionBtn.className = "admin-btn primary";
        runActionBtn.style.marginTop = "6px";
        runActionBtn.innerText = "🚀 EXECUTE RERUN";
        
        runActionBtn.onclick = async () => {
          if (!selectedSuttaId) return;
          statusEl.className = "admin-status";
          statusEl.innerText = "Executing Gemini rerun pipeline...";
          try {
            const res = await fetch("/api/rerun", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sutta_id: selectedSuttaId,
                lang: currentLanguage,
                field: fieldKey,
                prompt: promptAreaEl!.value
              })
            });
            const data = await res.json();
            if (res.ok) {
              statusEl.className = "admin-status ok";
              statusEl.innerText = "Rerun Complete ✓";
              setTimeout(() => selectSutta(selectedSuttaId!), 1000);
            } else {
              throw new Error(data.error || "Rerun failed");
            }
          } catch (err: any) {
            statusEl.className = "admin-status err";
            statusEl.innerText = `Error ✗: ${err.message}`;
          }
        };
        
        tb.appendChild(promptAreaEl);
        tb.appendChild(runActionBtn);
      }
    };
    tb.appendChild(rerunBtn);
  }
  
  // Upload Zone
  if (options.canUpload) {
    const uploadBtn = document.createElement("button");
    uploadBtn.className = "admin-btn";
    uploadBtn.innerText = `⬆ UPLOAD (${options.canUpload.toUpperCase()})`;
    
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.style.display = "none";
    fileInput.accept = options.canUpload === "png" ? ".png,.jpg,.jpeg,.webp" : ".mp4,.mp3,.m4a";
    
    uploadBtn.onclick = () => fileInput.click();
    
    fileInput.onchange = async () => {
      if (fileInput.files && fileInput.files[0] && selectedSuttaId) {
        const file = fileInput.files[0];
        statusEl.className = "admin-status";
        statusEl.innerText = `Uploading ${file.name}...`;
        
        const reader = new FileReader();
        reader.onload = async () => {
          const b64 = (reader.result as string).split(",")[1];
          try {
            const res = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sutta_id: selectedSuttaId,
                field: fieldKey,
                filename: file.name,
                content_base64: b64
              })
            });
            const data = await res.json();
            if (res.ok) {
              statusEl.className = "admin-status ok";
              statusEl.innerText = "Uploaded ✓ Reloading...";
              setTimeout(() => selectSutta(selectedSuttaId!), 1000);
            } else {
              throw new Error(data.error || "Upload failed");
            }
          } catch (err: any) {
            statusEl.className = "admin-status err";
            statusEl.innerText = `Upload Error ✗: ${err.message}`;
          }
        };
        reader.readAsDataURL(file);
      }
    };
    
    tb.appendChild(uploadBtn);
    tb.appendChild(fileInput);
  }
  
  // Voice Clone Dropdown (AUDIO)
  if (options.canClone) {
    const langSelect = document.createElement("select");
    langSelect.className = "admin-btn";
    langSelect.innerHTML = `
      <option value="jp">🇯🇵 Japanese (JP)</option>
      <option value="hi">🇮🇳 Hindi (HI)</option>
      <option value="de">🇩🇪 German (DE)</option>
      <option value="sw">🇰🇪 Swahili (SW)</option>
    `;
    
    const cloneBtn = document.createElement("button");
    cloneBtn.className = "admin-btn primary";
    cloneBtn.innerText = "🎙️ CLONE VOICE";
    
    cloneBtn.onclick = async () => {
      if (!selectedSuttaId) return;
      const targetLang = langSelect.value;
      statusEl.className = "admin-status";
      statusEl.innerText = `Cloning track for ${targetLang.toUpperCase()}...`;
      try {
        const res = await fetch("/api/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sutta_id: selectedSuttaId,
            target_lang: targetLang
          })
        });
        const data = await res.json();
        if (res.ok) {
          statusEl.className = "admin-status ok";
          statusEl.innerText = `Cloned ${targetLang.toUpperCase()} ✓`;
          setTimeout(() => selectSutta(selectedSuttaId!), 1000);
        } else {
          throw new Error(data.error || "Cloning failed");
        }
      } catch (err: any) {
        statusEl.className = "admin-status err";
        statusEl.innerText = `Clone Error ✗: ${err.message}`;
      }
    };
    
    tb.appendChild(langSelect);
    tb.appendChild(cloneBtn);
  }
  
  tb.appendChild(statusEl);
  container.appendChild(tb);
}

// Populate the content panels
function renderSuttaUI(details: SuttaDetail, entry: SuttaEntry) {
  getEl("suttaTitle").innerText = details.sutta_name || details.names?.official || details.sutta_id;
  
  // 1. Setup VISUAL Image
  const leafImg = getEl<HTMLImageElement>("leafImg");
  const visualCard = getEl("illustrationCard");
  const nikFolder = appRegistry!.config.nikaya_folders[entry.nikaya];
  
  const existingErr = visualCard.querySelector(".no-img-msg");
  if (existingErr) existingErr.remove();
  
  let heroUrl = (details && details.image_url) ? details.image_url.trim() : "";
  if (!heroUrl && entry.folder) {
    heroUrl = `../${nikFolder}/${entry.folder}/${entry.folder}_image.png`;
  }
  
  if (heroUrl) {
    if (heroUrl.startsWith("/")) heroUrl = ".." + heroUrl;
    else if (!heroUrl.startsWith("..") && !heroUrl.startsWith("http")) heroUrl = "../" + heroUrl;
    
    const cacheBuster = `?t=${Date.now()}`;
    leafImg.style.display = "block";
    leafImg.src = heroUrl.startsWith("http") ? heroUrl : (heroUrl + cacheBuster);
    leafImg.onerror = () => {
      leafImg.style.display = "none";
      if (!visualCard.querySelector(".no-img-msg")) {
        const noImg = document.createElement("div");
        noImg.className = "no-img-msg";
        noImg.style.color = "var(--text-muted)";
        noImg.style.fontSize = "0.85rem";
        noImg.style.padding = "12px";
        noImg.innerText = "[!] Visual illustration image file not found on disk.";
        visualCard.appendChild(noImg);
      }
    };
  } else {
    leafImg.style.display = "none";
    if (!visualCard.querySelector(".no-img-msg")) {
      const noImg = document.createElement("div");
      noImg.className = "no-img-msg";
      noImg.style.color = "var(--text-muted)";
      noImg.style.fontSize = "0.85rem";
      noImg.style.padding = "12px";
      noImg.innerText = "[!] Visual illustration image not found in json.";
      visualCard.appendChild(noImg);
    }
  }
  
  renderAdminToolbar("accordion-visual", "image", { canUpload: "png", canRerun: true });
  
  // 2. Setup AUDIO Panel
  const ytPlayer = getEl<HTMLIFrameElement>("youtubePlayer");
  const localPlayer = getEl<HTMLVideoElement>("localVideoPlayer");
  
  ytPlayer.style.display = "none";
  localPlayer.style.display = "none";
  ytPlayer.src = "";
  localPlayer.src = "";
  
  let primaryAudio = "";
  if (currentLanguage === "ja" || currentLanguage === "jp") {
    primaryAudio = `../${nikFolder}/${entry.folder}/jp/clonetest.mp4`;
  } else if (details.aud_file) {
    primaryAudio = `../${nikFolder}/${entry.folder}/${details.aud_file}`;
  }
  
  if (primaryAudio) {
    localPlayer.src = primaryAudio + `?t=${Date.now()}`;
    localPlayer.style.display = "block";
    localPlayer.onerror = () => {
      if (details.aud_file && primaryAudio.includes("/jp/")) {
        localPlayer.src = `../${nikFolder}/${entry.folder}/${details.aud_file}?t=${Date.now()}`;
      } else if (entry.video_id) {
        localPlayer.style.display = "none";
        ytPlayer.src = `https://www.youtube.com/embed/${entry.video_id}`;
        ytPlayer.style.display = "block";
      } else {
        localPlayer.style.display = "none";
      }
    };
  } else if (entry.video_id) {
    ytPlayer.src = `https://www.youtube.com/embed/${entry.video_id}`;
    ytPlayer.style.display = "block";
  }
  
  renderAdminToolbar("accordion-audio", "audio", { canUpload: "mp4", canClone: true });
  
  // 3. SUTTA Panel
  getEl("suttaProse").innerHTML = details.sutta 
    ? `<p>${details.sutta}</p>`
    : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Sutta script translation not found in json.</div>`;
    
  renderAdminToolbar("accordion-sutta", "sutta", { canEdit: true, canRerun: true }, () => details.sutta || "");
  
  // 3b. TRANSCRIPT Panel
  getEl("transcriptProse").innerText = details.transcript 
    ? details.transcript 
    : "[!] Raw transcript text not found in json.";
    
  renderAdminToolbar("accordion-transcript", "transcript", { canEdit: true, canRerun: true }, () => details.transcript || "");
  
  // 4. COMMENTARY Panel
  const commentaryHtml = details.commentary 
    ? details.commentary.split("\n")
        .filter(p => p.trim())
        .map(p => `<p style="margin-bottom:8px;">${p}</p>`)
        .join("")
    : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Commentary text not found in json.</div>`;
  getEl("commentaryProse").innerHTML = commentaryHtml;
  
  renderAdminToolbar("accordion-commentary", "commentary", { canEdit: true, canRerun: true }, () => details.commentary || "");
  
  // 5. TREE Panel
  const treeContainer = getEl("treeVisualization");
  const treeRoot = transformKnowledgeGraph(details);
  if (treeRoot && treeRoot.children && treeRoot.children.length > 0) {
    treeContainer.innerHTML = renderTreeNodes(treeRoot, true);
  } else {
    treeContainer.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Concept teaching structure not found in json.</div>`;
  }
  
  renderAdminToolbar("accordion-tree", "knowledge_graph", { canRerun: true });
  
  // 6. PRACTICE Panel (Quiz Card)
  const practiceContainer = getEl("practiceQuizCard");
  practiceContainer.innerHTML = "";
  
  let quizData: SuttaQuiz | null = null;
  if (typeof (details.quiz as any) === "string") {
    try {
      quizData = JSON.parse(details.quiz as any);
    } catch (e) {
      quizData = null;
    }
  } else {
    quizData = details.quiz || null;
  }
  
  if (quizData && Array.isArray(quizData.options) && quizData.options.length > 0) {
    const quizDiv = document.createElement("div");
    quizDiv.style.display = "flex";
    quizDiv.style.flexDirection = "column";
    quizDiv.style.gap = "16px";
    
    quizDiv.innerHTML = `<div style="font-family:'Playfair Display', serif; font-size:1.15rem; font-style:italic; font-weight:600; line-height:1.4;">${quizData.quote}</div>`;
    
    const optionsDiv = document.createElement("div");
    optionsDiv.style.display = "flex";
    optionsDiv.style.flexDirection = "column";
    optionsDiv.style.gap = "10px";
    
    let goldId = quizData.goldOptionId ? String(quizData.goldOptionId).trim() : "";
    if (!goldId && quizData.options && quizData.options.length > 0) {
      const summary = (quizData.teacherSummary || "").toLowerCase();
      const matched = quizData.options.find(o => 
        (o.title && summary.includes(o.title.toLowerCase())) || 
        (o.body && summary.includes(o.body.toLowerCase().slice(0, 15)))
      );
      goldId = matched ? String(matched.id).trim() : String(quizData.options[0].id).trim();
    }

    quizData.options.forEach(opt => {
      const optBtn = document.createElement("div");
      optBtn.className = "quiz-option";
      optBtn.setAttribute("data-id", String(opt.id).trim());
      optBtn.innerHTML = `
        <div style="font-weight:600; font-size:0.9rem;">${opt.title}</div>
        ${opt.body ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${opt.body}</div>` : ""}
      `;
      
      optBtn.onclick = () => {
        const isCorrect = (String(opt.id).trim() === goldId);
        practiceContainer.querySelectorAll(".quiz-option").forEach(el => {
          (el as HTMLElement).style.pointerEvents = "none";
        });
        
        if (isCorrect) {
          optBtn.setAttribute("style", "background: #d1fae5 !important; border: 2px solid #10b981 !important; color: #065f46 !important; font-weight: 700 !important; box-shadow: 0 0 10px rgba(16,185,129,0.3) !important; padding: 12px 16px; border-radius: 8px; cursor: pointer;");
        } else {
          optBtn.setAttribute("style", "background: #fee2e2 !important; border: 2px solid #ef4444 !important; color: #991b1b !important; font-weight: 700 !important; box-shadow: 0 0 10px rgba(239,68,68,0.3) !important; padding: 12px 16px; border-radius: 8px; cursor: pointer;");
          
          const goldBtn = practiceContainer.querySelector(`.quiz-option[data-id="${goldId}"]`) as HTMLElement;
          if (goldBtn) {
            goldBtn.setAttribute("style", "background: #d1fae5 !important; border: 2px solid #10b981 !important; color: #065f46 !important; font-weight: 700 !important; box-shadow: 0 0 10px rgba(16,185,129,0.3) !important; padding: 12px 16px; border-radius: 8px; cursor: pointer;");
          }
        }
        
        if (quizData!.teacherSummary) {
          const exp = practiceContainer.querySelector("#quizExplanation") as HTMLElement;
          if (exp) {
            exp.innerHTML = `<strong>Dhamma Summary:</strong> ${quizData!.teacherSummary}`;
            exp.style.display = "block";
          }
        }
      };
      optionsDiv.appendChild(optBtn);
    });
    
    quizDiv.appendChild(optionsDiv);
    quizDiv.innerHTML += `<div id="quizExplanation" style="display:none; padding:12px; background:rgba(245,158,11,0.05); border-left:3px solid var(--color-primary); font-size:0.85rem; border-radius:4px; margin-top:8px;"></div>`;
    practiceContainer.appendChild(quizDiv);
  } else {
    practiceContainer.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Quiz MCQ questions not found in json.</div>`;
  }
  
  renderAdminToolbar("accordion-practice", "quiz", { canEdit: true, canRerun: true }, () => JSON.stringify(details.quiz || {}, null, 2));
  
  // 7. SUTTACENTRAL Panel
  const scUrl = details.sc_url || (details as any).sutta_central_link || entry.sc_url || "";
  getEl("suttaCentralMeta").innerHTML = scUrl ? `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <p style="font-size:0.9rem; color:var(--text-muted);">Access parallel translations, grammar tools, and Pali notes on SuttaCentral:</p>
      <a href="${scUrl}" target="_blank" class="go-back-btn" style="text-align:center; display:block; text-decoration:none;">Open on SuttaCentral ↗</a>
    </div>
  ` : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] SuttaCentral link not found in json.</div>`;
  
  renderAdminToolbar("accordion-suttacentral", "sc_url", { canEdit: true }, () => scUrl);
  
  // 8. REFLECT Panel (Sutta Chatbot)
  renderSuttaChatUI();
  
  // Sync Quiz/Metrics in the main Content Pane (right panel)
  const quizContainer = getEl("quizContainer");
  quizContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <h3 style="font-family:'Playfair Display', serif; font-size:1.4rem; font-weight:600; color:var(--color-primary);">Discourse Summary & Analytics</h3>
      <p style="font-size:0.95rem; line-height:1.6; color:var(--text-muted);">
        You are currently exploring <strong>${details.sutta_id}</strong> (${details.sutta_name || entry.title || "Untitled"}). 
        Use the collapsible tabs in the left sidebar column to examine the audio recording, translation texts, conceptual nodes structure, and reflective Q&A chatbot interface.
      </p>
    </div>
  `;
  
  openAccordion("visual");
  openAccordion("audio");
  openAccordion("sutta");
  openAccordion("commentary");
  openAccordion("tree");
  openAccordion("practice");
  openAccordion("suttacentral");
  openAccordion("reflect");
}

// Native Sutta-Level Chatbot UI Renderer (REFLECT Panel)
function renderSuttaChatUI() {
  const container = getEl("accordion-reflect").querySelector(".accordion-content")!;
  container.innerHTML = `
    <div class="chat-container">
      <div class="chat-messages" id="suttaChatMessages">
        <div class="chat-bubble bot">
           🙏 Welcome! Ask me anything about <strong>${selectedSuttaId}</strong> and its teachings.
        </div>
      </div>
      <div class="chat-input-bar">
        <input type="text" class="chat-input" id="suttaChatInput" placeholder="Ask about this sutta..." onkeypress="if(event.key==='Enter') sendSuttaChatMessage()">
        <button class="admin-btn primary" onclick="sendSuttaChatMessage()">Send</button>
      </div>
    </div>
  `;
}

async function sendSuttaChatMessage() {
  const inputEl = getEl<HTMLInputElement>("suttaChatInput");
  const msgText = inputEl.value.trim();
  if (!msgText || !selectedSuttaId) return;
  
  inputEl.value = "";
  suttaChatHistory.push({ role: "user", content: msgText });
  
  const msgContainer = getEl("suttaChatMessages");
  msgContainer.innerHTML += `<div class="chat-bubble user">${msgText}</div>`;
  const botLoading = document.createElement("div");
  botLoading.className = "chat-bubble bot";
  botLoading.innerText = "Thinking...";
  msgContainer.appendChild(botLoading);
  msgContainer.scrollTop = msgContainer.scrollHeight;
  
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sutta_id: selectedSuttaId, messages: suttaChatHistory })
    });
    const data = await res.json();
    if (res.ok && data.reply) {
      suttaChatHistory.push({ role: "model", content: data.reply });
      botLoading.innerHTML = data.reply.replace(/\n/g, "<br>");
    } else {
      throw new Error(data.error || "Chat failed");
    }
  } catch (err: any) {
    botLoading.innerText = `Error: ${err.message}`;
  }
  msgContainer.scrollTop = msgContainer.scrollHeight;
}
(window as any).sendSuttaChatMessage = sendSuttaChatMessage;

// Show Dedicated Home View Tab (Status Table + Home RAG Bot)
function showHomeView() {
  selectedSuttaId = null;
  getEl("suttaViewActive").style.display = "none";
  getEl("suttaNotFoundCard").style.display = "none";
  const statsPane = document.getElementById("statsViewPane");
  if (statsPane) statsPane.style.display = "none";
  const homePane = getEl("homeViewPane");
  homePane.style.display = "flex";
  getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> SUTTA DISCOURSE CATALOG & RAG ASSISTANT`;
  resetLeftPane();
  renderHomeScreen();
}
(window as any).showHomeView = showHomeView;

function showStatsView() {
  selectedSuttaId = null;
  getEl("suttaViewActive").style.display = "none";
  getEl("suttaNotFoundCard").style.display = "none";
  getEl("homeViewPane").style.display = "none";
  const statsPane = getEl("statsViewPane");
  statsPane.style.display = "flex";
  getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> SUTTA CORPUS METRICS & ML FEATURE ANALYTICS`;
  resetLeftPane();
  renderStatsScreen();
}
(window as any).showStatsView = showStatsView;

async function renderStatsScreen() {
  const statsPane = getEl("statsViewPane");
  statsPane.style.display = "flex";
  getEl("suttaNotFoundCard").style.display = "none";
  getEl("suttaViewActive").style.display = "none";
  getEl("homeViewPane").style.display = "none";
  
  if (!appRegistry) return;

  const nikayaStats: Record<string, { name: string; complete: number; raw: number; ghost: number; total: number }> = {
    "an": { name: "Anguttara Nikaya", complete: 0, raw: 0, ghost: 0, total: 0 },
    "mn": { name: "Majjhima Nikaya", complete: 0, raw: 0, ghost: 0, total: 0 },
    "sn": { name: "Samyutta Nikaya", complete: 0, raw: 0, ghost: 0, total: 0 },
    "dn": { name: "Digha Nikaya", complete: 0, raw: 0, ghost: 0, total: 0 },
    "kn": { name: "Khuddaka Nikaya", complete: 0, raw: 0, ghost: 0, total: 0 }
  };

  let totalSuttas = 0, totalComp = 0, totalRaw = 0, totalGhost = 0;
  
  const entriesList = Object.entries(appRegistry.entries).map(([id, entry]) => {
    const sid = (entry as any).sutta_id || id;
    const nik = (entry.nikaya || "").toLowerCase();
    if (nikayaStats[nik]) {
      nikayaStats[nik].total++;
      if (entry.status === "COMPLETE") nikayaStats[nik].complete++;
      else if (entry.status === "RAW") nikayaStats[nik].raw++;
      else nikayaStats[nik].ghost++;
    }
    totalSuttas++;
    if (entry.status === "COMPLETE") totalComp++;
    else if (entry.status === "RAW") totalRaw++;
    else totalGhost++;
    return { ...entry, sutta_id: sid };
  });

  const availableRate = totalSuttas > 0 ? (((totalComp + totalRaw) / totalSuttas) * 100).toFixed(1) : "0.0";

  let mlRankings: any[] = [];
  let totalFeaturesMeasured = 0;
  try {
    const mlRes = await fetch("feature_rankings.json");
    if (mlRes.ok) {
      const mlData = await mlRes.json();
      mlRankings = mlData.features || [];
      totalFeaturesMeasured = mlData.feature_count || mlRankings.length;
    } else {
      const altRes = await fetch("../test_results/ml_qc_out/feature_rankings.json");
      if (altRes.ok) {
        const mlData = await altRes.json();
        mlRankings = mlData.features || [];
        totalFeaturesMeasured = mlData.feature_count || mlRankings.length;
      }
    }
  } catch (e) {
    console.warn("Could not load feature_rankings.json:", e);
  }

  const heroCardsHtml = `
    <div class="stats-grid">
      <div class="stat-hero-card">
        <div class="stat-card-title">Corpus Universe</div>
        <div class="stat-card-value">${totalSuttas}</div>
        <div class="stat-card-subtitle">
          <span style="color:#10b981; font-weight:700;">🟢 ${totalComp} Complete</span> · 
          <span style="color:var(--color-primary); font-weight:600;">🟡 ${totalRaw} Raw</span>
        </div>
        <div class="stat-progress-bar">
          <div class="stat-progress-fill" style="width: ${availableRate}%;"></div>
        </div>
      </div>

      <div class="stat-hero-card">
        <div class="stat-card-title">Availability Rate</div>
        <div class="stat-card-value">${availableRate}%</div>
        <div class="stat-card-subtitle">${totalComp + totalRaw} Suttas Compiled & Ready</div>
        <div class="stat-progress-bar">
          <div class="stat-progress-fill" style="width: ${availableRate}%;"></div>
        </div>
      </div>

      <div class="stat-hero-card">
        <div class="stat-card-title">ML Quality Features</div>
        <div class="stat-card-value">${totalFeaturesMeasured}</div>
        <div class="stat-card-subtitle">Extracted Text & Graph Metrics</div>
        <div class="stat-progress-bar">
          <div class="stat-progress-fill" style="width: 100%;"></div>
        </div>
      </div>

      <div class="stat-hero-card">
        <div class="stat-card-title">Nikayas Indexed</div>
        <div class="stat-card-value">5</div>
        <div class="stat-card-subtitle">AN, MN, SN, DN, KN Collections</div>
        <div class="stat-progress-bar">
          <div class="stat-progress-fill" style="width: 100%;"></div>
        </div>
      </div>
    </div>
  `;

  const nikayaRowsHtml = Object.keys(nikayaStats).map(nik => {
    const s = nikayaStats[nik];
    const pct = s.total > 0 ? (((s.complete + s.raw) / s.total) * 100).toFixed(1) : "0.0";
    return `
      <tr>
        <td><strong>${s.name} (${nik.toUpperCase()})</strong></td>
        <td style="color:#10b981; font-weight:700;">${s.complete}</td>
        <td style="color:var(--color-primary); font-weight:600;">${s.raw}</td>
        <td style="color:var(--text-muted);">${s.ghost}</td>
        <td><strong>${s.total}</strong></td>
        <td style="width: 180px;">
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:2px;">
            <span>${pct}% Available</span>
          </div>
          <div class="stat-progress-bar">
            <div class="stat-progress-fill" style="width: ${pct}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  (window as any).allMlRankings = mlRankings;
  const renderMlRows = (items: any[]) => {
    if (!items || items.length === 0) {
      return `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:16px;">No ML feature rankings loaded. Run measures.r to populate measurements.</td></tr>`;
    }
    const maxScore = Math.max(...items.map(f => f.exploration_score || 0), 0.0001);

    return items.map(f => {
      const scorePct = Math.min(100, Math.max(4, ((f.exploration_score || 0) / maxScore) * 100)).toFixed(1);
      let badgeBg = "#fef3c7", badgeColor = "#92400e", badgeBorder = "#f59e0b";
      if (f.rank === 1) { badgeBg = "#fef3c7"; badgeColor = "#b45309"; badgeBorder = "#f59e0b"; }
      else if (f.rank === 2) { badgeBg = "#d1fae5"; badgeColor = "#065f46"; badgeBorder = "#10b981"; }
      else if (f.rank === 3) { badgeBg = "#dbeafe"; badgeColor = "#1e40af"; badgeBorder = "#3b82f6"; }

      const minV = f.min || 0;
      const maxV = f.max || 0;
      const rangeSpan = (maxV - minV) || 1;
      const medPct = Math.min(100, Math.max(0, (((f.median !== undefined ? f.median : f.p50) || 0) - minV) / rangeSpan * 100)).toFixed(1);

      return `
        <tr>
          <td><span class="badge-rank" style="background:${badgeBg}; color:${badgeColor}; border-color:${badgeBorder};">#${f.rank}</span></td>
          <td>
            <code style="font-family:monospace; font-weight:700; color:var(--text-main); font-size:0.85rem;">${f.feature}</code>
          </td>
          <td style="min-width:140px;">
            <div style="display:flex; flex-direction:column; gap:3px;">
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:700; color:var(--color-primary);">
                <span>${(f.exploration_score || 0).toFixed(4)}</span>
                <span style="font-size:0.7rem; color:var(--text-muted);">${scorePct}%</span>
              </div>
              <div class="stat-progress-bar" style="height:6px;">
                <div class="stat-progress-fill" style="width: ${scorePct}%;"></div>
              </div>
            </div>
          </td>
          <td style="font-weight:600;">${(f.mean || 0).toFixed(2)}</td>
          <td style="color:#10b981; font-weight:700;">${(f.median !== undefined ? f.median : (f.p50 || 0)).toFixed(2)}</td>
          <td style="color:var(--text-muted);">${(f.std || 0).toFixed(2)}</td>
          <td style="min-width: 140px;">
            <div style="font-size:0.75rem; display:flex; justify-content:space-between; color:var(--text-muted); margin-bottom:2px;">
              <span>${minV.toFixed(1)}</span>
              <span style="font-weight:700; color:var(--text-main);">${maxV.toFixed(1)}</span>
            </div>
            <div style="position:relative; width:100%; height:6px; background:var(--bg-hover); border-radius:3px; overflow:visible;">
              <div style="position:absolute; left:0; width:100%; height:100%; background:linear-gradient(90deg, rgba(245,158,11,0.2), rgba(16,185,129,0.3)); border-radius:3px;"></div>
              <div style="position:absolute; left:${medPct}%; top:-2px; width:4px; height:10px; background:var(--color-primary); border-radius:2px;" title="Median: ${(f.median || 0).toFixed(2)}"></div>
            </div>
          </td>
          <td><span style="font-size:0.75rem; font-weight:600; color:var(--text-muted);">${f.n} recs</span></td>
        </tr>
      `;
    }).join("");
  };

  const activeEntries = entriesList.filter(e => e.status !== "GHOST" || (e.languages && Object.keys(e.languages).length > 0));
  const activeSuttaRowsHtml = activeEntries.map(e => `
    <tr style="cursor:pointer;" onclick="selectSutta('${e.sutta_id}')">
      <td><strong style="color:var(--color-primary);">${e.sutta_id}</strong></td>
      <td>${e.title || (e as any).sutta_name || "Untitled"}</td>
      <td>${getNikayaLabel(e.nikaya)}</td>
      <td><span style="padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; background:${e.status === 'COMPLETE' ? '#d1fae5' : '#fef3c7'}; color:${e.status === 'COMPLETE' ? '#065f46' : '#92400e'};">${e.status}</span></td>
      <td><button class="go-back-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="event.stopPropagation(); selectSutta('${e.sutta_id}');">Open ↗</button></td>
    </tr>
  `).join("");

  statsPane.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h2 style="font-family:'Playfair Display', serif; font-size:2.2rem; font-weight:700; color:var(--text-main); margin-bottom:4px;">DAMA Analytics & Quality Control (measures.r)</h2>
          <p style="font-size:0.9rem; color:var(--text-muted);">Real-time quantitative measurements, feature rankings, and visual metric distributions.</p>
        </div>
        <button class="go-back-btn" onclick="renderStatsScreen()">🔄 Refresh Stats</button>
      </div>

      ${heroCardsHtml}

      <!-- Nikaya Corpus Breakdown Table -->
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:20px; padding:24px;">
        <h3 style="font-family:'Playfair Display', serif; font-size:1.4rem; font-weight:600; color:var(--color-primary); margin-bottom:12px;">Nikaya Collection Progress</h3>
        <table class="status-table">
          <thead>
            <tr>
              <th>NIKAYA COLLECTION</th>
              <th>COMPLETE</th>
              <th>RAW</th>
              <th>GHOST</th>
              <th>TOTAL SUTTAS</th>
              <th>AVAILABILITY PROGRESS</th>
            </tr>
          </thead>
          <tbody>
            ${nikayaRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- ML Feature Rankings Table -->
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:20px; padding:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-family:'Playfair Display', serif; font-size:1.4rem; font-weight:600; color:var(--color-primary);">Feature Measurement Rankings & Quality Control (measures.r)</h3>
            <p style="font-size:0.85rem; color:var(--text-muted);">Decisiveness score, mean, median distribution bar, and min-max range metrics.</p>
          </div>
          <span style="font-size:0.8rem; font-weight:700; background:var(--bg-page); padding:6px 14px; border-radius:20px; border:1px solid var(--border-color);">${totalFeaturesMeasured} Features Measured</span>
        </div>

        <input type="text" id="mlFeatureSearchInput" class="stats-search-input" placeholder="🔍 Search feature metrics (e.g., word_count, sentence, jaccard, orphan)..." oninput="filterMlFeatures()">

        <div style="max-height: 480px; overflow-y: auto;">
          <table class="status-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>FEATURE METRIC</th>
                <th>EXPLORATION SCORE</th>
                <th>MEAN</th>
                <th>MEDIAN (P50)</th>
                <th>STD DEV</th>
                <th>MIN - MAX RANGE & MEDIAN METER</th>
                <th>SAMPLE RECS</th>
              </tr>
            </thead>
            <tbody id="mlFeatureTableBody">
              ${renderMlRows(mlRankings)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Active Suttas Inventory -->
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:20px; padding:24px;">
        <h3 style="font-family:'Playfair Display', serif; font-size:1.4rem; font-weight:600; color:var(--color-primary); margin-bottom:6px;">Active Suttas Inventory</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">Suttas with compiled JSON data and asset tracks ready for exploration.</p>
        
        <div style="max-height: 400px; overflow-y: auto;">
          <table class="status-table">
            <thead>
              <tr>
                <th>SUTTA ID</th>
                <th>SUTTA TITLE</th>
                <th>NIKAYA</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              ${activeSuttaRowsHtml.length > 0 ? activeSuttaRowsHtml : '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No active suttas found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function filterMlFeatures() {
  const inputEl = getEl<HTMLInputElement>("mlFeatureSearchInput");
  const tbody = getEl("mlFeatureTableBody");
  if (!inputEl || !tbody || !(window as any).allMlRankings) return;
  const query = inputEl.value.toLowerCase().trim();
  const filtered = ((window as any).allMlRankings as any[]).filter(f => f.feature.toLowerCase().includes(query));
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:20px;">No feature metric matching "${query}" found.</td></tr>`;
    return;
  }

  const maxScore = Math.max(...((window as any).allMlRankings as any[]).map(f => f.exploration_score || 0), 0.0001);

  tbody.innerHTML = filtered.map(f => {
    const scorePct = Math.min(100, Math.max(4, ((f.exploration_score || 0) / maxScore) * 100)).toFixed(1);
    let badgeBg = "#fef3c7", badgeColor = "#92400e", badgeBorder = "#f59e0b";
    if (f.rank === 1) { badgeBg = "#fef3c7"; badgeColor = "#b45309"; badgeBorder = "#f59e0b"; }
    else if (f.rank === 2) { badgeBg = "#d1fae5"; badgeColor = "#065f46"; badgeBorder = "#10b981"; }
    else if (f.rank === 3) { badgeBg = "#dbeafe"; badgeColor = "#1e40af"; badgeBorder = "#3b82f6"; }

    const minV = f.min || 0;
    const maxV = f.max || 0;
    const rangeSpan = (maxV - minV) || 1;
    const medPct = Math.min(100, Math.max(0, (((f.median !== undefined ? f.median : f.p50) || 0) - minV) / rangeSpan * 100)).toFixed(1);

    return `
      <tr>
        <td><span class="badge-rank" style="background:${badgeBg}; color:${badgeColor}; border-color:${badgeBorder};">#${f.rank}</span></td>
        <td>
          <code style="font-family:monospace; font-weight:700; color:var(--text-main); font-size:0.85rem;">${f.feature}</code>
        </td>
        <td style="min-width:140px;">
          <div style="display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:700; color:var(--color-primary);">
              <span>${(f.exploration_score || 0).toFixed(4)}</span>
              <span style="font-size:0.7rem; color:var(--text-muted);">${scorePct}%</span>
            </div>
            <div class="stat-progress-bar" style="height:6px;">
              <div class="stat-progress-fill" style="width: ${scorePct}%;"></div>
            </div>
          </div>
        </td>
        <td style="font-weight:600;">${(f.mean || 0).toFixed(2)}</td>
        <td style="color:#10b981; font-weight:700;">${(f.median !== undefined ? f.median : (f.p50 || 0)).toFixed(2)}</td>
        <td style="color:var(--text-muted);">${(f.std || 0).toFixed(2)}</td>
        <td style="min-width: 140px;">
          <div style="font-size:0.75rem; display:flex; justify-content:space-between; color:var(--text-muted); margin-bottom:2px;">
            <span>${minV.toFixed(1)}</span>
            <span style="font-weight:700; color:var(--text-main);">${maxV.toFixed(1)}</span>
          </div>
          <div style="position:relative; width:100%; height:6px; background:var(--bg-hover); border-radius:3px; overflow:visible;">
            <div style="position:absolute; left:0; width:100%; height:100%; background:linear-gradient(90deg, rgba(245,158,11,0.2), rgba(16,185,129,0.3)); border-radius:3px;"></div>
            <div style="position:absolute; left:${medPct}%; top:-2px; width:4px; height:10px; background:var(--color-primary); border-radius:2px;" title="Median: ${(f.median || 0).toFixed(2)}"></div>
          </div>
        </td>
        <td><span style="font-size:0.75rem; font-weight:600; color:var(--text-muted);">${f.n} recs</span></td>
      </tr>
    `;
  }).join("");
}
(window as any).renderStatsScreen = renderStatsScreen;
(window as any).filterMlFeatures = filterMlFeatures;

// Render Home Screen View (Project Status Table + Home RAG Bot inside homeViewPane)
function renderHomeScreen() {
  const homePane = getEl("homeViewPane");
  homePane.style.display = "flex";
  getEl("suttaNotFoundCard").style.display = "none";
  getEl("suttaViewActive").style.display = "none";
  
  if (!appRegistry) return;
  
  // Calculate per-Nikaya status stats
  const stats: Record<string, { complete: number; raw: number; ghost: number; total: number }> = {
    "an": { complete: 0, raw: 0, ghost: 0, total: 0 },
    "mn": { complete: 0, raw: 0, ghost: 0, total: 0 },
    "sn": { complete: 0, raw: 0, ghost: 0, total: 0 },
    "dn": { complete: 0, raw: 0, ghost: 0, total: 0 },
    "kn": { complete: 0, raw: 0, ghost: 0, total: 0 }
  };
  
  Object.values(appRegistry.entries).forEach(e => {
    const nik = (e.nikaya || "").toLowerCase();
    if (stats[nik]) {
      stats[nik].total++;
      if (e.status === "COMPLETE") stats[nik].complete++;
      else if (e.status === "RAW") stats[nik].raw++;
      else stats[nik].ghost++;
    }
  });
  
  let tableRows = "";
  let totComp = 0, totRaw = 0, totGhost = 0, totTotal = 0;
  
  Object.keys(stats).forEach(nik => {
    const s = stats[nik];
    totComp += s.complete;
    totRaw += s.raw;
    totGhost += s.ghost;
    totTotal += s.total;
    
    tableRows += `
      <tr>
        <td><strong>${getNikayaLabel(nik)}</strong></td>
        <td style="color:#10b981; font-weight:700;">${s.complete}</td>
        <td style="color:var(--color-primary); font-weight:600;">${s.raw}</td>
        <td style="color:var(--text-muted);">${s.ghost}</td>
        <td><strong>${s.total}</strong></td>
      </tr>
    `;
  });
  
  // Recently Edited Suttas calculation
  const sortedEntries = Object.entries(appRegistry.entries)
    .map(([id, entry]) => ({ ...entry, sutta_id: entry.sutta_id || id }))
    .filter(e => e.status !== "GHOST" || e.last_edited_timestamp)
    .sort((a, b) => (b.last_edited_timestamp || 0) - (a.last_edited_timestamp || 0))
    .slice(0, 10);

  const formatTimeAgo = (ts?: number) => {
    if (!ts) return "Catalog Sync";
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    return new Date(ts).toLocaleDateString();
  };

  const recentRowsHtml = sortedEntries.map(e => `
    <tr style="cursor:pointer;" onclick="selectSutta('${e.sutta_id}')">
      <td><strong style="color:var(--color-primary);">${e.sutta_id}</strong></td>
      <td>${e.title || e.sutta_name || "Untitled"}</td>
      <td>${getNikayaLabel(e.nikaya)}</td>
      <td style="font-size:0.8rem; color:var(--text-muted);">${formatTimeAgo(e.last_edited_timestamp)}</td>
      <td><span style="padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; background:${e.status==='COMPLETE'?'#d1fae5':'#fef3c7'}; color:${e.status==='COMPLETE'?'#065f46':'#92400e'};">${e.status}</span></td>
      <td><button class="go-back-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="event.stopPropagation(); selectSutta('${e.sutta_id}');">Open ↗</button></td>
    </tr>
  `).join("");

  homePane.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <div>
        <h2 style="font-family:'Playfair Display', serif; font-size:2rem; font-weight:700; margin-bottom:6px; color:var(--text-main);">DAMA Sutta Universe Status</h2>
        <p style="font-size:0.9rem; color:var(--text-muted);">Overview of compiled suttas, translation tracks, and asset completeness.</p>
      </div>
      
      <!-- Status Table -->
      <table class="status-table">
        <thead>
          <tr>
            <th>NIKAYA COLLECTION</th>
            <th>COMPLETE</th>
            <th>RAW</th>
            <th>GHOST</th>
            <th>TOTAL SUTTAS</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr style="background:var(--bg-hover); font-weight:700;">
            <td>TOTAL UNIVERSE</td>
            <td style="color:#10b981;">${totComp}</td>
            <td style="color:var(--color-primary);">${totRaw}</td>
            <td style="color:var(--text-muted);">${totGhost}</td>
            <td>${totTotal}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Recently Edited Suttas Section -->
      <div style="border-top:1px solid var(--border-color); padding-top:20px;">
        <h3 style="font-family:'Playfair Display', serif; font-size:1.3rem; font-weight:600; margin-bottom:4px; color:var(--color-primary);">Recently Edited Suttas</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">Click any sutta row to open discourse text and edit panels on the left.</p>
        <table class="status-table">
          <thead>
            <tr>
              <th>SUTTA ID</th>
              <th>SUTTA NAME</th>
              <th>NIKAYA</th>
              <th>LAST EDITED</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${recentRowsHtml.length > 0 ? recentRowsHtml : '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No edited suttas recorded yet.</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <!-- Home RAG Chatbot Section -->
      <div style="border-top:1px solid var(--border-color); padding-top:20px;">
        <h3 style="font-family:'Playfair Display', serif; font-size:1.3rem; font-weight:600; margin-bottom:4px; color:var(--color-primary);">Corpus RAG Chatbot (Ollama Local Model)</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;" id="ragFilterNotice">Filter Nikaya/Book above to narrow context, or ask across the entire corpus.</p>
        
        <div class="chat-container" style="height:320px;">
          <div class="chat-messages" id="homeChatMessages">
            <div class="chat-bubble bot">
              🪷 Welcome to the DAMA Corpus Assistant. Ask questions across the Nikayas or use the header dropdowns to filter the context.
            </div>
          </div>
          <div class="chat-input-bar">
            <input type="text" class="chat-input" id="homeChatInput" placeholder="Query the Nikaya corpus..." onkeypress="if(event.key==='Enter') sendHomeChatMessage()">
            <button class="admin-btn primary" onclick="sendHomeChatMessage()">Ask Corpus</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function sendHomeChatMessage() {
  const inputEl = getEl<HTMLInputElement>("homeChatInput");
  const msgText = inputEl.value.trim();
  if (!msgText || !appRegistry) return;
  
  inputEl.value = "";
  homeChatHistory.push({ role: "user", content: msgText });
  
  const msgContainer = getEl("homeChatMessages");
  msgContainer.innerHTML += `<div class="chat-bubble user">${msgText}</div>`;
  const botLoading = document.createElement("div");
  botLoading.className = "chat-bubble bot";
  botLoading.innerText = "Querying local Ollama model...";
  msgContainer.appendChild(botLoading);
  msgContainer.scrollTop = msgContainer.scrollHeight;
  
  // Filter context based on current dropdown selections
  const nikVal = getEl<HTMLSelectElement>("nikayaSelector").value;
  const bookVal = getEl<HTMLSelectElement>("bookSelector").value;
  
  let contextItems: any[] = [];
  Object.keys(appRegistry.entries).forEach(sid => {
    const entry = appRegistry!.entries[sid];
    if (!nikVal || entry.nikaya.toLowerCase() === nikVal.toLowerCase()) {
      if (!bookVal || entry.folder === bookVal) {
        contextItems.push({ sutta_id: sid, title: entry.title, nikaya: entry.nikaya, status: entry.status });
      }
    }
  });
  
  try {
    const res = await fetch("/api/home_chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: homeChatHistory,
        context_json: contextItems,
        nikaya: nikVal,
        book: bookVal
      })
    });
    const data = await res.json();
    if (res.ok && data.reply) {
      homeChatHistory.push({ role: "model", content: data.reply });
      botLoading.innerHTML = `<em>[Model: ${data.model || "Ollama"}]</em><br>` + data.reply.replace(/\n/g, "<br>");
    } else {
      throw new Error(data.error || "Home chat failed");
    }
  } catch (err: any) {
    botLoading.innerText = `Notice: ${err.message}`;
  }
  msgContainer.scrollTop = msgContainer.scrollHeight;
}
(window as any).sendHomeChatMessage = sendHomeChatMessage;

// Open a specific Accordion panel
function openAccordion(tabId: string) {
  const activeItem = document.getElementById(`accordion-${tabId}`);
  if (activeItem) {
    activeItem.classList.add("active");
  }
}

// Toggle an Accordion panel (multi-uncollapse support)
function toggleAccordion(tabId: string) {
  const item = document.getElementById(`accordion-${tabId}`);
  if (item) {
    item.classList.toggle("active");
  }
}
(window as any).toggleAccordion = toggleAccordion;

// Reset selection back to Home
function goHome() {
  window.location.hash = "/";
}
(window as any).goHome = goHome;

// Resets left accordion panel contents to default values
function resetLeftPane() {
  getEl("illustrationCard").innerHTML = `<img id="leafImg" src="" alt="Sutta Visualization" style="max-height: 220px;">`;
  
  const ytPlayer = getEl<HTMLIFrameElement>("youtubePlayer");
  const localPlayer = getEl<HTMLVideoElement>("localVideoPlayer");
  ytPlayer.style.display = "none";
  localPlayer.style.display = "none";
  ytPlayer.src = "";
  localPlayer.src = "";
  
  getEl("suttaProse").innerHTML = "Select a sutta to view scripture text.";
  getEl("commentaryProse").innerHTML = "Select a sutta to view commentary details.";
  getEl("treeVisualization").innerHTML = "Select a sutta to view concept tree structures.";
  getEl("practiceQuizCard").innerHTML = "Select a sutta to view conceptual checks.";
  getEl("suttaCentralMeta").innerHTML = "Select a sutta to access external sources.";
}

// Toggle Dashboard visibility
function toggleDashboard() {
  const d = getEl("testDashboard");
  d.style.display = (d.style.display === "flex") ? "none" : "flex";
}
(window as any).toggleDashboard = toggleDashboard;

// --- DYNAMIC TEST ROUTINES ---
async function runTests() {
  console.log("Running self-test suite...");
  const results: Record<number, string> = { 1: "pending", 2: "pending", 3: "pending", 4: "pending", 5: "pending" };

  const setBadge = (num: number, state: string) => {
    const badge = getEl(`test-${num}-badge`);
    badge.style.color = (state === "pass") ? "#10b981" : (state === "fail") ? "#ef4444" : "var(--text-muted)";
    badge.innerText = state.toUpperCase();
  };

  for (let i = 1; i <= 5; i++) {
    setBadge(i, "pending");
  }
  getEl("testSummaryText").innerText = "Executing test routines...";

  // Test 1: Zero Hardcoding check
  try {
    const html = document.documentElement.innerHTML;
    const isHardcoded = html.includes('"m7b47xzyHDE"') || html.includes('"LTos07bzzbk"') || html.includes('"AN 5.4.40"');
    if (!isHardcoded) {
      setBadge(1, "pass");
      results[1] = "pass";
    } else {
      setBadge(1, "fail");
      results[1] = "fail";
    }
  } catch (e) {
    setBadge(1, "fail");
    results[1] = "fail";
  }

  // Test 2: Master registry loading
  let mapData: SuttaRegistry | null = null;
  try {
    const res = await fetch("master.json", { cache: "no-cache" });
    if (res.ok) {
      mapData = await res.json() as SuttaRegistry;
      const entryKeys = mapData.entries ? Object.keys(mapData.entries) : [];
      const valid = !!(mapData.config && mapData.entries && entryKeys.length > 0);
      if (valid) {
        setBadge(2, "pass");
        results[2] = "pass";
      } else {
        setBadge(2, "fail");
        results[2] = "fail";
      }
    } else {
      setBadge(2, "fail");
      results[2] = "fail";
    }
  } catch (e) {
    setBadge(2, "fail");
    results[2] = "fail";
  }

  // Test 3: Sutta details fetch
  try {
    const entryKeys = mapData?.entries ? Object.keys(mapData.entries) : [];
    const firstKey = entryKeys.find(k => mapData!.entries[k]?.languages?.["en"]) || entryKeys[0];
    const testEntry = firstKey && mapData ? mapData.entries[firstKey] : null;
    if (testEntry && testEntry.languages && testEntry.languages["en"]) {
      const path = testEntry.languages["en"];
      const res = await fetch("../" + path);
      if (res.ok) {
        const data = await res.json() as SuttaDetail;
        if (data.sutta && data.commentary && data.knowledge_graph) {
          setBadge(3, "pass");
          results[3] = "pass";
        } else {
          setBadge(3, "fail");
          results[3] = "fail";
        }
      } else {
        setBadge(3, "fail");
        results[3] = "fail";
      }
    } else {
      setBadge(3, "fail");
      results[3] = "fail";
    }
  } catch (e) {
    setBadge(3, "fail");
    results[3] = "fail";
  }

  // Test 4: Japanese translation check
  try {
    const entryKeys = mapData?.entries ? Object.keys(mapData.entries) : [];
    const jpKey = entryKeys.find(k => mapData!.entries[k]?.languages?.["jp"]);
    const jpEntry = jpKey && mapData ? mapData.entries[jpKey] : null;
    if (jpEntry && jpEntry.languages && jpEntry.languages["jp"]) {
      const path = jpEntry.languages["jp"];
      const res = await fetch("../" + path);
      if (res.ok) {
        const data = await res.json() as SuttaDetail;
        if (data.sutta_name || data.sutta) {
          setBadge(4, "pass");
          results[4] = "pass";
        } else {
          setBadge(4, "fail");
          results[4] = "fail";
        }
      } else {
        setBadge(4, "fail");
        results[4] = "fail";
      }
    } else {
      setBadge(4, "fail");
      results[4] = "fail";
    }
  } catch (e) {
    setBadge(4, "fail");
    results[4] = "fail";
  }

  // Test 5: Style Tokens check
  try {
    const cs = getComputedStyle(document.documentElement);
    const hasBg = cs.getPropertyValue("--bg-page").trim() !== "";
    const hasBorder = cs.getPropertyValue("--border-color").trim() !== "";
    if (hasBg && hasBorder) {
      setBadge(5, "pass");
      results[5] = "pass";
    } else {
      setBadge(5, "fail");
      results[5] = "fail";
    }
  } catch (e) {
    setBadge(5, "fail");
    results[5] = "fail";
  }

  const allPassed = Object.values(results).every(r => r === "pass");
  const summaryText = getEl("testSummaryText");
  if (allPassed) {
    summaryText.style.color = "#10b981";
    summaryText.innerText = "SUCCESS: All integration tests passed.";
  } else {
    summaryText.style.color = "#ef4444";
    summaryText.innerText = "FAILURE: One or more tests failed.";
  }
}
(window as any).runTests = runTests;
