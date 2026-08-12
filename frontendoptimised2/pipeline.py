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
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Paths relative to this file
ROOT = Path(__file__).resolve().parent
BUDDHA3_DIR = ROOT.parent
MAPPING_PATH = ROOT / "master.json"
GEMINI_KEY_FILE = BUDDHA3_DIR / "gemini_api_key.txt"
ELEVEN_KEY_FILE = BUDDHA3_DIR / "11labskey.txt"

def get_gemini_key():
    if os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY").strip():
        return os.getenv("GEMINI_API_KEY").strip()
    if GEMINI_KEY_FILE.exists() and GEMINI_KEY_FILE.read_text(encoding="utf-8").strip():
        return GEMINI_KEY_FILE.read_text(encoding="utf-8").strip()
    buddha_key = BUDDHA3_DIR.parent / "buddha" / "gemini_api_key.txt"
    if buddha_key.exists() and buddha_key.read_text(encoding="utf-8").strip():
        return buddha_key.read_text(encoding="utf-8").strip()
    return None

def call_gemini_api(payload: dict, key: str) -> str:
    models = ["gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-1.5-flash"]
    last_err = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        req_obj = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-goog-api-key": key
            }
        )
        try:
            with urllib.request.urlopen(req_obj, timeout=60) as resp:
                result_raw = json.loads(resp.read().decode("utf-8"))
                return result_raw["candidates"][0]["content"]["parts"][0]["text"].strip()
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            last_err = RuntimeError(f"Gemini {model} error ({e.code}): {err_body}")
            continue
    if last_err:
        raise last_err
    raise RuntimeError("Gemini API call failed")

def get_eleven_key():
    if os.getenv("ELEVENLABS_API_KEY"):
        return os.getenv("ELEVENLABS_API_KEY").strip()
    if ELEVEN_KEY_FILE.exists():
        return ELEVEN_KEY_FILE.read_text(encoding="utf-8").strip()
    return None

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

