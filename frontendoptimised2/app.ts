// Types & Interfaces for Sutta Explorer

interface SuttaEntry {
  title: string;
  nikaya: string;
  folder: string;
  video_id: string;
  status: string;
  languages: Record<string, string>;
  sc_url?: string;
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

interface SuttaMCQ {
  question?: string;
  quote?: string;
  options: (string | { id: string; title: string; body: string })[];
  correct_index?: number;
  answer_index?: number;
  explanation?: string;
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
  commentary?: string;
  quiz?: SuttaQuiz;
  mcq?: SuttaMCQ[];
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

// Tree view Node structure
interface TreeNode {
  label: string;
  children?: TreeNode[];
}

// Global Application State
let appRegistry: SuttaRegistry | null = null;
let selectedSuttaId: string | null = null;
let currentLanguage: "en" | "jp" = "en";
const detailCache: Record<string, SuttaDetail> = {};

// Safe Element Retrieval Utility
function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Element with id '${id}' not found in DOM.`);
  return el;
}

// Map book numbers to clean English labels
function getBookLabel(bookFolder: string, nikaya: string): string {
  if (nikaya.toLowerCase() === "an" && bookFolder.includes("_")) {
    const bookNum = parseInt(bookFolder.split("_")[0]);
    const ordinals: Record<number, string> = {
      1: "BOOK OF ONES",
      2: "BOOK OF TWOS",
      3: "BOOK OF THREES",
      4: "BOOK OF FOURS",
      5: "BOOK OF FIVES",
      6: "BOOK OF SIXES",
      7: "BOOK OF SEVENS",
      8: "BOOK OF EIGHTS",
      9: "BOOK OF NINES",
      10: "BOOK OF TENS",
      11: "BOOK OF ELEVENS"
    };
    return ordinals[bookNum] || `BOOK ${bookNum}`;
  }
  
  const cleanFolder = bookFolder.replace(/^[0_]+/, "").trim();
  return cleanFolder ? `BOOK ${cleanFolder}` : "BOOK GENERAL";
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

// Populates Nikaya capsule selector
function initNikayaSelector() {
  const sel = getEl<HTMLSelectElement>("nikayaSelector");
  sel.innerHTML = '<option value="">NIKAYA</option>';
  
  const nikayas = new Set<string>();
  Object.values(appRegistry!.entries).forEach(entry => {
    if (entry.nikaya) {
      nikayas.add(entry.nikaya.toLowerCase());
    }
  });
  
  Array.from(nikayas).sort().forEach(nik => {
    const opt = document.createElement("option");
    opt.value = nik;
    opt.innerText = getNikayaLabel(nik);
    sel.appendChild(opt);
  });
}

// Fired when user changes Nikaya
function onNikayaChange() {
  const nikVal = getEl<HTMLSelectElement>("nikayaSelector").value;
  const bookSel = getEl<HTMLSelectElement>("bookSelector");
  const suttaSel = getEl<HTMLSelectElement>("suttaSelector");
  
  bookSel.innerHTML = '<option value="">BOOK</option>';
  suttaSel.innerHTML = '<option value="">SUTTA</option>';
  
  if (!nikVal) return;
  
  const books = new Set<string>();
  Object.values(appRegistry!.entries).forEach(entry => {
    if (entry.nikaya.toLowerCase() === nikVal && entry.folder) {
      if (nikVal === "an" && entry.folder.includes("_")) {
        books.add(entry.folder.split("_")[0]);
      } else {
        books.add(entry.folder);
      }
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
    opt.innerText = getBookLabel(book, nikVal);
    bookSel.appendChild(opt);
  });
}
(window as any).onNikayaChange = onNikayaChange;

// Fired when user changes Book
function onBookChange() {
  const nikVal = getEl<HTMLSelectElement>("nikayaSelector").value;
  const bookVal = getEl<HTMLSelectElement>("bookSelector").value;
  const suttaSel = getEl<HTMLSelectElement>("suttaSelector");
  
  suttaSel.innerHTML = '<option value="">SUTTA</option>';
  
  if (!nikVal || !bookVal) return;
  
  Object.keys(appRegistry!.entries).forEach(sid => {
    const entry = appRegistry!.entries[sid];
    if (entry.nikaya.toLowerCase() === nikVal) {
      let match = false;
      if (nikVal === "an" && entry.folder.includes("_")) {
        match = (entry.folder.split("_")[0] === bookVal);
      } else {
        match = (entry.folder === bookVal);
      }
      
      if (match) {
        const opt = document.createElement("option");
        opt.value = sid;
        opt.innerText = `${sid} - ${entry.title || "Untitled"}`;
        suttaSel.appendChild(opt);
      }
    }
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
    getEl("suttaNotFoundCard").style.display = "flex";
    getEl("suttaViewActive").style.display = "none";
    getEl("errorDescription").innerText = "Please select a sutta from the navigation dropdowns above.";
    
    getEl<HTMLSelectElement>("nikayaSelector").value = "";
    getEl<HTMLSelectElement>("bookSelector").innerHTML = '<option value="">BOOK</option>';
    getEl<HTMLSelectElement>("suttaSelector").innerHTML = '<option value="">SUTTA</option>';
    getEl("langToggleBtn").style.display = "none";
    
    getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> SUTTA DISCOURSE CATALOG EXPLORER`;
    resetLeftPane();
  }
}

