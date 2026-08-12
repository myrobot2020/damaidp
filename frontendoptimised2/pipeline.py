#!/usr/bin/env python3
import os
import sys
import json
import tempfile
from pathlib import Path

# Paths relative to this file
ROOT = Path(__file__).resolve().parent
BUDDHA3_DIR = ROOT.parent
MAPPING_PATH = ROOT / "master.json"

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

def main():
    if not MAPPING_PATH.exists():
        print(f"Error: {MAPPING_PATH} not found. Please run the merge catalog script first.", file=sys.stderr)
        return 1

    print("Loading master registry from master.json...")
    with open(MAPPING_PATH, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    nikaya_folders = mapping.get("config", {}).get("nikaya_folders", {})
    entries = mapping.get("entries", {})
    
    print(f"Scanning directories for {len(entries)} suttas...")
    
    updated_count = 0
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
            
        # Target folder path
        sutta_dir = BUDDHA3_DIR / nikaya_folders[nik] / folder
        
        if not sutta_dir.is_dir():
            entry["status"] = "GHOST"
            entry["languages"] = {}
            ghost_count += 1
            continue
            
        # Scan for JSON files and detect languages/translations
        languages = {}
        sutta_name_from_json = ""
        
        # Walk sutta_dir to find any .json files (supporting translations like jp/5_4_40.json)
        for p in sutta_dir.rglob("*.json"):
            if p.is_file():
                rel_path = p.relative_to(BUDDHA3_DIR).as_posix()
                
                # Check if it's in a language subfolder or the main folder
                parent_name = p.parent.name
                if parent_name == folder:
                    lang = "en"  # Default is English
                else:
                    lang = parent_name  # Subfolder name becomes the language code (e.g. jp)
                    
                languages[lang] = rel_path
                
                # Extract official name if empty
                if lang == "en" or not sutta_name_from_json:
                    try:
                        with open(p, "r", encoding="utf-8") as jf:
                            js_data = json.load(jf)
                            s_name = js_data.get("sutta_name") or js_data.get("names", {}).get("official", "")
                            if s_name:
                                sutta_name_from_json = s_name.strip()
                    except Exception:
                        pass
                        
        # Check if assets exist
        json_exists = len(languages) > 0
        mp4_exists = False
        srt_exists = False
        
        # Check for MP4 video or audio
        for p in sutta_dir.glob("*.mp4"):
            if p.is_file() and p.stat().st_size > 0:
                mp4_exists = True
                break
                
        # Check for SRT subtitles
        for p in sutta_dir.glob("*.srt"):
            if p.is_file() and p.stat().st_size > 0:
                srt_exists = True
                break
                
        # Determine status
        status = "GHOST"
        if json_exists:
            if sutta_id == "AN 5.4.40" and mp4_exists and srt_exists:
                status = "COMPLETE"
                complete_count += 1
            else:
                status = "RAW"
                raw_count += 1
        else:
            ghost_count += 1
            
        # Update entry
        entry["status"] = status
        entry["languages"] = languages
        if sutta_name_from_json and not entry.get("title"):
            entry["title"] = sutta_name_from_json
            
        updated_count += 1
        
    print(f"Update complete. Stats:")
    print(f"  - COMPLETE (has JSON, MP4, SRT): {complete_count}")
    print(f"  - RAW (has JSON, missing MP4/SRT): {raw_count}")
    print(f"  - GHOST (missing data): {ghost_count}")
    
    print("Writing updated registry back to master.json...")
    atomic_write(MAPPING_PATH, mapping)
    print("Done!")

if __name__ == "__main__":
    sys.exit(main())
