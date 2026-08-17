#!/usr/bin/env python3
import os
import sys
import json
import tempfile
import argparse
import urllib.request
import urllib.parse
import urllib.error
import base64
import re
import shutil
import subprocess
import time
import csv
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import HTTPServer, SimpleHTTPRequestHandler

# --- .env File Auto-Loader ---
_SCRIPT_ROOT = Path(__file__).resolve().parent
for _env_candidate in [_SCRIPT_ROOT / ".env", _SCRIPT_ROOT.parent / ".env"]:
    if _env_candidate.exists():
        try:
            for _line in _env_candidate.read_text(encoding="utf-8").splitlines():
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    os.environ.setdefault(_k.strip(), _v.strip().strip("'\""))
        except Exception:
            pass


# Constants & Configuration
DEFAULT_SERVER_PORT = 8000
HTTP_TIMEOUT_SECONDS = 60
IMAGE_GENERATION_WIDTH = 800
IMAGE_GENERATION_HEIGHT = 600
MAX_PROMPT_IMAGE_LENGTH = 220
MAX_TRANSCRIPT_CONTEXT_LENGTH = 16000
HALF_TRANSCRIPT_CONTEXT_LENGTH = 8000
MAX_RERUN_TRANSCRIPT_LENGTH = 12000
HALF_RERUN_TRANSCRIPT_LENGTH = 6000
MAX_PARALLEL_DOWNLOAD_WORKERS = 4

# Paths relative to this file
ROOT = Path(__file__).resolve().parent

if (ROOT / "sutta_status_matrix.csv").exists():
    FRONTEND_OPT = ROOT
    BUDDHA3_DIR = ROOT.parent
elif (ROOT / "frontendoptimised2" / "sutta_status_matrix.csv").exists():
    FRONTEND_OPT = ROOT / "frontendoptimised2"
    BUDDHA3_DIR = ROOT
else:
    FRONTEND_OPT = ROOT
    BUDDHA3_DIR = ROOT.parent

MAPPING_CSV = FRONTEND_OPT / "sutta_status_matrix.csv"
DOWNLOADS_DIR = FRONTEND_OPT / "downloads"
GEMINI_KEY_FILE = BUDDHA3_DIR / "gemini_api_key.txt"
ELEVEN_KEY_FILE = BUDDHA3_DIR / "11labskey.txt"

NIKAYA_FOLDERS = {
    "AN": "Anguttara Nikaya by Bhante Hye Dhammavuddho Mahathera",
    "DN": "Digha Nikaya by Bhante Hye Dhammavuddho Mahathera",
    "KN": "Khuddaka Nikaya by Bhante Dhammavuddho Hye Mahathera",
    "MN": "Majjhima Nikaya by Bhante Hye Dhammavuddho Mahathera",
    "SN": "Samyutta Nikaya by Bhante Hye Dhammavuddho Mahathera"
}

FIELD_KEY_MAP = {
    "sutta": "sutta",
    "commentary": "commentary",
    "transcript": "transcript",
    "transcript_original": "transcript_original",
    "transcript_synthetic": "transcript_synthetic",
    "quiz": "quiz",
    "tree": "knowledge_graph",
    "knowledge_graph": "knowledge_graph",
    "sc_url": "sc_url",
    "sc_name": "sc_name",
    "image": "image_url",
    "image_url": "image_url"
}

# --- Shared Utility Functions ---

def resolve_nikaya_folder(nikaya_code: str) -> str:
    nik = nikaya_code.upper() if nikaya_code else "AN"
    default_name = NIKAYA_FOLDERS.get(nik, NIKAYA_FOLDERS["AN"])
    if nik == "KN":
        alt_name = "Khuddaka Nikaya by Bhante Hye Dhammavuddho Mahathera"
        if (BUDDHA3_DIR / alt_name).is_dir() and not (BUDDHA3_DIR / default_name).is_dir():
            return alt_name
        if (DOWNLOADS_DIR / alt_name).is_dir() and not (DOWNLOADS_DIR / default_name).is_dir():
            return alt_name
    return default_name

def read_text_safely(path: Path) -> str:
    if not path or not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""

def find_asset(search_dirs: list, vid: str = "", folder: str = "", extensions: list = [".mp4"]) -> Path:
    exts = [e.lower() for e in extensions]
    for s_dir in search_dirs:
        if not s_dir or not s_dir.is_dir():
            continue
        if vid:
            match = next((p for p in s_dir.glob(f"*{vid}*.*") if p.suffix.lower() in exts and p.stat().st_size > 0 and p.is_file()), None)
            if match:
                return match
        if folder:
            match = next((p for p in s_dir.glob(f"*{folder}*.*") if p.suffix.lower() in exts and p.stat().st_size > 0 and p.is_file()), None)
            if match:
                return match
        match = next((p for p in s_dir.glob("*.*") if p.suffix.lower() in exts and p.stat().st_size > 0 and p.is_file()), None)
        if match:
            return match
    return None

def get_gemini_key():
    if os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY").strip():
        return os.getenv("GEMINI_API_KEY").strip()
    for key_path in [FRONTEND_OPT / "gemini_api_key.txt", GEMINI_KEY_FILE, BUDDHA3_DIR.parent / "buddha" / "gemini_api_key.txt"]:
        if key_path and key_path.exists() and key_path.read_text(encoding="utf-8").strip():
            return key_path.read_text(encoding="utf-8").strip()
    return None