// Language Switch Action
function toggleLanguage() {
  if (!selectedSuttaId || !appRegistry) return;
  currentLanguage = (currentLanguage === "en") ? "jp" : "en";
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
  
  // Find roots (nodes that are not targets of any edges, or Support nodes)
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
    
    // Show SuttaCentral link even when GHOST/offline!
    const scUrl = entry.sc_url || "";
    getEl("suttaCentralMeta").innerHTML = scUrl ? `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <p style="font-size:0.9rem; color:var(--text-muted);">Access parallel translations, grammar tools, and Pali notes on SuttaCentral:</p>
        <a href="${scUrl}" target="_blank" class="go-back-btn" style="text-align:center; display:block; text-decoration:none;">Open on SuttaCentral ↗</a>
      </div>
    ` : `<div style="color:var(--text-muted); text-align:center; font-size:0.85rem;">No SuttaCentral linkage available.</div>`;
    
    // Hide leaf image
    getEl<HTMLImageElement>("leafImg").src = "";
    
    // Hide audio elements
    getEl<HTMLIFrameElement>("youtubePlayer").style.display = "none";
    getEl<HTMLVideoElement>("localVideoPlayer").style.display = "none";
    
    return;
  }
  
  // Show / Hide language switch pill button if Japanese translation is available
  const langToggle = getEl<HTMLButtonElement>("langToggleBtn");
  if (entry.languages && entry.languages["jp"]) {
    langToggle.style.display = "block";
    langToggle.innerText = (currentLanguage === "en") ? "🇯🇵 日本語" : "🇬🇧 ENGLISH";
  } else {
    langToggle.style.display = "none";
    currentLanguage = "en"; // Default back to English if JP not supported
  }
  
  // Load data
  getEl("suttaNotFoundCard").style.display = "none";
  getEl("suttaViewActive").style.display = "flex";
  
  try {
    const langPath = entry.languages[currentLanguage] || entry.languages["en"] || Object.values(entry.languages)[0];
    if (!langPath) throw new Error("No translation track available.");
    
    let details: SuttaDetail;
    const cacheKey = `${suttaId}_${currentLanguage}`;
    
    if (detailCache[cacheKey]) {
      details = detailCache[cacheKey];
    } else {
      const response = await fetch("../" + langPath);
      if (!response.ok) throw new Error("Failed to fetch sutta data file.");
      details = await response.json() as SuttaDetail;
      detailCache[cacheKey] = details;
    }
    
    renderSuttaUI(details, entry);
  } catch (err: any) {
    console.error(err);
    getEl("suttaNotFoundCard").style.display = "flex";
    getEl("suttaViewActive").style.display = "none";
    getEl("errorDescription").innerText = `Error loading Sutta details: ${err.message}`;
  }
}