def sync_master_json():
    if not MAPPING_PATH.exists():
        return
    with open(MAPPING_PATH, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    nikaya_folders = mapping.get("config", {}).get("nikaya_folders", {})
    entries = mapping.get("entries", {})
    
    complete_count = 0
    raw_count = 0
    ghost_count = 0
    
    for sutta_id, entry in entries.items():
        nik = entry.get("nikaya")
        folder = entry.get("folder")
        
        if not nik or not folder or nik not in nikaya_folders:
            entry["status"] = "GHOST"
            entry["languages"] = {}
            ghost_count += 1
            continue
            
        sutta_dir = BUDDHA3_DIR / nikaya_folders[nik] / folder
        if not sutta_dir.is_dir():
            entry["status"] = "GHOST"
            entry["languages"] = {}
            ghost_count += 1
            continue
            
        languages = {}
        sutta_name_from_json = ""
        last_edited = 0
        
        for p in sutta_dir.rglob("*.json"):
            if p.is_file():
                rel_path = p.relative_to(BUDDHA3_DIR).as_posix()
                parent_name = p.parent.name
                lang = "en" if parent_name == folder else parent_name
                languages[lang] = rel_path
                
                mtime = int(p.stat().st_mtime * 1000)
                if mtime > last_edited:
                    last_edited = mtime
                
                if lang == "en" or not sutta_name_from_json:
                    try:
                        with open(p, "r", encoding="utf-8") as jf:
                            js_data = json.load(jf)
                            s_name = js_data.get("sutta_name") or js_data.get("names", {}).get("official", "")
                            if s_name:
                                sutta_name_from_json = s_name.strip()
                    except Exception:
                        pass
                        
        json_exists = len(languages) > 0
        mp4_exists = any(p.is_file() and p.stat().st_size > 0 for p in sutta_dir.glob("*.mp4"))
        srt_exists = any(p.is_file() and p.stat().st_size > 0 for p in sutta_dir.glob("*.srt"))
        
        status = "GHOST"
        if json_exists:
            if sutta_id == "AN 5.4.40" and mp4_exists and srt_exists:
                status = "COMPLETE"
                complete_count += 1
            else:
                status = "RAW"
                raw_count += 1
        else:
            status = "GHOST"
            ghost_count += 1
            
        entry["status"] = status
        entry["languages"] = languages
        entry["last_edited_timestamp"] = last_edited
        if sutta_name_from_json:
            entry["title"] = sutta_name_from_json
            
    atomic_write(MAPPING_PATH, mapping)
    print(f"Master registry updated (COMPLETE: {complete_count}, RAW: {raw_count}, GHOST: {ghost_count})")

def find_sutta_dir(sutta_id: str):
    if not MAPPING_PATH.exists():
        return None, None
    with open(MAPPING_PATH, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    entry = mapping.get("entries", {}).get(sutta_id)
    if not entry:
        return None, None
    nik = entry.get("nikaya")
    folder = entry.get("folder")
    nik_folders = mapping.get("config", {}).get("nikaya_folders", {})
    if nik and folder and nik in nik_folders:
        sutta_dir = BUDDHA3_DIR / nik_folders[nik] / folder
        return sutta_dir, entry
    return None, entry

def get_sutta_json_path(sutta_id: str, lang: str = "en"):
    sutta_dir, entry = find_sutta_dir(sutta_id)
    if not sutta_dir or not sutta_dir.exists():
        return None
    if lang == "en":
        target = sutta_dir / f"{sutta_dir.name}.json"
        if not target.exists():
            # Try any json in sutta_dir root
            jsons = list(sutta_dir.glob("*.json"))
            if jsons:
                return jsons[0]
        return target
    else:
        target = sutta_dir / lang / f"{sutta_dir.name}.json"
        return target

class DevServerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BUDDHA3_DIR), **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
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
        
        if path == "/api/save":
            self.handle_save()
        elif path == "/api/upload":
            self.handle_upload()
        elif path == "/api/rerun":
            self.handle_rerun()
        elif path == "/api/clone":
            self.handle_clone()
        elif path == "/api/chat":
            self.handle_chat()
        elif path == "/api/home_chat":
            self.handle_home_chat()
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

            # Field key mapping
            key_map = {
                "sutta": "sutta",
                "commentary": "commentary",
                "quiz": "quiz",
                "tree": "knowledge_graph",
                "knowledge_graph": "knowledge_graph",
                "sc_url": "sc_url",
                "image": "image_url",
                "image_url": "image_url"
            }
            target_key = key_map.get(field, field)
            existing[target_key] = value
            existing["last_edited_timestamp"] = int(time.time() * 1000)

            atomic_write(json_path, existing)
            sync_master_json()

            self.send_json_response({"status": "ok", "message": f"Updated {field} for {sutta_id}"})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_upload(self):
        try:
            content_type = self.headers.get("Content-Type", "")
            sutta_id = None
            field = None
            filename = None
            file_bytes = None

            req = self.read_json_body()
            sutta_id = req.get("sutta_id")
            field = req.get("field")
            filename = req.get("filename")
            b64_content = req.get("content_base64")
            if b64_content:
                file_bytes = base64.b64decode(b64_content)

            if not sutta_id or not file_bytes:
                return self.send_json_response({"error": "Missing sutta_id or file data"}, 400)

            sutta_dir, entry = find_sutta_dir(sutta_id)
            if not sutta_dir:
                return self.send_json_response({"error": f"Sutta dir not found for {sutta_id}"}, 404)

            sutta_dir.mkdir(parents=True, exist_ok=True)
            
            ext = Path(filename).suffix.lower() if filename else ".png"
            if ext in [".png", ".jpg", ".jpeg", ".webp"]:
                target_file1 = sutta_dir / f"{sutta_dir.name}_image{ext}"
                target_file2 = sutta_dir / f"{sutta_dir.name}_graph{ext}"
                with open(target_file1, "wb") as f:
                    f.write(file_bytes)
                with open(target_file2, "wb") as f:
                    f.write(file_bytes)
                
                target_file = target_file1
                rel_path = target_file1.relative_to(BUDDHA3_DIR).as_posix()
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

            sync_master_json()
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
            sutta_dir, entry = find_sutta_dir(sutta_id)
            json_path = get_sutta_json_path(sutta_id, lang)
            existing = {}
            if json_path and json_path.exists():
                with open(json_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)

            transcript = existing.get("transcript") or existing.get("sutta") or ""
            if len(transcript) > 12000:
                transcript = transcript[:6000] + "\n\n[OMITTED TRANSCRIPT SECTION]\n\n" + transcript[-6000:]

            formatted_prompt = prompt_template.replace("{sid}", sutta_id).replace("{transcript}", transcript)
            if lang in ["ja", "jp"]:
                formatted_prompt += "\n\nCRITICAL INSTRUCTION: Output your entire response in fluent Japanese (日本語). Format all text and fields in natural Japanese."

            payload = {
                "contents": [{"parts": [{"text": formatted_prompt}]}],
                "generationConfig": {"temperature": 0.2}
            }

            text_output = call_gemini_api(payload, key)

            key_map = {
                "sutta": "sutta",
                "transcript": "transcript",
                "commentary": "commentary",
                "quiz": "quiz",
                "tree": "knowledge_graph",
                "knowledge_graph": "knowledge_graph",
                "image": "image_url"
            }
            target_key = key_map.get(field, field)

            if target_key in ["quiz", "knowledge_graph"]:
                try:
                    s_idx = text_output.find("{")
                    e_idx = text_output.rfind("}")
                    if s_idx != -1 and e_idx != -1:
                        existing[target_key] = json.loads(text_output[s_idx:e_idx+1])
                    else:
                        existing[target_key] = text_output
                except Exception:
                    existing[target_key] = text_output
            elif target_key == "image_url":
                clean_p = urllib.parse.quote(text_output[:220].replace("\n", " "))
                img_gen_url = f"https://image.pollinations.ai/prompt/{clean_p}?width=800&height=600&nologo=true"
                
                if sutta_dir:
                    target_file1 = sutta_dir / f"{sutta_dir.name}_image.png"
                    target_file2 = sutta_dir / f"{sutta_dir.name}_graph.png"
                    try:
                        req_img = urllib.request.Request(img_gen_url, headers={"User-Agent": "Mozilla/5.0"})
                        with urllib.request.urlopen(req_img, timeout=20) as resp_img:
                            file_bytes = resp_img.read()
                        with open(target_file1, "wb") as f:
                            f.write(file_bytes)
                        with open(target_file2, "wb") as f:
                            f.write(file_bytes)
                        existing["image_url"] = target_file1.relative_to(BUDDHA3_DIR).as_posix()
                    except Exception:
                        existing["image_url"] = img_gen_url
                else:
                    existing["image_url"] = img_gen_url
            else:
                existing[target_key] = text_output

            if json_path:
                atomic_write(json_path, existing)
                sync_master_json()

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

            sutta_dir, entry = find_sutta_dir(sutta_id)
            if not sutta_dir:
                return self.send_json_response({"error": f"Sutta dir not found for {sutta_id}"}, 404)

            lang_dir = sutta_dir / target_lang
            lang_dir.mkdir(parents=True, exist_ok=True)

            eleven_key = get_eleven_key()
            
            # Copy base English JSON to target language directory with translated placeholders
            en_json = get_sutta_json_path(sutta_id, "en")
            base_data = {}
            if en_json and en_json.exists():
                with open(en_json, "r", encoding="utf-8") as f:
                    base_data = json.load(f)

            target_json = lang_dir / f"{sutta_dir.name}.json"
            base_data["language"] = target_lang
            if target_lang == "jp":
                base_data["sutta_name"] = f"（{target_lang.upper()}） " + (base_data.get("sutta_name") or sutta_id)
            else:
                base_data["sutta_name"] = f"[{target_lang.upper()}] " + (base_data.get("sutta_name") or sutta_id)

            atomic_write(target_json, base_data)
            sync_master_json()

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
            
            # Detect available Ollama models
            ollama_model = "llama3"
            try:
                tags_req = urllib.request.Request("http://localhost:11434/api/tags")
                with urllib.request.urlopen(tags_req, timeout=3) as tags_resp:
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
            except Exception as o_err:
                # Fallback notice if Ollama server is offline
                fallback_msg = f"[Ollama local model '{ollama_model}' not responding. Please run 'ollama serve' locally to enable home RAG chatbot. Context parsed: {len(context_json)} entries.]"
                return self.send_json_response({"status": "ok", "reply": fallback_msg, "model": "offline"})

        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)


def main():
    parser = argparse.ArgumentParser(description="DAMA Sutta Pipeline & Dev Server")
    parser.add_argument("--serve", action="store_true", help="Run dev HTTP server")
    parser.add_argument("--port", type=int, default=8000, help="Port to run dev HTTP server on (default: 8000)")
    parser.add_argument("--download-all", action="store_true", help="Download media and text transcripts for all Nikayas into downloads/ directory")
    args = parser.parse_args()

    if args.download_all:
        root_pipeline = BUDDHA3_DIR / "pipeline.py"
        if root_pipeline.exists():
            subprocess.run([sys.executable, str(root_pipeline), "--download-all"])
        return 0

    if args.serve:
        sync_master_json()
        print(f"Starting DAMA Dev Server on http://localhost:{args.port} (serving root: {BUDDHA3_DIR})")
        httpd = HTTPServer(("0.0.0.0", args.port), DevServerHandler)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down DAMA Dev Server.")
            httpd.server_close()
        return 0
    else:
        sync_master_json()
        return 0

if __name__ == "__main__":
    sys.exit(main())
