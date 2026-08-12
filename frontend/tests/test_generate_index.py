from __future__ import annotations

import importlib.util
import json
from pathlib import Path


def load_generate_index_module():
    root = Path(__file__).resolve().parents[1]
    path = root / "scripts2" / "generate_index.py"
    spec = importlib.util.spec_from_file_location("generate_index", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def write_json(path: Path, obj: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj), encoding="utf-8")


def test_build_index_uses_only_publishable_existing_json_files(tmp_path: Path) -> None:
    mod = load_generate_index_module()
    root = tmp_path / "validated-json"

    write_json(
        root / "an" / "an1" / "1.48.json",
        {
            "sutta_id": "1.48",
            "sutta_name_en": "Mind Changes Quickly",
            "sutta": "Bhikkhus, I do not see even a single thing that changes so quickly as the mind.",
            "commentary": "Teacher note.",
            "aud_file": "clip.mp3",
            "valid": True,
        },
    )
    write_json(
        root / "an" / "an1" / "1.21.48.json",
        {
            "sutta_id": "1.21.48",
            "sutta_name_en": "Missing Audio",
            "sutta": "This should not be indexed.",
            "commentary": "",
            "aud_file": "",
            "valid": True,
        },
    )
    write_json(
        root / "sn" / "sn1" / "suttas" / "1.1.json",
        {
            "sutta_id": "SN 1.1",
            "sutta_name_en": "Crossing the Flood",
            "sutta": "A publishable SN text.",
            "commentary": "",
            "aud_file": "sn.mp3",
            "valid": "yes",
        },
    )
    (root / "an" / "an1" / "broken.json").write_text("{bad json", encoding="utf-8")

    index = mod.build_index(root)

    items = index["items"]
    rows = index["searchRows"]
    assert items == [
        {
            "suttaid": "AN 1.48",
            "title": "Mind Changes Quickly sutta",
            "has_commentary": True,
            "nikaya": "AN",
        },
        {
            "suttaid": "SN 1.1",
            "title": "Crossing the Flood sutta",
            "has_commentary": False,
            "nikaya": "SN",
        },
    ]
    assert [row["suttaid"] for row in rows] == ["AN 1.48", "SN 1.1"]
    assert "mind changes quickly" not in rows[0]["blob"]
    assert "bhikkhus" in rows[0]["blob"]
