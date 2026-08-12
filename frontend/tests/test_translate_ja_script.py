from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts2" / "16_translate_ja.py"


def load_module():
    spec = importlib.util.spec_from_file_location("translate_ja", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["translate_ja"] = module
    spec.loader.exec_module(module)
    return module


def test_chunk_text_splits_long_text_without_losing_words():
    mod = load_module()
    chunks = mod.chunk_text("First sentence. Second sentence. Third sentence.", max_chars=25)

    assert chunks == ["First sentence.", "Second sentence.", "Third sentence."]


def test_output_path_mirrors_validated_tree():
    mod = load_module()
    source = mod.VALIDATED_ROOT / "an" / "an1" / "1.48.json"

    assert mod.output_path_for(source) == mod.TRANSLATION_ROOT / "an" / "an1" / "1.48.ja.json"


def test_echo_translator_keeps_text_for_dry_runs():
    mod = load_module()
    translator = mod.EchoTranslator()

    assert translator.translate("Monks, the mind changes quickly.") == "Monks, the mind changes quickly."
