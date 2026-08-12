"""Tests for scripts/sn_playlist_sync.py helpers."""

from __future__ import annotations

import importlib.util
from pathlib import Path


def _load_sn_sync():
    repo = Path(__file__).resolve().parents[1]
    path = repo / "scripts" / "sn_playlist_sync.py"
    spec = importlib.util.spec_from_file_location("sn_playlist_sync_test", path)
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_sutta_id_and_rel() -> None:
    m = _load_sn_sync()
    assert m.sutta_id_and_rel(1) == ("SN 1.1", "sn/sn1/suttas/1.1.json")
    assert m.sutta_id_and_rel(2) == ("SN 1.2", "sn/sn1/suttas/1.2.json")
    assert m.sutta_id_and_rel(3) == ("SN 1.pl.3", "sn/sn1/suttas/1.pl.3.json")
    assert m.sutta_id_and_rel(58) == ("SN 1.pl.58", "sn/sn1/suttas/1.pl.58.json")


def test_title_from_playlist_row_strips_prefix() -> None:
    m = _load_sn_sync()
    raw = "Samyutta Nikaya 01 Devata Part 3 by Bhante Hye Dhammavuddho Mahathera"
    assert "Samyutta" not in m.title_from_playlist_row(raw)
    assert "Devata" in m.title_from_playlist_row(raw)


def test_corpus_row_valid_requires_vtt_audio_and_clip() -> None:
    m = _load_sn_sync()
    long_s = "x" * 50
    assert (
        m.corpus_row_valid(
            had_usable_vtt=True,
            sutta=long_s,
            aud_name="a.webm",
            audio_mapped_ok=True,
            aud_start=0.0,
            aud_end=60.0,
        )
        is True
    )
    assert (
        m.corpus_row_valid(
            had_usable_vtt=False,
            sutta=long_s,
            aud_name="a.webm",
            audio_mapped_ok=True,
            aud_start=0.0,
            aud_end=60.0,
        )
        is False
    )
    assert (
        m.corpus_row_valid(
            had_usable_vtt=True,
            sutta="short",
            aud_name="a.webm",
            audio_mapped_ok=True,
            aud_start=0.0,
            aud_end=60.0,
        )
        is False
    )
    assert (
        m.corpus_row_valid(
            had_usable_vtt=True,
            sutta=long_s,
            aud_name="a.webm",
            audio_mapped_ok=False,
            aud_start=0.0,
            aud_end=60.0,
        )
        is False
    )
    assert (
        m.corpus_row_valid(
            had_usable_vtt=True,
            sutta=long_s,
            aud_name="a.webm",
            audio_mapped_ok=True,
            aud_start=0.0,
            aud_end=0.0,
        )
        is False
    )


def test_segment_sutta_commentary_splits_stub() -> None:
    m = _load_sn_sync()
    stub = m.stub_transcript("Part 9")
    s, c = m.segment_sutta_commentary(stub)
    assert len(s) >= 10
    assert isinstance(c, str)
