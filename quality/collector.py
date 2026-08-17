import json
from pathlib import Path
from typing import List, Dict, Any

def collect_from_directory(directory: Path) -> List[Dict[str, Any]]:
    artifacts = []
    for json_file in directory.rglob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "sutta_id" in data:
                    artifacts.append(data)
        except Exception:
            continue
    return artifacts
