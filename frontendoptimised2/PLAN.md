# Full Implementation Plan — DAMA Sutta Explorer

## Files in scope (no new files except prompts.txt)
- `frontendoptimised2/pipeline.py` — add --serve mode with all API endpoints
- `frontendoptimised2/prompts.txt` — NEW, one section per Gemini field
- `frontendoptimised2/index.html` — CSS additions only
- `frontendoptimised2/app.ts` — all frontend logic additions

---

## PART 1 — Inline Dev Admin Tools

### pipeline.py --serve endpoints
Replace `python -m http.server 8000` with `python pipeline.py --serve`.

| Endpoint | Method | Payload | Action |
|---|---|---|---|
| /api/save | POST | {sutta_id, lang, field, value} | Patch field in sutta JSON, atomic_write |
| /api/upload | POST | multipart: file + sutta_id | Save MP4 or PNG to sutta folder |
| /api/rerun | POST | {sutta_id, field, prompt} | Gemini call → save result to JSON |
| /api/clone | POST | {sutta_id, target_lang} | ElevenLabs voice clone EN MP4 → lang subfolder → update master.json |
| /api/chat | POST | {sutta_id, messages} | Gemini with sutta JSON as context → return reply (REFLECT panel) |
| /api/home_chat | POST | {messages, nikaya?, book?, sutta_id?} | Ollama with filtered corpus context → return reply (home screen) |

Fallback chain (all in pipeline.py):
- Text rerun / sutta chat: Gemini API (gemini_api_key.txt) → local model → error
- Image gen: Gemini Imagen → local weights → error
- Audio clone: ElevenLabs (11labskey.txt) → local TTS → error
- Home chat: Ollama (local) only — no external API

Field → JSON key map:
- sutta → `sutta`
- commentary → `commentary`
- quiz → `quiz`
- tree → `knowledge_graph`
- sc_url → `sc_url`
- image → `image_url`

### prompts.txt sections
[sutta], [commentary], [quiz], [knowledge_graph], [image]
Template vars: {sid}, {transcript}

### index.html CSS additions (inside existing style block)
- `.admin-toolbar` — flex row, dashed top border, below panel content
- `.admin-btn` — capsule buttons (neutral / primary / danger)
- `.admin-status` — inline status text (ok=green / err=red)
- `.admin-textarea` — for edit mode and prompt editing
- `.upload-zone` — dashed drag-drop area with hover state
- `.chat-messages` — scrollable message list for REFLECT and home chat
- `.chat-bubble-user` / `.chat-bubble-bot` — message bubbles
- `.status-table` — project status grid for home screen

### app.ts admin logic additions

Fix quiz everywhere: remove all `mcq` references, use only `details.quiz`

On init: fetch('prompts.txt') → parse into promptsMap: Record<string, string>

renderAdminToolbar(panelId, config) — appended to each accordion after content:

| Panel | canEdit | canRerun | canUpload | canClone |
|---|---|---|---|---|
| VISUAL | — | ✓ (image) | png | — |
| AUDIO | — | — | mp4 | ✓ JP/HI/DE/SW |
| SUTTA | ✓ | ✓ | — | — |
| COMMENTARY | ✓ | ✓ | — | — |
| TREE | — | ✓ | — | — |
| PRACTICE | ✓ | ✓ | — | — |
| SUTTACENTRAL | ✓ | — | — | — |
| REFLECT | — | — | — | — |

Edit flow: Click Edit → textarea with current value → Save → POST /api/save → inline status

Rerun flow: Click Rerun → textarea pre-filled from prompts.txt[field] → user edits → Run → POST /api/rerun → panel re-renders

Upload flow: drag-drop zone → POST /api/upload multipart → on success: selectSutta(currentId)

Clone flow (AUDIO): dropdown JP/HI/DE/SW → Clone → POST /api/clone → sutta reloads, new lang in toggle

---

## PART 2 — REFLECT Panel: Sutta-level Chatbot

Replaces the Norbu AI iframe entirely.

### Retrieval
No retrieval needed. Context = the already-loaded sutta JSON:
- sutta text
- commentary
- transcript
- knowledge_graph nodes
- quiz

All fits in one Gemini context window (~5-10k tokens per sutta).

### Generation
Gemini API via POST /api/chat

System prompt built by server:
"You are a Dhamma teacher. Answer only from this sutta's content. Do not speculate beyond what is written."
+ full sutta JSON pasted in as context

Conversation is stateless on the server. Frontend maintains messages[] array and sends full history each request.

### UI in REFLECT accordion (app.ts)
- Scrollable message list
- Input box + Send button
- User bubble (right-aligned) / Bot bubble (left-aligned, warm cream bg)
- Loading indicator (animated dots) while waiting
- Chat resets when a new sutta is selected

---

## PART 3 — Home Screen Fix + Status Table + RAG Bot

### Home screen fix
Currently handleRouting() shows suttaNotFoundCard when no sutta selected.
Replace with a proper home view: renderHomeScreen() function.

### Project Status Table (app.ts, pure frontend)
Data source: master.json entries already in memory

Columns: Nikaya | COMPLETE | RAW | GHOST | Total
One row per Nikaya (AN, MN, SN, DN, KN)
Totals row at bottom
Clickable COMPLETE count → opens first available COMPLETE sutta for that Nikaya

### Home RAG Bot

#### Retrieval layer (pure frontend, no model needed)
The existing Nikaya → Book → Sutta dropdowns ARE the retrieval filter.

Context assembly logic (in app.ts, POST payload to server):
- No selection → send sutta titles + IDs only (master.json index, ~50k chars)
- Nikaya selected → load and send all sutta JSON summaries for that Nikaya
- Book selected → load and send all sutta JSONs for that Book
- Sutta selected → load and send full sutta JSON (same as REFLECT)

Summary = sutta_name + sutta (first 500 chars) + commentary (first 300 chars) per entry

#### Generation layer (pipeline.py, Ollama only)
POST /api/home_chat payload: {messages, context_json}

Server side:
1. Receive context_json (already assembled by frontend)
2. Build system prompt: "You are a Dhamma research assistant. Answer only from the provided sutta corpus."
3. Append context_json
4. Send to Ollama (http://localhost:11434) with whatever model is available
5. Stream or return response

Ollama model selection: try llama3 → mistral → phi3 → whatever is pulled

Fallback if Ollama not running: return error message "Start Ollama to use home chat"

#### UI (app.ts, rendered in renderHomeScreen())
- Same chat bubble components reused from REFLECT
- Dropdowns above chat: Nikaya → Book → Sutta (already exist, reuse same selectors)
- Context indicator: "Searching across: All AN suttas (97)" updates as user filters
- Send button disabled until context is assembled

---

## PART 4 — Launch

Run everything with one command:
```
cd C:\Users\ADMIN\Desktop\buddha3
python frontendoptimised2/pipeline.py --serve
```

Ollama runs separately (already installed):
```
ollama serve
```

---

## Build order
1. prompts.txt — write all 5 prompt sections
2. pipeline.py --serve mode — static server + /api/save + /api/upload + /api/rerun + /api/clone + /api/chat + /api/home_chat
3. index.html — add CSS for admin toolbar + chat UI + status table
4. app.ts — fix quiz, add admin toolbars, REFLECT chat, home screen, home RAG bot
5. Compile: tsc app.ts → app.js
6. Push to GitHub
