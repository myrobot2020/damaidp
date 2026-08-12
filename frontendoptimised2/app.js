"use strict";
let appRegistry = null;
let selectedSuttaId = null;
let currentLanguage = "en";
const detailCache = {};
let promptsMap = {};
let suttaChatHistory = [];
let homeChatHistory = [];
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
        await loadPrompts();
        initNikayaSelector();
        window.addEventListener("hashchange", handleRouting);
        handleRouting();
    }
    catch (err) {
        console.error(err);
        getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> <span style="color:red;">Failed to load master registry catalog.</span>`;
    }
});
async function loadPrompts() {
    try {
        const res = await fetch("prompts.txt");
        if (!res.ok)
            return;
        const text = await res.text();
        let currentKey = "";
        let currentContent = [];
        text.split("\n").forEach(line => {
            const match = line.match(/^\[([a-zA-Z0-9_]+)\]$/);
            if (match) {
                if (currentKey) {
                    promptsMap[currentKey] = currentContent.join("\n").trim();
                }
                currentKey = match[1];
                currentContent = [];
            }
            else {
                currentContent.push(line);
            }
        });
        if (currentKey) {
            promptsMap[currentKey] = currentContent.join("\n").trim();
        }
    }
    catch (err) {
        console.warn("Prompts file loading skipped:", err);
    }
}
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
        let hasData = false;
        Object.values(appRegistry.entries).forEach(e => {
            if (e.nikaya && e.nikaya.toLowerCase() === nik && (e.status === "COMPLETE" || e.status === "RAW")) {
                hasData = true;
            }
        });
        if (hasData) {
            opt.innerText = `🟢 ${getNikayaLabel(nik)}`;
            opt.style.color = "#065f46";
            opt.style.fontWeight = "bold";
        }
        else {
            opt.innerText = `⚪ [GHOST] ${getNikayaLabel(nik)}`;
            opt.style.color = "#9ca3af";
        }
        sel.appendChild(opt);
    });
}
function onNikayaChange() {
    const nikVal = getEl("nikayaSelector").value;
    const bookSel = getEl("bookSelector");
    const suttaSel = getEl("suttaSelector");
    bookSel.innerHTML = '<option value="">BOOK</option>';
    suttaSel.innerHTML = '<option value="">SUTTA</option>';
    if (!nikVal) {
        return;
    }
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
        let hasData = false;
        Object.values(appRegistry.entries).forEach(e => {
            if (e.nikaya.toLowerCase() === nikVal && e.folder) {
                let match = false;
                if (nikVal === "an" && e.folder.includes("_")) {
                    match = (e.folder.split("_")[0] === book);
                }
                else {
                    match = (e.folder === book);
                }
                if (match && (e.status === "COMPLETE" || e.status === "RAW")) {
                    hasData = true;
                }
            }
        });
        if (hasData) {
            opt.innerText = `🟢 ${getBookLabel(book, nikVal)}`;
            opt.style.color = "#065f46";
            opt.style.fontWeight = "bold";
        }
        else {
            opt.innerText = `⚪ [GHOST] ${getBookLabel(book, nikVal)}`;
            opt.style.color = "#9ca3af";
        }
        bookSel.appendChild(opt);
    });
}
window.onNikayaChange = onNikayaChange;
function onBookChange() {
    const nikVal = getEl("nikayaSelector").value;
    const bookVal = getEl("bookSelector").value;
    const suttaSel = getEl("suttaSelector");
    suttaSel.innerHTML = '<option value="">SUTTA</option>';
    if (!nikVal || !bookVal) {
        return;
    }
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
                const status = entry.status || "GHOST";
                if (status === "COMPLETE") {
                    opt.innerText = `🟢 ${sid} - ${entry.title || "Untitled"}`;
                    opt.style.color = "#065f46";
                    opt.style.fontWeight = "bold";
                }
                else if (status === "RAW") {
                    opt.innerText = `🟡 [RAW] ${sid} - ${entry.title || "Untitled"}`;
                    opt.style.color = "#b45309";
                }
                else {
                    opt.innerText = `⚪ [GHOST] ${sid} - ${entry.title || "Untitled"}`;
                    opt.style.color = "#9ca3af";
                }
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
        getEl("nikayaSelector").value = "";
        getEl("bookSelector").innerHTML = '<option value="">BOOK</option>';
        getEl("suttaSelector").innerHTML = '<option value="">SUTTA</option>';
        getEl("langToggleBtn").style.display = "none";
        getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> SUTTA DISCOURSE CATALOG EXPLORER`;
        resetLeftPane();
        showHomeView();
    }
}
function toggleLanguage() {
    if (!selectedSuttaId || !appRegistry)
        return;
    const entry = appRegistry.entries[selectedSuttaId];
    if (!entry || !entry.languages)
        return;
    const langs = Object.keys(entry.languages);
    if (langs.length === 0)
        return;
    const idx = langs.indexOf(currentLanguage);
    currentLanguage = langs[(idx + 1) % langs.length];
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
    suttaChatHistory = [];
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
    ` : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] SuttaCentral link not found in json.</div>`;
        getEl("leafImg").src = "";
        getEl("youtubePlayer").style.display = "none";
        getEl("localVideoPlayer").style.display = "none";
        return;
    }
    const langToggle = getEl("langToggleBtn");
    const availLangs = Object.keys(entry.languages);
    if (availLangs.length > 1) {
        langToggle.style.display = "block";
        langToggle.innerText = `🌐 ${currentLanguage.toUpperCase()}`;
    }
    else {
        langToggle.style.display = "none";
        currentLanguage = availLangs[0] || "en";
    }
    getEl("suttaNotFoundCard").style.display = "none";
    getEl("homeViewPane").style.display = "none";
    getEl("suttaViewActive").style.display = "flex";
    try {
        const langPath = entry.languages[currentLanguage] || entry.languages["en"] || Object.values(entry.languages)[0];
        if (!langPath)
            throw new Error("No translation track available.");
        let details;
        const cacheKey = `${suttaId}_${currentLanguage}`;
        const response = await fetch("../" + langPath + `?t=${Date.now()}`, { cache: "no-cache" });
        if (!response.ok)
            throw new Error("Failed to fetch sutta data file.");
        details = await response.json();
        detailCache[cacheKey] = details;
        renderSuttaUI(details, entry);
    }
    catch (err) {
        console.error(err);
        getEl("suttaNotFoundCard").style.display = "flex";
        getEl("suttaViewActive").style.display = "none";
        getEl("errorDescription").innerText = `Error loading Sutta details: ${err.message}`;
    }
}
function renderAdminToolbar(containerId, fieldKey, options, currentValueGetter) {
    const container = getEl(containerId);
    const oldTb = container.querySelector(".admin-toolbar");
    if (oldTb)
        oldTb.remove();
    const tb = document.createElement("div");
    tb.className = "admin-toolbar";
    const statusEl = document.createElement("div");
    statusEl.className = "admin-status";
    if (options.canEdit) {
        const editBtn = document.createElement("button");
        editBtn.className = "admin-btn primary";
        editBtn.innerText = "✎ EDIT";
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "admin-btn";
        cancelBtn.innerText = "❌ CANCEL";
        cancelBtn.style.display = "none";
        let isEditing = false;
        let textAreaEl = null;
        let originalHtml = "";
        cancelBtn.onclick = () => {
            if (isEditing) {
                isEditing = false;
                editBtn.innerText = "✎ EDIT";
                cancelBtn.style.display = "none";
                if (textAreaEl)
                    textAreaEl.remove();
                Array.from(container.children).forEach(child => {
                    if (child !== tb)
                        child.style.display = "";
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
                    if (child !== tb)
                        child.style.display = "none";
                });
                textAreaEl = document.createElement("textarea");
                textAreaEl.className = "admin-textarea";
                textAreaEl.style.minHeight = "240px";
                textAreaEl.style.fontSize = "0.98rem";
                textAreaEl.style.lineHeight = "1.6";
                textAreaEl.style.padding = "12px";
                textAreaEl.value = val.trim();
                container.insertBefore(textAreaEl, tb);
            }
            else {
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
                            setTimeout(() => selectSutta(selectedSuttaId), 600);
                        }
                        else {
                            throw new Error(data.error || "Save failed");
                        }
                    }
                    catch (err) {
                        statusEl.className = "admin-status err";
                        statusEl.innerText = `Error ✗: ${err.message}`;
                    }
                }
            }
        };
        tb.appendChild(editBtn);
        tb.appendChild(cancelBtn);
    }
    if (options.canRerun) {
        const rerunBtn = document.createElement("button");
        rerunBtn.className = "admin-btn";
        rerunBtn.innerText = "✦ RERUN GEMINI";
        let isPromptOpen = false;
        let promptAreaEl = null;
        let runActionBtn = null;
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
                    if (!selectedSuttaId)
                        return;
                    statusEl.className = "admin-status";
                    statusEl.innerText = "Executing Gemini rerun pipeline...";
                    try {
                        const res = await fetch("/api/rerun", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                sutta_id: selectedSuttaId,
                                field: fieldKey,
                                prompt: promptAreaEl.value
                            })
                        });
                        const data = await res.json();
                        if (res.ok) {
                            statusEl.className = "admin-status ok";
                            statusEl.innerText = "Rerun Complete ✓";
                            setTimeout(() => selectSutta(selectedSuttaId), 1000);
                        }
                        else {
                            throw new Error(data.error || "Rerun failed");
                        }
                    }
                    catch (err) {
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
                    const b64 = reader.result.split(",")[1];
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
                            setTimeout(() => selectSutta(selectedSuttaId), 1000);
                        }
                        else {
                            throw new Error(data.error || "Upload failed");
                        }
                    }
                    catch (err) {
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
            if (!selectedSuttaId)
                return;
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
                    setTimeout(() => selectSutta(selectedSuttaId), 1000);
                }
                else {
                    throw new Error(data.error || "Cloning failed");
                }
            }
            catch (err) {
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
function renderSuttaUI(details, entry) {
    getEl("suttaTitle").innerText = details.sutta_name || details.names?.official || details.sutta_id;
    const leafImg = getEl("leafImg");
    const visualCard = getEl("illustrationCard");
    const nikFolder = appRegistry.config.nikaya_folders[entry.nikaya];
    const existingErr = visualCard.querySelector(".no-img-msg");
    if (existingErr)
        existingErr.remove();
    let heroUrl = details.image_url || "";
    if (!heroUrl && entry.folder) {
        heroUrl = `../${nikFolder}/${entry.folder}/${entry.folder}_image.png`;
    }
    if (heroUrl) {
        if (heroUrl.startsWith("/"))
            heroUrl = ".." + heroUrl;
        else if (!heroUrl.startsWith("..") && !heroUrl.startsWith("http"))
            heroUrl = "../" + heroUrl;
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
    }
    else {
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
    renderAdminToolbar("accordion-audio", "audio", { canUpload: "mp4", canClone: true });
    getEl("suttaProse").innerHTML = details.sutta
        ? `<p>${details.sutta}</p>`
        : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Sutta script translation not found in json.</div>`;
    renderAdminToolbar("accordion-sutta", "sutta", { canEdit: true, canRerun: true }, () => details.sutta || "");
    getEl("transcriptProse").innerText = details.transcript
        ? details.transcript
        : "[!] Raw transcript text not found in json.";
    renderAdminToolbar("accordion-transcript", "transcript", { canEdit: true, canRerun: true }, () => details.transcript || "");
    const commentaryHtml = details.commentary
        ? details.commentary.split("\n")
            .filter(p => p.trim())
            .map(p => `<p style="margin-bottom:8px;">${p}</p>`)
            .join("")
        : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Commentary text not found in json.</div>`;
    getEl("commentaryProse").innerHTML = commentaryHtml;
    renderAdminToolbar("accordion-commentary", "commentary", { canEdit: true, canRerun: true }, () => details.commentary || "");
    const treeContainer = getEl("treeVisualization");
    const treeRoot = transformKnowledgeGraph(details);
    if (treeRoot && treeRoot.children && treeRoot.children.length > 0) {
        treeContainer.innerHTML = renderTreeNodes(treeRoot, true);
    }
    else {
        treeContainer.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Concept teaching structure not found in json.</div>`;
    }
    renderAdminToolbar("accordion-tree", "knowledge_graph", { canRerun: true });
    const practiceContainer = getEl("practiceQuizCard");
    practiceContainer.innerHTML = "";
    let quizData = null;
    if (typeof details.quiz === "string") {
        try {
            quizData = JSON.parse(details.quiz);
        }
        catch (e) {
            quizData = null;
        }
    }
    else {
        quizData = details.quiz || null;
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
        let goldId = quizData.goldOptionId ? String(quizData.goldOptionId).trim() : "";
        if (!goldId && quizData.options && quizData.options.length > 0) {
            const summary = (quizData.teacherSummary || "").toLowerCase();
            const matched = quizData.options.find(o => (o.title && summary.includes(o.title.toLowerCase())) ||
                (o.body && summary.includes(o.body.toLowerCase().slice(0, 15))));
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
                    el.style.pointerEvents = "none";
                });
                if (isCorrect) {
                    optBtn.setAttribute("style", "background: #d1fae5 !important; border: 2px solid #10b981 !important; color: #065f46 !important; font-weight: 700 !important; box-shadow: 0 0 10px rgba(16,185,129,0.3) !important; padding: 12px 16px; border-radius: 8px; cursor: pointer;");
                }
                else {
                    optBtn.setAttribute("style", "background: #fee2e2 !important; border: 2px solid #ef4444 !important; color: #991b1b !important; font-weight: 700 !important; box-shadow: 0 0 10px rgba(239,68,68,0.3) !important; padding: 12px 16px; border-radius: 8px; cursor: pointer;");
                    const goldBtn = practiceContainer.querySelector(`.quiz-option[data-id="${goldId}"]`);
                    if (goldBtn) {
                        goldBtn.setAttribute("style", "background: #d1fae5 !important; border: 2px solid #10b981 !important; color: #065f46 !important; font-weight: 700 !important; box-shadow: 0 0 10px rgba(16,185,129,0.3) !important; padding: 12px 16px; border-radius: 8px; cursor: pointer;");
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
        practiceContainer.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">[!] Quiz MCQ questions not found in json.</div>`;
    }
    renderAdminToolbar("accordion-practice", "quiz", { canEdit: true, canRerun: true }, () => JSON.stringify(details.quiz || {}, null, 2));
    const scUrl = details.sc_url || details.sutta_central_link || entry.sc_url || "";
    getEl("suttaCentralMeta").innerHTML = scUrl ? `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <p style="font-size:0.9rem; color:var(--text-muted);">Access parallel translations, grammar tools, and Pali notes on SuttaCentral:</p>
      <a href="${scUrl}" target="_blank" class="go-back-btn" style="text-align:center; display:block; text-decoration:none;">Open on SuttaCentral ↗</a>
    </div>
  ` : `<div style="color:var(--text-muted); font-size:0.85rem;">[!] SuttaCentral link not found in json.</div>`;
    renderAdminToolbar("accordion-suttacentral", "sc_url", { canEdit: true }, () => scUrl);
    renderSuttaChatUI();
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
function renderSuttaChatUI() {
    const container = getEl("accordion-reflect").querySelector(".accordion-content");
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
    const inputEl = getEl("suttaChatInput");
    const msgText = inputEl.value.trim();
    if (!msgText || !selectedSuttaId)
        return;
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
        }
        else {
            throw new Error(data.error || "Chat failed");
        }
    }
    catch (err) {
        botLoading.innerText = `Error: ${err.message}`;
    }
    msgContainer.scrollTop = msgContainer.scrollHeight;
}
window.sendSuttaChatMessage = sendSuttaChatMessage;
function showHomeView() {
    selectedSuttaId = null;
    getEl("suttaViewActive").style.display = "none";
    getEl("suttaNotFoundCard").style.display = "none";
    const homePane = getEl("homeViewPane");
    homePane.style.display = "flex";
    getEl("breadcrumbBar").innerHTML = `<span class="breadcrumb-dot">•</span> SUTTA DISCOURSE CATALOG & RAG ASSISTANT`;
    resetLeftPane();
    renderHomeScreen();
}
window.showHomeView = showHomeView;
function renderHomeScreen() {
    const homePane = getEl("homeViewPane");
    homePane.style.display = "flex";
    getEl("suttaNotFoundCard").style.display = "none";
    getEl("suttaViewActive").style.display = "none";
    if (!appRegistry)
        return;
    const stats = {
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
            if (e.status === "COMPLETE")
                stats[nik].complete++;
            else if (e.status === "RAW")
                stats[nik].raw++;
            else
                stats[nik].ghost++;
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
    const inputEl = getEl("homeChatInput");
    const msgText = inputEl.value.trim();
    if (!msgText || !appRegistry)
        return;
    inputEl.value = "";
    homeChatHistory.push({ role: "user", content: msgText });
    const msgContainer = getEl("homeChatMessages");
    msgContainer.innerHTML += `<div class="chat-bubble user">${msgText}</div>`;
    const botLoading = document.createElement("div");
    botLoading.className = "chat-bubble bot";
    botLoading.innerText = "Querying local Ollama model...";
    msgContainer.appendChild(botLoading);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    const nikVal = getEl("nikayaSelector").value;
    const bookVal = getEl("bookSelector").value;
    let contextItems = [];
    Object.keys(appRegistry.entries).forEach(sid => {
        const entry = appRegistry.entries[sid];
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
        }
        else {
            throw new Error(data.error || "Home chat failed");
        }
    }
    catch (err) {
        botLoading.innerText = `Notice: ${err.message}`;
    }
    msgContainer.scrollTop = msgContainer.scrollHeight;
}
window.sendHomeChatMessage = sendHomeChatMessage;
function openAccordion(tabId) {
    const activeItem = document.getElementById(`accordion-${tabId}`);
    if (activeItem) {
        activeItem.classList.add("active");
    }
}
function toggleAccordion(tabId) {
    const item = document.getElementById(`accordion-${tabId}`);
    if (item) {
        item.classList.toggle("active");
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