// Populate the content panels
function renderSuttaUI(details: SuttaDetail, entry: SuttaEntry) {
  getEl("suttaTitle").innerText = details.sutta_name || details.names?.official || details.sutta_id;
  
  // Setup Visual Image
  const leafImg = getEl<HTMLImageElement>("leafImg");
  let heroUrl = details.image_url || "";
  if (heroUrl) {
    heroUrl = heroUrl.replace(/(_hero)?\.(mp4|gif|webp)$/i, '.png');
    if (heroUrl.startsWith("/panels/")) {
      heroUrl = ".." + heroUrl;
    }
    leafImg.src = heroUrl;
  } else {
    // Conceptual backup
    const nikFolder = appRegistry!.config.nikaya_folders[entry.nikaya];
    leafImg.src = `../${nikFolder}/${entry.folder}/${entry.folder}_graph.png`;
  }
  
  leafImg.onerror = () => {
    leafImg.src = "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=300";
  };
  
  // Setup media players in AUDIO accordion
  const ytPlayer = getEl<HTMLIFrameElement>("youtubePlayer");
  const localPlayer = getEl<HTMLVideoElement>("localVideoPlayer");
  
  ytPlayer.style.display = "none";
  localPlayer.style.display = "none";
  ytPlayer.src = "";
  localPlayer.src = "";
  
  // Setup media players in AUDIO accordion (prioritize local file if available in folder)
  if (details.aud_file) {
    const nikFolder = appRegistry!.config.nikaya_folders[entry.nikaya];
    localPlayer.src = `../${nikFolder}/${entry.folder}/${details.aud_file}`;
    localPlayer.style.display = "block";
  } else if (entry.video_id) {
    ytPlayer.src = `https://www.youtube.com/embed/${entry.video_id}`;
    ytPlayer.style.display = "block";
  } else {
    getEl("accordion-audio").querySelector(".accordion-content")!.innerHTML = `
      <div style="color:var(--text-muted); font-size:0.85rem; padding:10px 0;">
        [!] Audio/video file not found in sutta folder.
      </div>
    `;
  }
  
  // Populate text accordions
  getEl("suttaProse").innerHTML = details.sutta 
    ? `<p>${details.sutta}</p>`
    : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Sutta script translation not found in json.</div>`;
  
  const commentaryHtml = details.commentary 
    ? details.commentary.split("\n")
        .filter(p => p.trim())
        .map(p => `<p style="margin-bottom:8px;">${p}</p>`)
        .join("")
    : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Commentary text not found in json.</div>`;
  getEl("commentaryProse").innerHTML = commentaryHtml;
  
  // SuttaCentral links panel (support details.sc_url or details.sutta_central_link or entry.sc_url)
  const scUrl = details.sc_url || (details as any).sutta_central_link || entry.sc_url || "";
  getEl("suttaCentralMeta").innerHTML = scUrl ? `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <p style="font-size:0.9rem; color:var(--text-muted);">Access parallel translations, grammar tools, and Pali notes on SuttaCentral:</p>
      <a href="${scUrl}" target="_blank" class="go-back-btn" style="text-align:center; display:block; text-decoration:none;">Open on SuttaCentral ↗</a>
    </div>
  ` : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] SuttaCentral link not found in json.</div>`;
  
  // Render tree hierarchical structure
  const treeContainer = getEl("treeVisualization");
  const treeRoot = transformKnowledgeGraph(details);
  if (treeRoot && treeRoot.children && treeRoot.children.length > 0) {
    treeContainer.innerHTML = renderTreeNodes(treeRoot, true);
  } else {
    treeContainer.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Concept teaching structure not found in json.</div>`;
  }
  
  // Render MCQ Quiz Card in practice pane
  const practiceContainer = getEl("practiceQuizCard");
  practiceContainer.innerHTML = "";
  
  let quizData: SuttaQuiz | null = null;
  if (details.quiz) {
    quizData = details.quiz;
  } else if (details.mcq && details.mcq.length > 0) {
    const first = details.mcq[0];
    quizData = {
      quote: first.question || first.quote || "",
      options: first.options.map((opt, idx) => ({
        id: String(idx + 1),
        title: typeof opt === "string" ? opt : opt.title || String(idx + 1),
        body: typeof opt === "string" ? "" : opt.body || ""
      })),
      goldOptionId: String(((first.correct_index !== undefined ? first.correct_index : first.answer_index || 0) + 1)),
      teacherSummary: first.explanation || ""
    };
  }
  
  if (quizData) {
    const quizDiv = document.createElement("div");
    quizDiv.style.display = "flex";
    quizDiv.style.flexDirection = "column";
    quizDiv.style.gap = "16px";
    
    quizDiv.innerHTML = `<div style="font-family:'Playfair Display', serif; font-size:1.15rem; font-style:italic; font-weight:600; line-height:1.4;">${quizData.quote}</div>`;
    
    const optionsDiv = document.createElement("div");
    optionsDiv.style.display = "flex";
    optionsDiv.style.flexDirection = "column";
    optionsDiv.style.gap = "10px";
    
    quizData.options.forEach(opt => {
      const optBtn = document.createElement("div");
      optBtn.className = "quiz-option";
      optBtn.setAttribute("data-id", opt.id);
      optBtn.innerHTML = `
        <div style="font-weight:600; font-size:0.9rem;">${opt.title}</div>
        ${opt.body ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${opt.body}</div>` : ""}
      `;
      
      optBtn.onclick = () => {
        const isCorrect = (opt.id === quizData!.goldOptionId);
        practiceContainer.querySelectorAll(".quiz-option").forEach(el => {
          (el as HTMLElement).style.pointerEvents = "none";
        });
        
        if (isCorrect) {
          optBtn.classList.add("correct");
        } else {
          optBtn.classList.add("incorrect");
          const goldBtn = practiceContainer.querySelector(`.quiz-option[data-id="${quizData!.goldOptionId}"]`);
          if (goldBtn) {
            goldBtn.classList.add("correct");
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
    practiceContainer.innerHTML = `<div style="color:var(--text-muted); text-align:center; font-size:0.85rem;">No conceptual quiz questions verified.</div>`;
  }
  
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
  
  // Default open the SUTTA accordion on load
  openAccordion("sutta");
}

// Open a specific Accordion panel
function openAccordion(tabId: string) {
  document.querySelectorAll(".accordion-item").forEach(item => {
    item.classList.remove("active");
  });
  const activeItem = document.getElementById(`accordion-${tabId}`);
  if (activeItem) {
    activeItem.classList.add("active");
  }
}

// Toggle an Accordion panel
function toggleAccordion(tabId: string) {
  const item = document.getElementById(`accordion-${tabId}`);
  if (item) {
    const isActive = item.classList.contains("active");
    document.querySelectorAll(".accordion-item").forEach(el => {
      el.classList.remove("active");
    });
    if (!isActive) {
      item.classList.add("active");
    }
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
      const valid = !!(mapData.config && mapData.entries && mapData.entries["AN 5.4.40"] && mapData.entries["MN 1"]);
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

  // Test 3: Sutta details fetch (AN 5.4.40)
  try {
    if (mapData && mapData.entries["AN 5.4.40"]) {
      const path = mapData.entries["AN 5.4.40"].languages["en"];
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
    if (mapData && mapData.entries["AN 5.4.40"] && mapData.entries["AN 5.4.40"].languages["jp"]) {
      const path = mapData.entries["AN 5.4.40"].languages["jp"];
      const res = await fetch("../" + path);
      if (res.ok) {
        const data = await res.json() as SuttaDetail;
        if (data.sutta_name && data.sutta_name.includes("サーランダナ")) {
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