def get_eleven_key():
    if os.getenv("ELEVENLABS_API_KEY"):
        return os.getenv("ELEVENLABS_API_KEY").strip()
    for key_path in [FRONTEND_OPT / "11labskey.txt", ELEVEN_KEY_FILE]:
        if key_path and key_path.exists() and key_path.read_text(encoding="utf-8").strip():
            return key_path.read_text(encoding="utf-8").strip()
    return None

def call_gemini_api(payload: dict, key: str) -> str:
    models = ["gemini-flash-lite-latest", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"]
    last_err = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        for attempt in range(5):
            req_obj = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            try:
                with urllib.request.urlopen(req_obj, timeout=HTTP_TIMEOUT_SECONDS) as resp:
                    result_raw = json.loads(resp.read().decode("utf-8"))
                    return result_raw["candidates"][0]["content"]["parts"][0]["text"].strip()
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="ignore")
                last_err = RuntimeError(f"Gemini {model} error ({e.code}): {err_body}")
                if e.code == 429:
                    time.sleep(3 * (attempt + 1))
                    continue
                break
            except Exception as ex:
                last_err = ex
                time.sleep(2)
                continue
    if last_err:
        raise last_err
    raise RuntimeError("Gemini API call failed")

def atomic_write(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(Path(tmp), path)
    except Exception:
        Path(tmp).unlink(missing_ok=True)
        raise

def atomic_write_csv(path: Path, rows: list, fieldnames: list):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
            f.flush()
            os.fsync(f.fileno())
        try:
            os.replace(Path(tmp), path)
        except PermissionError:
            try:
                time.sleep(0.3)
                os.replace(Path(tmp), path)
            except PermissionError:
                try:
                    with open(path, "w", encoding="utf-8", newline="") as f:
                        writer = csv.DictWriter(f, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(rows)
                except PermissionError:
                    print(f"[WARNING] Could not write {path.name}: file is locked by an external application (e.g. Excel).")
                finally:
                    Path(tmp).unlink(missing_ok=True)
    except Exception as e:
        Path(tmp).unlink(missing_ok=True)
        if not isinstance(e, PermissionError):
            raise

def read_csv_mapping() -> list:
    if not MAPPING_CSV.exists():
        return []
    with open(MAPPING_CSV, "r", encoding="utf-8", errors="replace") as f:
        return list(csv.DictReader(f))

def find_sutta_dir(sutta_id: str):
    rows = read_csv_mapping()
    row = next((r for r in rows if r.get("sutta_id") == sutta_id), None)
    if not row:
        parts = sutta_id.split()
        nik = parts[0].upper() if parts else "AN"
        num_part = parts[1] if len(parts) > 1 else sutta_id
        folder = num_part.replace(".", "_")
        row = {
            "sutta_id": sutta_id,
            "nikaya": nik,
            "folder": folder,
            "title": "",
            "youtube_id": "",
            "sc_link": ""
        }
    
    nik = row.get("nikaya", "AN").upper()
    folder = row.get("folder") or row.get("sutta_id", "").split()[-1].replace(".", "_")
    nik_folder_name = resolve_nikaya_folder(nik)
    
    if (BUDDHA3_DIR / nik_folder_name).is_dir():
        sutta_dir = BUDDHA3_DIR / nik_folder_name / folder
    else:
        sutta_dir = DOWNLOADS_DIR / nik_folder_name / folder
    return sutta_dir, row

def get_sutta_json_path(sutta_id: str, lang: str = "en"):
    sutta_dir, row = find_sutta_dir(sutta_id)
    if not sutta_dir:
        return None

    sutta_dir.mkdir(parents=True, exist_ok=True)
    folder_name = sutta_dir.name

    if lang == "en":
        return sutta_dir / f"{folder_name}.json"
    else:
        lang_dir = sutta_dir / lang
        lang_dir.mkdir(parents=True, exist_ok=True)
        return lang_dir / f"{folder_name}.json"

# --- Pipeline Core Workflow Functions ---

def organize_suttas():
    """Organizes downloaded raw assets into individual sutta folders and creates baseline JSON files."""
    rows = read_csv_mapping()
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

    created_folders = 0
    copied_mp4s = 0
    copied_srts = 0
    generated_jsons = 0

    for row in rows:
        sid = row.get("sutta_id")
        nik = row.get("nikaya", "AN").upper()
        folder = row.get("folder") or sid.split()[-1].replace(".", "_")
        vid = row.get("youtube_id", "").strip()
        sc_link = row.get("sc_link", "").strip()
        sc_title = row.get("title", "").strip()

        if not nik or not folder:
            continue

        nik_folder_name = resolve_nikaya_folder(nik)
        sutta_dir = BUDDHA3_DIR / nik_folder_name / folder
        sutta_dir.mkdir(parents=True, exist_ok=True)
        created_folders += 1

        target_json = sutta_dir / f"{folder}.json"
        target_mp4 = sutta_dir / f"{folder}.mp4"
        target_srt = sutta_dir / f"{folder}.en.srt"
        target_txt = sutta_dir / f"{folder}.txt"

        raw_nik_dir = DOWNLOADS_DIR / nik_folder_name
        raw_code_dir = DOWNLOADS_DIR / nik.lower()
        search_dirs = [DOWNLOADS_DIR, raw_nik_dir, raw_code_dir, sutta_dir]

        mp4_src = find_asset(search_dirs, vid=vid, folder=folder, extensions=[".mp4"])
        srt_src = find_asset(search_dirs, vid=vid, folder=folder, extensions=[".srt", ".vtt"])

        if mp4_src:
            if not target_mp4.exists() or (mp4_src != target_mp4 and target_mp4.stat().st_size == 0):
                shutil.copy(mp4_src, target_mp4)
                copied_mp4s += 1

        if srt_src:
            if not target_srt.exists() or (srt_src != target_srt and target_srt.stat().st_size == 0):
                shutil.copy(srt_src, target_srt)
                copied_srts += 1

        transcript_content = ""
        for srt_path in [target_srt, srt_src]:
            text = read_text_safely(srt_path)
            if text.strip():
                transcript_content = text
                break

        if transcript_content and not target_txt.exists():
            target_txt.write_text(transcript_content, encoding="utf-8")

        existing_data = {}
        if target_json.exists():
            try:
                with open(target_json, "r", encoding="utf-8") as f:
                    ed = json.load(f)
                    if ed and isinstance(ed, dict):
                        existing_data = ed
            except Exception:
                pass

        s_name = existing_data.get("sutta_name_en") or existing_data.get("sutta_name") or sc_title or sid
        sc_u = sc_link or existing_data.get("sc_url") or existing_data.get("sutta_central_link") or ""

        json_data = {
            "suttaid": sid,
            "sutta_id": sid,
            "sutta_name_en": s_name,
            "sutta_name": s_name,
            "sc_name": sc_title or s_name,
            "sc_url": sc_u,
            "sutta_central_link": sc_u,
            "sutta": existing_data.get("sutta", ""),
            "commentary": existing_data.get("commentary", ""),
            "transcript_original": transcript_content or existing_data.get("transcript_original", ""),
            "transcript_synthetic": transcript_content or existing_data.get("transcript_synthetic", ""),
            "transcript": transcript_content or existing_data.get("transcript", ""),
            "quiz": existing_data.get("quiz") or {
                "suttaId": sid,
                "quote": f"Discourse context for {sid}",
                "options": [],
                "goldOptionId": "1"
            },
            "knowledge_graph": existing_data.get("knowledge_graph") or {
                "nodes": [],
                "edges": []
            },
            "image_prompt": existing_data.get("image_prompt") or f"Watercolor illustration of Dhamma discourse {sid}",
            "image_url": existing_data.get("image_url") or "",
            "aud_file": f"{folder}.mp4",
            "languages": existing_data.get("languages") or ["en"],
            "valid": True,
            "last_edited_timestamp": int(time.time() * 1000)
        }

        if not target_json.exists() or "suttaid" not in existing_data:
            atomic_write(target_json, json_data)
            generated_jsons += 1

    print(f"[ORGANIZE COMPLETE] Folders: {created_folders}, MP4s: {copied_mp4s}, SRTs: {copied_srts}, JSONs: {generated_jsons}")
    sync_matrix_csv()

def sync_matrix_csv():
    """Audits disk using dynamic asset checks, updating sutta_status_matrix.csv."""
    if not MAPPING_CSV.exists():
        print(f"Error: {MAPPING_CSV.name} not found")
        return

    rows = read_csv_mapping()
    fieldnames = list(rows[0].keys()) if rows else []

    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

    complete_count = 0
    raw_count = 0
    ghost_count = 0

    for row in rows:
        sid = row.get("sutta_id")
        nik = row.get("nikaya", "AN").upper()
        folder = row.get("folder") or sid.split()[-1].replace(".", "_")
        vid = row.get("youtube_id", "").strip()

        nik_folder_name = resolve_nikaya_folder(nik)
        sutta_dir = BUDDHA3_DIR / nik_folder_name / folder
        nik_downloads_dir = BUDDHA3_DIR / nik_folder_name / "downloads"
        fe_nik_downloads_dir = DOWNLOADS_DIR / nik_folder_name
        fe_downloads_dir = DOWNLOADS_DIR / nik.lower()

        search_dirs = [sutta_dir, DOWNLOADS_DIR, fe_nik_downloads_dir, fe_downloads_dir, nik_downloads_dir]

        json_file = find_asset([sutta_dir], folder=folder, extensions=[".json"])
        mp4_file = find_asset(search_dirs, vid=vid, folder=folder, extensions=[".mp4"])
        srt_file = find_asset(search_dirs, vid=vid, folder=folder, extensions=[".srt", ".vtt"])

        has_json = json_file is not None
        has_mp4 = mp4_file is not None
        has_srt = srt_file is not None

        has_sutta_text = False
        has_commentary = False
        has_transcript = False

        if json_file:
            row["json_file_path"] = json_file.relative_to(BUDDHA3_DIR).as_posix()
            try:
                with open(json_file, "r", encoding="utf-8") as jf:
                    js_data = json.load(jf)
                    s_text = js_data.get("sutta", "").strip()
                    comm = js_data.get("commentary", "").strip()
                    trans = js_data.get("transcript", "").strip() or js_data.get("transcript_original", "").strip()

                    has_sutta_text = len(s_text) > 0
                    has_commentary = len(comm) > 0
                    has_transcript = len(trans) > 0

                    s_name = js_data.get("sutta_name") or js_data.get("names", {}).get("official", "")
                    if s_name and not row.get("title"):
                        row["title"] = s_name.strip()
            except Exception:
                pass

        if mp4_file:
            row["mp4_file_path"] = mp4_file.relative_to(BUDDHA3_DIR).as_posix()
            row["has_mp4"] = "True"
            row["has_video_audio"] = "True"
        else:
            row["mp4_file_path"] = ""
            row["has_mp4"] = "False"

        if srt_file:
            row["srt_file_path"] = srt_file.relative_to(BUDDHA3_DIR).as_posix()
            row["has_srt"] = "True"
        else:
            row["srt_file_path"] = ""
            row["has_srt"] = "False"

        row["has_sutta_text"] = str(has_sutta_text)
        row["has_commentary"] = str(has_commentary)
        row["has_transcript"] = str(has_transcript)

        # Dynamic asset completion check
        if has_sutta_text and has_commentary and has_transcript and (has_mp4 or has_srt or vid):
            status = "COMPLETE"
        elif has_json or has_mp4 or has_srt or vid:
            status = "RAW"
        else:
            status = "GHOST"

        row["status"] = status

        if status == "COMPLETE":
            complete_count += 1
        elif status == "RAW":
            raw_count += 1
        else:
            ghost_count += 1

        row["last_edited_timestamp"] = str(int(time.time() * 1000))

    if fieldnames:
        atomic_write_csv(MAPPING_CSV, rows, fieldnames)
    print(f"Matrix CSV updated: {MAPPING_CSV.name} (COMPLETE: {complete_count}, RAW: {raw_count}, GHOST: {ghost_count})")

def download_video_to_downloads_dir(nikaya_code: str, video_id: str):
    """Downloads raw video (.mp4) and raw subtitles (.srt/.vtt) directly into downloads/<nikaya_folder>/."""
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    nik_folder_name = resolve_nikaya_folder(nikaya_code)
    target_dir = DOWNLOADS_DIR / nik_folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    ytdlp_bin = shutil.which("yt-dlp") or "yt-dlp"
    url = f"https://www.youtube.com/watch?v={video_id}"

    mp4_existing = [p for p in target_dir.glob(f"*{video_id}*.mp4") if p.stat().st_size > 0]
    srt_existing = [p for p in target_dir.glob(f"*{video_id}*.*") if p.suffix.lower() in [".srt", ".vtt"] and p.stat().st_size > 0]

    if mp4_existing and srt_existing:
        print(f" -> Raw media for video {video_id} already exists in {target_dir.name}/. Skipping.", flush=True)
        return True

    print(f"[DOWNLOAD RAW] Downloading video {video_id} into {target_dir.name}...", flush=True)
    out_template = str(target_dir / f"{video_id}.%(ext)s")

    cmd = [
        ytdlp_bin,
        "--no-playlist",
        "--no-progress",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/18/best",
        "--extractor-args", "youtube:player_client=android,web",
        "--write-auto-subs",
        "--sub-langs", "en,en.*",
        "--sub-format", "srt",
        "-o", out_template,
        url
    ]

    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0:
            print(f"[DOWNLOAD SUCCESS] Downloaded raw video/subtitles for {video_id} into {target_dir.name}/", flush=True)
            return True
        else:
            print(f"[DOWNLOAD WARNING] yt-dlp warning: {res.stderr[:200]}", flush=True)
            return False
    except Exception as ex:
        print(f"[DOWNLOAD ERROR] Failed to download {video_id}: {ex}", flush=True)
        return False

def _download_task_wrapper(args_tuple):
    nik, vid = args_tuple
    return download_video_to_downloads_dir(nik, vid)

def download_all():
    """Iterates all rows in sutta_status_matrix.csv with youtube_id and downloads raw files into downloads/ in parallel."""
    rows = read_csv_mapping()
    nik_vids = []
    seen_vids = set()
    for r in rows:
        nik = r.get("nikaya", "AN").upper()
        vid = r.get("youtube_id", "").strip()
        if nik and vid and vid not in seen_vids:
            seen_vids.add(vid)
            nik_vids.append((nik, vid))

    total_vids = len(nik_vids)
    print(f"==========================================================================", flush=True)
    print(f"STARTING PARALLEL RAW MEDIA DOWNLOAD ({total_vids} Videos into {DOWNLOADS_DIR})", flush=True)
    print(f"==========================================================================", flush=True)

    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_DOWNLOAD_WORKERS) as executor:
        futures = {executor.submit(_download_task_wrapper, item): item for item in nik_vids}
        completed = 0
        for future in as_completed(futures):
            completed += 1
            nik, vid = futures[future]
            try:
                future.result()
            except Exception as ex:
                print(f"[DOWNLOAD WORKER ERROR] {vid}: {ex}", flush=True)
            print(f"Progress: [{completed}/{total_vids}] tasks finished.", flush=True)

    organize_suttas()
    print(f"\n[RAW DOWNLOAD COMPLETE] Finished raw downloading for all {total_vids} videos into {DOWNLOADS_DIR}.", flush=True)
    return 0

def generate_sutta_json(sutta_id: str, prompt_template: str = None, flush: bool = False):
    key = get_gemini_key()
    if not key:
        raise RuntimeError("Gemini API key is required but not found in environment or gemini_api_key.txt")

    json_path = get_sutta_json_path(sutta_id, "en")
    if not json_path:
        raise ValueError(f"Could not resolve JSON path for sutta_id: {sutta_id}")

    if flush and json_path.exists():
        json_path.unlink()

    sutta_dir, row = find_sutta_dir(sutta_id)
    nikaya_code = row.get("nikaya", "AN").upper()
    nik_folder_name = resolve_nikaya_folder(nikaya_code)
    vid = row.get("youtube_id", "").strip()
    sc_url_hint = row.get("sc_link", "").strip()
    sc_name_hint = row.get("title", "").strip()

    search_dirs = [sutta_dir, DOWNLOADS_DIR, DOWNLOADS_DIR / nik_folder_name]
    sub_file = find_asset(search_dirs, vid=vid, extensions=[".srt", ".vtt", ".txt"])
    transcript_original = read_text_safely(sub_file)

    existing_data = {}
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except Exception:
            pass

    if existing_data.get("transcript_original"):
        transcript_original = existing_data["transcript_original"]

    context_transcript = transcript_original or existing_data.get("transcript") or existing_data.get("sutta") or ""
    if len(context_transcript) > MAX_TRANSCRIPT_CONTEXT_LENGTH:
        context_transcript = context_transcript[:HALF_TRANSCRIPT_CONTEXT_LENGTH] + "\n\n[OMITTED TRANSCRIPT SECTION]\n\n" + context_transcript[-HALF_TRANSCRIPT_CONTEXT_LENGTH:]

    print(f"[GEMINI API] Generating Sutta JSON for {sutta_id}...")

    prompt = f"""You are a Pali scholar and Dhamma researcher. Analyze the following sutta discourse text and audio transcript context for {sutta_id}.

Extract and return ONLY a single valid JSON object structured exactly as follows:
{{
  "sutta_id": "{sutta_id}",
  "names": {{
    "official": "Official Pali/English sutta title as identified by Gemini...",
    "pali": "Pali sutta name...",
    "teacher": "Teacher/Bhante name if mentioned...",
    "simile": "Main simile name if used..."
  }},
  "sutta_name": "Official Sutta Title (Gemini)",
  "sc_name": "{sc_name_hint}",
  "sc_url": "{sc_url_hint}",
  "sutta": "Full translation of the discourse in clear English...",
  "commentary": "Detailed teacher commentary explaining doctrinal terms, similes, and practice instructions...",
  "transcript_synthetic": "Full combined text containing both the spoken sutta and commentary...",
  "quiz": {{
    "suttaId": "{sutta_id}",
    "quote": "A thoughtful multiple choice question testing key understanding of this sutta...",
    "options": [
      {{"id": "1", "title": "First Option Title", "body": "Explanation of option 1"}},
      {{"id": "2", "title": "Second Option Title", "body": "Explanation of option 2"}},
      {{"id": "3", "title": "Third Option Title", "body": "Explanation of option 3"}},
      {{"id": "4", "title": "Fourth Option Title", "body": "Explanation of option 4"}}
    ],
    "goldOptionId": "2"
  }},
  "knowledge_graph": {{
    "nodes": [
      {{"id": "concept_1", "label": "Concept 1", "pali": "Pali Term 1", "type": "Factor", "domain": "Practice", "description": "Description of concept 1"}},
      {{"id": "concept_2", "label": "Concept 2", "pali": "Pali Term 2", "type": "Goal", "domain": "Nibbana", "description": "Description of concept 2"}}
    ],
    "edges": [
      {{"source": "concept_1", "target": "concept_2", "relation": "LEADS_TO", "order": 1}}
    ]
  }},
  "image_prompt": "Detailed visual watercolor concept description for AI image generation capturing the themes of this sutta...",
  "aud_file": "{sutta_dir.name}.mp4",
  "languages": ["en"],
  "valid": true
}}

[INPUT CONTEXT / TRANSCRIPT]:
{context_transcript if context_transcript else f'Sutta ID {sutta_id} in Nikaya {nikaya_code}.'}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
    }

    raw_text = call_gemini_api(payload, key)
    s_idx = raw_text.find("{")
    e_idx = raw_text.rfind("}")
    if s_idx == -1 or e_idx == -1:
        raise ValueError(f"Gemini API did not return valid JSON object: {raw_text[:200]}")

    data = json.loads(raw_text[s_idx:e_idx+1])
    if not isinstance(data, dict):
        raise ValueError(f"Parsed response for {sutta_id} is not a dictionary")

    extracted_name = data.get("sutta_name_en") or data.get("sutta_name") or data.get("names", {}).get("official") or sc_name_hint or sutta_id
    sc_u = sc_url_hint or data.get("sc_url") or data.get("sutta_central_link") or ""

    data["suttaid"] = sutta_id
    data["sutta_id"] = sutta_id
    data["sutta_name_en"] = extracted_name
    data["sutta_name"] = extracted_name
    data["sc_name"] = sc_name_hint or extracted_name
    data["sc_url"] = sc_u
    data["sutta_central_link"] = sc_u
    data["transcript_original"] = transcript_original
    if "transcript_synthetic" in data:
        data["transcript"] = data["transcript_synthetic"]
    else:
        data["transcript_synthetic"] = data.get("transcript", "")

    data["aud_file"] = f"{sutta_dir.name}.mp4"
    data["languages"] = ["en"]
    data["valid"] = True
    data["last_edited_timestamp"] = int(time.time() * 1000)

    if data.get("image_prompt") and not data.get("image_url"):
        clean_p = urllib.parse.quote(data["image_prompt"][:MAX_PROMPT_IMAGE_LENGTH].replace("\n", " "))
        data["image_url"] = f"https://image.pollinations.ai/prompt/{clean_p}?width={IMAGE_GENERATION_WIDTH}&height={IMAGE_GENERATION_HEIGHT}&nologo=true"

    atomic_write(json_path, data)
    dl_json_path = DOWNLOADS_DIR / nik_folder_name / sutta_dir.name / f"{sutta_dir.name}.json"
    dl_json_path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(dl_json_path, data)
    sync_matrix_csv()
    print(f"[GEMINI API SUCCESS] Saved Sutta JSON: {json_path}")
    return 0


class DevServerHandler(SimpleHTTPRequestHandler):
    ROUTE_MAP = {}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BUDDHA3_DIR), **kwargs)
        self.ROUTE_MAP = {
            "/api/save": self.handle_save,
            "/api/upload": self.handle_upload,
            "/api/rerun": self.handle_rerun,
            "/api/clone": self.handle_clone,
            "/api/chat": self.handle_chat,
            "/api/home_chat": self.handle_home_chat
        }

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_GET(self):
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        handler = self.ROUTE_MAP.get(path)
        if handler:
            handler()
        else:
            self.send_error(404, "Endpoint not found")

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")
        return json.loads(body) if body else {}

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def handle_save(self):
        try:
            req = self.read_json_body()
            sutta_id = req.get("sutta_id")
            lang = req.get("lang", "en")
            field = req.get("field")
            value = req.get("value")

            if not sutta_id or not field:
                return self.send_json_response({"error": "Missing sutta_id or field"}, 400)

            json_path = get_sutta_json_path(sutta_id, lang)
            if not json_path:
                return self.send_json_response({"error": f"Sutta JSON path not found for {sutta_id}"}, 404)

            existing = {}
            if json_path.exists():
                with open(json_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)

            target_key = FIELD_KEY_MAP.get(field, field)
            existing[target_key] = value
            existing["last_edited_timestamp"] = int(time.time() * 1000)

            atomic_write(json_path, existing)
            sync_matrix_csv()

            self.send_json_response({"status": "ok", "message": f"Updated {field} for {sutta_id}"})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_upload(self):
        try:
            req = self.read_json_body()
            sutta_id = req.get("sutta_id")
            field = req.get("field", "image")
            filename = req.get("filename")
            b64_content = req.get("content_base64")
            
            file_bytes = base64.b64decode(b64_content) if b64_content else None
            if not sutta_id or not file_bytes:
                return self.send_json_response({"error": "Missing sutta_id or file data"}, 400)

            sutta_dir, row = find_sutta_dir(sutta_id)
            if not sutta_dir:
                return self.send_json_response({"error": f"Sutta dir not found for {sutta_id}"}, 404)

            sutta_dir.mkdir(parents=True, exist_ok=True)
            ext = Path(filename).suffix.lower() if filename else ".png"

            if ext in [".png", ".jpg", ".jpeg", ".webp"]:
                if field in ["knowledge_graph", "graph", "tree"]:
                    target_file = sutta_dir / f"{sutta_dir.name}_graph{ext}"
                    with open(target_file, "wb") as f:
                        f.write(file_bytes)
                else:
                    target_file = sutta_dir / f"{sutta_dir.name}_image{ext}"
                    with open(target_file, "wb") as f:
                        f.write(file_bytes)
                    
                    rel_path = target_file.relative_to(BUDDHA3_DIR).as_posix()
                    json_path = get_sutta_json_path(sutta_id, "en")
                    if json_path and json_path.exists():
                        with open(json_path, "r", encoding="utf-8") as jf:
                            jdata = json.load(jf)
                        jdata["image_url"] = rel_path
                        atomic_write(json_path, jdata)
            elif ext in [".mp4", ".mp3", ".m4a"]:
                target_file = sutta_dir / f"{sutta_dir.name}{ext}"
                with open(target_file, "wb") as f:
                    f.write(file_bytes)
                json_path = get_sutta_json_path(sutta_id, "en")
                if json_path and json_path.exists():
                    with open(json_path, "r", encoding="utf-8") as jf:
                        jdata = json.load(jf)
                    jdata["aud_file"] = target_file.name
                    atomic_write(json_path, jdata)
            else:
                target_file = sutta_dir / (filename or "upload.bin")
                with open(target_file, "wb") as f:
                    f.write(file_bytes)

            sync_matrix_csv()
            self.send_json_response({"status": "ok", "message": f"Uploaded {target_file.name} to {sutta_id}"})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_rerun(self):
        try:
            req = self.read_json_body()
            sutta_id = req.get("sutta_id")
            field = req.get("field")
            prompt_template = req.get("prompt", "")

            if not sutta_id or not field:
                return self.send_json_response({"error": "Missing sutta_id or field"}, 400)

            key = get_gemini_key()
            if not key:
                return self.send_json_response({"error": "Gemini API key not found in gemini_api_key.txt"}, 400)

            lang = req.get("lang", "en")
            sutta_dir, row = find_sutta_dir(sutta_id)
            json_path = get_sutta_json_path(sutta_id, lang)
            
            existing = {}
            if json_path and json_path.exists():
                with open(json_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)

            transcript = existing.get("transcript_original") or existing.get("transcript") or existing.get("sutta") or ""
            if len(transcript) > MAX_RERUN_TRANSCRIPT_LENGTH:
                transcript = transcript[:HALF_RERUN_TRANSCRIPT_LENGTH] + "\n\n[OMITTED TRANSCRIPT SECTION]\n\n" + transcript[-HALF_RERUN_TRANSCRIPT_LENGTH:]

            formatted_prompt = prompt_template.replace("{sid}", sutta_id).replace("{transcript}", transcript)
            if lang in ["ja", "jp"]:
                formatted_prompt += "\n\nCRITICAL INSTRUCTION: Output your entire response in fluent Japanese (日本語)."

            target_key = FIELD_KEY_MAP.get(field, field)

            if target_key == "image_url":
                payload = {
                    "contents": [{"parts": [{"text": f"Generate a detailed visual artwork prompt for Sutta {sutta_id}: {formatted_prompt}"}]}],
                    "generationConfig": {"temperature": 0.3}
                }
                art_prompt = call_gemini_api(payload, key)
                clean_p = urllib.parse.quote(art_prompt[:MAX_PROMPT_IMAGE_LENGTH].replace("\n", " "))
                img_gen_url = f"https://image.pollinations.ai/prompt/{clean_p}?width={IMAGE_GENERATION_WIDTH}&height={IMAGE_GENERATION_HEIGHT}&nologo=true"
                
                if sutta_dir:
                    target_file1 = sutta_dir / f"{sutta_dir.name}_image.png"
                    try:
                        req_img = urllib.request.Request(img_gen_url, headers={"User-Agent": "Mozilla/5.0"})
                        with urllib.request.urlopen(req_img, timeout=20) as resp_img:
                            file_bytes = resp_img.read()
                        with open(target_file1, "wb") as f:
                            f.write(file_bytes)
                        existing["image_url"] = target_file1.relative_to(BUDDHA3_DIR).as_posix()
                    except Exception:
                        existing["image_url"] = img_gen_url
                else:
                    existing["image_url"] = img_gen_url

            elif target_key == "knowledge_graph":
                payload = {
                    "contents": [{"parts": [{"text": formatted_prompt}]}],
                    "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
                }
                text_output = call_gemini_api(payload, key)
                try:
                    s_idx = text_output.find("{")
                    e_idx = text_output.rfind("}")
                    if s_idx != -1 and e_idx != -1:
                        existing["knowledge_graph"] = json.loads(text_output[s_idx:e_idx+1])
                    else:
                        existing["knowledge_graph"] = text_output
                except Exception:
                    existing["knowledge_graph"] = text_output

            else:
                payload = {
                    "contents": [{"parts": [{"text": formatted_prompt}]}],
                    "generationConfig": {"temperature": 0.2}
                }
                text_output = call_gemini_api(payload, key)
                if target_key == "quiz":
                    try:
                        s_idx = text_output.find("{")
                        e_idx = text_output.rfind("}")
                        if s_idx != -1 and e_idx != -1:
                            existing["quiz"] = json.loads(text_output[s_idx:e_idx+1])
                        else:
                            existing["quiz"] = text_output
                    except Exception:
                        existing["quiz"] = text_output
                else:
                    existing[target_key] = text_output

            if json_path:
                atomic_write(json_path, existing)
                sync_matrix_csv()

            self.send_json_response({"status": "ok", "field": field, "data": existing[target_key]})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_clone(self):
        try:
            req = self.read_json_body()
            sutta_id = req.get("sutta_id")
            target_lang = req.get("target_lang", "jp").lower()

            if not sutta_id:
                return self.send_json_response({"error": "Missing sutta_id"}, 400)

            sutta_dir, row = find_sutta_dir(sutta_id)
            if not sutta_dir:
                return self.send_json_response({"error": f"Sutta dir not found for {sutta_id}"}, 404)

            lang_dir = sutta_dir / target_lang
            lang_dir.mkdir(parents=True, exist_ok=True)

            eleven_key = get_eleven_key()
            
            en_json = get_sutta_json_path(sutta_id, "en")
            base_data = {}
            if en_json and en_json.exists():
                with open(en_json, "r", encoding="utf-8") as f:
                    base_data = json.load(f)

            target_json = lang_dir / f"{sutta_dir.name}.json"
            base_data["language"] = target_lang
            if target_lang in ["jp", "ja"]:
                base_data["sutta_name"] = f"（JP） " + (base_data.get("sutta_name") or sutta_id)
            else:
                base_data["sutta_name"] = f"[{target_lang.upper()}] " + (base_data.get("sutta_name") or sutta_id)

            atomic_write(target_json, base_data)
            sync_matrix_csv()

            self.send_json_response({"status": "ok", "target_lang": target_lang, "message": f"Cloned track for {target_lang.upper()}"})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_chat(self):
        try:
            req = self.read_json_body()
            sutta_id = req.get("sutta_id")
            messages = req.get("messages", [])

            if not sutta_id:
                return self.send_json_response({"error": "Missing sutta_id"}, 400)

            key = get_gemini_key()
            if not key:
                return self.send_json_response({"error": "Gemini API key not found in gemini_api_key.txt"}, 400)

            json_path = get_sutta_json_path(sutta_id, "en")
            sutta_context = "{}"
            if json_path and json_path.exists():
                with open(json_path, "r", encoding="utf-8") as f:
                    sutta_context = f.read()

            system_instruction = f"""You are a wise and compassionate Dhamma teacher. Answer the user's questions strictly using the provided sutta scripture and teacher commentary context. Do not invent doctrine.

[SUTTA CONTEXT DATA]:
{sutta_context}"""

            contents = []
            for msg in messages:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

            payload = {
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "contents": contents,
                "generationConfig": {"temperature": 0.3}
            }

            reply = call_gemini_api(payload, key)
            self.send_json_response({"status": "ok", "reply": reply})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_home_chat(self):
        try:
            req = self.read_json_body()
            messages = req.get("messages", [])
            context_json = req.get("context_json", {})
            
            ollama_model = "llama3"
            try:
                tags_req = urllib.request.Request("http://localhost:11434/api/tags")
                with urllib.request.urlopen(tags_resp, timeout=3) as tags_resp:
                    tags_data = json.loads(tags_resp.read().decode("utf-8"))
                    models = tags_data.get("models", [])
                    if models:
                        ollama_model = models[0].get("name", "llama3")
            except Exception:
                pass

            last_user_msg = messages[-1].get("content", "") if messages else "Hello"
            
            prompt_text = f"""[SYSTEM INSTRUCTION]: You are a Dhamma research assistant. Answer user queries strictly based on the provided Nikaya corpus context.

[RETRIEVED CORPUS CONTEXT]:
{json.dumps(context_json, ensure_ascii=False)[:12000]}

[USER QUERY]: {last_user_msg}"""

            ollama_url = "http://localhost:11434/api/generate"
            ollama_payload = {
                "model": ollama_model,
                "prompt": prompt_text,
                "stream": False
            }

            req_obj = urllib.request.Request(
                ollama_url,
                data=json.dumps(ollama_payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            
            try:
                with urllib.request.urlopen(req_obj, timeout=90) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    reply = res_data.get("response", "No response generated.")
                    return self.send_json_response({"status": "ok", "reply": reply, "model": ollama_model})
            except Exception:
                fallback_msg = f"[Ollama local model '{ollama_model}' not responding. Please run 'ollama serve' locally to enable home RAG chatbot.]"
                return self.send_json_response({"status": "ok", "reply": fallback_msg, "model": "offline"})

        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)


def main():
    parser = argparse.ArgumentParser(description="DAMA Sutta Pipeline & Dev Server")
    parser.add_argument("--serve", action="store_true", help="Run dev HTTP server")
    parser.add_argument("--port", type=int, default=DEFAULT_SERVER_PORT, help=f"Port to run dev HTTP server on (default: {DEFAULT_SERVER_PORT})")
    parser.add_argument("--download-all", action="store_true", help="Download raw MP4 video/audio and raw SRT/VTT subtitles into frontendoptimised2/downloads/ for all registered youtube_ids in sutta_status_matrix.csv in parallel")
    parser.add_argument("--organize", action="store_true", help="Organize raw downloads into individual sutta folders and prepare baseline JSON files")
    parser.add_argument("--generate-sutta", type=str, help="Generate structured JSON for a specific sutta by ID (e.g. 'AN 5.4.40')")
    parser.add_argument("--generate-all-raw", action="store_true", help="Generate Sutta JSONs for all suttas in sutta_status_matrix.csv currently marked RAW or GHOST")
    parser.add_argument("--sync-csv", "--sync-master", action="store_true", help="Synchronize sutta_status_matrix.csv with disk asset states")
    parser.add_argument("--flush", action="store_true", help="Flush existing target JSON files before generating")
    args = parser.parse_args()

    if args.organize:
        organize_suttas()
        return 0

    if args.sync_csv:
        sync_matrix_csv()
        return 0

    if args.download_all:
        return download_all()

    if args.generate_sutta:
        res = generate_sutta_json(args.generate_sutta, flush=args.flush)
        return res

    if args.generate_all_raw:
        rows = read_csv_mapping()
        raw_suttas = [r["sutta_id"] for r in rows if r.get("status") in ["RAW", "GHOST"]]
        print(f"Generating Sutta JSONs for {len(raw_suttas)} suttas...")
        for idx, sid in enumerate(raw_suttas, 1):
            print(f"\n[{idx}/{len(raw_suttas)}] Generating {sid}...")
            try:
                generate_sutta_json(sid, flush=args.flush)
            except Exception as ex:
                print(f"Error generating {sid}: {ex}")
            time.sleep(2)
        return 0

    if args.serve:
        sync_matrix_csv()
        print(f"Starting DAMA Dev Server on http://localhost:{args.port} (serving root: {BUDDHA3_DIR})")
        httpd = HTTPServer(("0.0.0.0", args.port), DevServerHandler)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down DAMA Dev Server.")
            httpd.server_close()
        return 0
    else:
        sync_matrix_csv()
        return 0

if __name__ == "__main__":
    sys.exit(main())
