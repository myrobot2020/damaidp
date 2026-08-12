"use strict";
let appRegistry = null;
let selectedSuttaId = null;
let currentLanguage = "en";
const detailCache = {};
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`Element with id '${id}' not found in DOM.`);
    return el;
}
function getBookLabel(bookFolder, nikaya) {
    if (nikaya.toLowerCase() === "an" && bookFolder.includes("_")) {
        const bookNum = parseInt(bookFolder.split("_")[0]);
        const ordinals = {
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
function getNikayaLabel(nik) {
    const labels = {
        "an": "Anguttara Nikaya",
        "dn": "Digha Nikaya",
        "mn": "Majjhima Nikaya",
        "sn": "Samyutta Nikaya",
        "kn": "Khuddaka Nikaya"
    };
    return labels[nik.toLowerCase()] || nik.toUpperCase();
}
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("master.json");
        if (!response.ok)
            throw new Error("Registry load failed.");
        appRegistry = await response.json();
        initNikayaSelector();
        window.addEventListener("hashchange", handleRouting);
        handleRouting();
    }
    catch (err) {
        console.error(err);
        getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> <span style="color:red;">Failed to load master registry catalog.</span>`;
    }
});
function initNikayaSelector() {
    const sel = getEl("nikayaSelector");
    sel.innerHTML = '<option value="">NIKAYA</option>';
    const nikayas = new Set();
    Object.values(appRegistry.entries).forEach(entry => {
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
function onNikayaChange() {
    const nikVal = getEl("nikayaSelector").value;
    const bookSel = getEl("bookSelector");
    const suttaSel = getEl("suttaSelector");
    bookSel.innerHTML = '<option value="">BOOK</option>';
    suttaSel.innerHTML = '<option value="">SUTTA</option>';
    if (!nikVal)
        return;
    const books = new Set();
    Object.values(appRegistry.entries).forEach(entry => {
        if (entry.nikaya.toLowerCase() === nikVal && entry.folder) {
            if (nikVal === "an" && entry.folder.includes("_")) {
                books.add(entry.folder.split("_")[0]);
            }
            else {
                books.add(entry.folder);
            }
        }
    });
    const sortedBooks = Array.from(books).sort((a, b) => {
        const na = parseInt(a);
        const nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb))
            return na - nb;
        return a.localeCompare(b);
    });
    sortedBooks.forEach(book => {
        const opt = document.createElement("option");
        opt.value = book;
        opt.innerText = getBookLabel(book, nikVal);
        bookSel.appendChild(opt);
    });
}
window.onNikayaChange = onNikayaChange;
function onBookChange() {
    const nikVal = getEl("nikayaSelector").value;
    const bookVal = getEl("bookSelector").value;
    const suttaSel = getEl("suttaSelector");
    suttaSel.innerHTML = '<option value="">SUTTA</option>';
    if (!nikVal || !bookVal)
        return;
    Object.keys(appRegistry.entries).forEach(sid => {
        const entry = appRegistry.entries[sid];
        if (entry.nikaya.toLowerCase() === nikVal) {
            let match = false;
            if (nikVal === "an" && entry.folder.includes("_")) {
                match = (entry.folder.split("_")[0] === bookVal);
            }
            else {
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
window.onBookChange = onBookChange;
function onSuttaChange() {
    const suttaVal = getEl("suttaSelector").value;
    if (suttaVal) {
        window.location.hash = `/sutta/${suttaVal}`;
    }
}
window.onSuttaChange = onSuttaChange;
function handleRouting() {
    const hash = window.location.hash || "";
    let path = window.location.pathname;
    let targetSuttaId = "";
    if (hash.startsWith("#/sutta/")) {
        targetSuttaId = decodeURIComponent(hash.substring(8));
    }
    else if (path.includes("/sutta/")) {
        const idx = path.indexOf("/sutta/");
        targetSuttaId = decodeURIComponent(path.substring(idx + 7));
    }
    if (targetSuttaId) {
        selectSutta(targetSuttaId);
    }
    else {
        selectedSuttaId = null;
        getEl("suttaNotFoundCard").style.display = "flex";
        getEl("suttaViewActive").style.display = "none";
        getEl("errorDescription").innerText = "Please select a sutta from the navigation dropdowns above.";
        getEl("nikayaSelector").value = "";
        getEl("bookSelector").innerHTML = '<option value="">BOOK</option>';
        getEl("suttaSelector").innerHTML = '<option value="">SUTTA</option>';
        getEl("langToggleBtn").style.display = "none";
        getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> SUTTA DISCOURSE CATALOG EXPLORER`;
        resetLeftPane();
    }
}
function toggleLanguage() {
    if (!selectedSuttaId || !appRegistry)
        return;
    currentLanguage = (currentLanguage === "en") ? "jp" : "en";
    selectSutta(selectedSuttaId);
}
window.toggleLanguage = toggleLanguage;
function transformKnowledgeGraph(details) {
    if (!details.knowledge_graph)
        return null;
    const kg = details.knowledge_graph;
    if (!kg.nodes || kg.nodes.length === 0)
        return null;
    const nodesMap = new Map(kg.nodes.map(n => [n.id, n]));
    const edges = kg.edges || [];
    const targetIds = new Set(edges.map(e => e.target));
    const potentialRoots = kg.nodes.filter(n => !targetIds.has(n.id) || n.type === "Support");
    const supportRoots = potentialRoots.filter(n => n.type === "Support");
    const roots = supportRoots.length > 0 ? supportRoots : potentialRoots;
    const buildTree = (nodeId) => {
        const node = nodesMap.get(nodeId);
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
function renderTreeNodes(node, isRoot = false) {
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
async function selectSutta(suttaId) {
    if (!appRegistry)
        return;
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
    const nikSel = getEl("nikayaSelector");
    nikSel.value = entry.nikaya.toLowerCase();
    onNikayaChange();
    const bookSel = getEl("bookSelector");
    if (entry.nikaya.toLowerCase() === "an" && entry.folder.includes("_")) {
        bookSel.value = entry.folder.split("_")[0];
    }
    else {
        bookSel.value = entry.folder;
    }
    onBookChange();
    const suttaSel = getEl("suttaSelector");
    suttaSel.value = suttaId;
    const nLabel = getNikayaLabel(entry.nikaya);
    const bLabel = getBookLabel(entry.folder, entry.nikaya);
    getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> ${nLabel} · ${bLabel} · ${suttaId}`;
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
    ` : `<div style="color:var(--text-muted); text-align:center; font-size:0.85rem;">No SuttaCentral linkage available.</div>`;
        getEl("leafImg").src = "";
        getEl("youtubePlayer").style.display = "none";
        getEl("localVideoPlayer").style.display = "none";
        return;
    }
    const langToggle = getEl("langToggleBtn");
    if (entry.languages && entry.languages["jp"]) {
        langToggle.style.display = "block";
        langToggle.innerText = (currentLanguage === "en") ? "🇯🇵 日本語" : "🇬🇧 ENGLISH";
    }
    else {
        langToggle.style.display = "none";
        currentLanguage = "en";
    }
    getEl("suttaNotFoundCard").style.display = "none";
    getEl("suttaViewActive").style.display = "flex";
    try {
        const langPath = entry.languages[currentLanguage] || entry.languages["en"] || Object.values(entry.languages)[0];
        if (!langPath)
            throw new Error("No translation track available.");
        let details;
        const cacheKey = `${suttaId}_${currentLanguage}`;
        if (detailCache[cacheKey]) {
            details = detailCache[cacheKey];
        }
        else {
            const response = await fetch("../" + langPath);
            if (!response.ok)
                throw new Error("Failed to fetch sutta data file.");
            details = await response.json();
            detailCache[cacheKey] = details;
        }
        renderSuttaUI(details, entry);
    }
    catch (err) {
        console.error(err);
        getEl("suttaNotFoundCard").style.display = "flex";
        getEl("suttaViewActive").style.display = "none";
        getEl("errorDescription").innerText = `Error loading Sutta details: ${err.message}`;
    }
}
function renderSuttaUI(details, entry) {
    getEl("suttaTitle").innerText = details.sutta_name || details.names?.official || details.sutta_id;
    const leafImg = getEl("leafImg");
    let heroUrl = details.image_url || "";
    if (heroUrl) {
        heroUrl = heroUrl.replace(/(_hero)?\.(mp4|gif|webp)$/i, '.png');
        if (heroUrl.startsWith("/panels/")) {
            heroUrl = ".." + heroUrl;
        }
        leafImg.src = heroUrl;
    }
    else {
        const nikFolder = appRegistry.config.nikaya_folders[entry.nikaya];
        leafImg.src = `../${nikFolder}/${entry.folder}/${entry.folder}_graph.png`;
    }
    leafImg.onerror = () => {
        leafImg.src = "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=300";
    };
    const ytPlayer = getEl("youtubePlayer");
    const localPlayer = getEl("localVideoPlayer");
    ytPlayer.style.display = "none";
    localPlayer.style.display = "none";
    ytPlayer.src = "";
    localPlayer.src = "";
    if (details.aud_file) {
        const nikFolder = appRegistry.config.nikaya_folders[entry.nikaya];
        localPlayer.src = `../${nikFolder}/${entry.folder}/${details.aud_file}`;
        localPlayer.style.display = "block";
    }
    else if (entry.video_id) {
        ytPlayer.src = `https://www.youtube.com/embed/${entry.video_id}`;
        ytPlayer.style.display = "block";
    }
    else {
        getEl("accordion-audio").querySelector(".accordion-content").innerHTML = `
      <div style="color:var(--text-muted); font-size:0.85rem; padding:10px 0;">
        [!] Audio/video file not found in sutta folder.
      </div>
    `;
    }
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
    const scUrl = details.sc_url || details.sutta_central_link || entry.sc_url || "";
    getEl("suttaCentralMeta").innerHTML = scUrl ? `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <p style="font-size:0.9rem; color:var(--text-muted);">Access parallel translations, grammar tools, and Pali notes on SuttaCentral:</p>
      <a href="${scUrl}" target="_blank" class="go-back-btn" style="text-align:center; display:block; text-decoration:none;">Open on SuttaCentral ↗</a>
    </div>
  ` : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] SuttaCentral link not found in json.</div>`;
    const treeContainer = getEl("treeVisualization");
    const treeRoot = transformKnowledgeGraph(details);
    if (treeRoot && treeRoot.children && treeRoot.children.length > 0) {
        treeContainer.innerHTML = renderTreeNodes(treeRoot, true);
    }
    else {
        treeContainer.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Concept teaching structure not found in json.</div>`;
    }
    const practiceContainer = getEl("practiceQuizCard");
    practiceContainer.innerHTML = "";
    let quizData = null;
    if (details.quiz) {
        quizData = details.quiz;
    }
    else if (details.mcq && details.mcq.length > 0) {
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
                const isCorrect = (opt.id === quizData.goldOptionId);
                practiceContainer.querySelectorAll(".quiz-option").forEach(el => {
                    el.style.pointerEvents = "none";
                });
                if (isCorrect) {
                    optBtn.classList.add("correct");
                }
                else {
                    optBtn.classList.add("incorrect");
                    const goldBtn = practiceContainer.querySelector(`.quiz-option[data-id="${quizData.goldOptionId}"]`);
                    if (goldBtn) {
                        goldBtn.classList.add("correct");
                    }
                }
                if (quizData.teacherSummary) {
                    const exp = practiceContainer.querySelector("#quizExplanation");
                    if (exp) {
                        exp.innerHTML = `<strong>Dhamma Summary:</strong> ${quizData.teacherSummary}`;
                        exp.style.display = "block";
                    }
                }
            };
            optionsDiv.appendChild(optBtn);
        });
        quizDiv.appendChild(optionsDiv);
        quizDiv.innerHTML += `<div id="quizExplanation" style="display:none; padding:12px; background:rgba(245,158,11,0.05); border-left:3px solid var(--color-primary); font-size:0.85rem; border-radius:4px; margin-top:8px;"></div>`;
        practiceContainer.appendChild(quizDiv);
    }
    else {
        practiceContainer.innerHTML = `<div style="color:var(--text-muted); text-align:center; font-size:0.85rem;">No conceptual quiz questions verified.</div>`;
    }
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
    openAccordion("sutta");
}
function openAccordion(tabId) {
    document.querySelectorAll(".accordion-item").forEach(item => {
        item.classList.remove("active");
    });
    const activeItem = document.getElementById(`accordion-${tabId}`);
    if (activeItem) {
        activeItem.classList.add("active");
    }
}
function toggleAccordion(tabId) {
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
window.toggleAccordion = toggleAccordion;
function goHome() {
    window.location.hash = "/";
}
window.goHome = goHome;
function resetLeftPane() {
    getEl("illustrationCard").innerHTML = `<img id="leafImg" src="" alt="Sutta Visualization" style="max-height: 220px;">`;
    const ytPlayer = getEl("youtubePlayer");
    const localPlayer = getEl("localVideoPlayer");
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
function toggleDashboard() {
    const d = getEl("testDashboard");
    d.style.display = (d.style.display === "flex") ? "none" : "flex";
}
window.toggleDashboard = toggleDashboard;
async function runTests() {
    console.log("Running self-test suite...");
    const results = { 1: "pending", 2: "pending", 3: "pending", 4: "pending", 5: "pending" };
    const setBadge = (num, state) => {
        const badge = getEl(`test-${num}-badge`);
        badge.style.color = (state === "pass") ? "#10b981" : (state === "fail") ? "#ef4444" : "var(--text-muted)";
        badge.innerText = state.toUpperCase();
    };
    for (let i = 1; i <= 5; i++) {
        setBadge(i, "pending");
    }
    getEl("testSummaryText").innerText = "Executing test routines...";
    try {
        const html = document.documentElement.innerHTML;
        const isHardcoded = html.includes('"m7b47xzyHDE"') || html.includes('"LTos07bzzbk"') || html.includes('"AN 5.4.40"');
        if (!isHardcoded) {
            setBadge(1, "pass");
            results[1] = "pass";
        }
        else {
            setBadge(1, "fail");
            results[1] = "fail";
        }
    }
    catch (e) {
        setBadge(1, "fail");
        results[1] = "fail";
    }
    let mapData = null;
    try {
        const res = await fetch("master.json", { cache: "no-cache" });
        if (res.ok) {
            mapData = await res.json();
            const valid = !!(mapData.config && mapData.entries && mapData.entries["AN 5.4.40"] && mapData.entries["MN 1"]);
            if (valid) {
                setBadge(2, "pass");
                results[2] = "pass";
            }
            else {
                setBadge(2, "fail");
                results[2] = "fail";
            }
        }
        else {
            setBadge(2, "fail");
            results[2] = "fail";
        }
    }
    catch (e) {
        setBadge(2, "fail");
        results[2] = "fail";
    }
    try {
        if (mapData && mapData.entries["AN 5.4.40"]) {
            const path = mapData.entries["AN 5.4.40"].languages["en"];
            const res = await fetch("../" + path);
            if (res.ok) {
                const data = await res.json();
                if (data.sutta && data.commentary && data.knowledge_graph) {
                    setBadge(3, "pass");
                    results[3] = "pass";
                }
                else {
                    setBadge(3, "fail");
                    results[3] = "fail";
                }
            }
            else {
                setBadge(3, "fail");
                results[3] = "fail";
            }
        }
        else {
            setBadge(3, "fail");
            results[3] = "fail";
        }
    }
    catch (e) {
        setBadge(3, "fail");
        results[3] = "fail";
    }
    try {
        if (mapData && mapData.entries["AN 5.4.40"] && mapData.entries["AN 5.4.40"].languages["jp"]) {
            const path = mapData.entries["AN 5.4.40"].languages["jp"];
            const res = await fetch("../" + path);
            if (res.ok) {
                const data = await res.json();
                if (data.sutta_name && data.sutta_name.includes("サーランダナ")) {
                    setBadge(4, "pass");
                    results[4] = "pass";
                }
                else {
                    setBadge(4, "fail");
                    results[4] = "fail";
                }
            }
            else {
                setBadge(4, "fail");
                results[4] = "fail";
            }
        }
        else {
            setBadge(4, "fail");
            results[4] = "fail";
        }
    }
    catch (e) {
        setBadge(4, "fail");
        results[4] = "fail";
    }
    try {
        const cs = getComputedStyle(document.documentElement);
        const hasBg = cs.getPropertyValue("--bg-page").trim() !== "";
        const hasBorder = cs.getPropertyValue("--border-color").trim() !== "";
        if (hasBg && hasBorder) {
            setBadge(5, "pass");
            results[5] = "pass";
        }
        else {
            setBadge(5, "fail");
            results[5] = "fail";
        }
    }
    catch (e) {
        setBadge(5, "fail");
        results[5] = "fail";
    }
    const allPassed = Object.values(results).every(r => r === "pass");
    const summaryText = getEl("testSummaryText");
    if (allPassed) {
        summaryText.style.color = "#10b981";
        summaryText.innerText = "SUCCESS: All integration tests passed.";
    }
    else {
        summaryText.style.color = "#ef4444";
        summaryText.innerText = "FAILURE: One or more tests failed.";
    }
}
window.runTests = runTests;
