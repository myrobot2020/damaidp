from __future__ import annotations

"""
HTTP contract tests against a running server (see conftest.py for SMOKE_BASE_URL).

- Default query tests use use_llm=False so they do not require Ollama or Vertex LLM.
- Set SMOKE_WITH_LLM=1 to exercise the LLM path (local + Ollama at OLLAMA_BASE_URL unless using Vertex LLM).

Regression for empty retrieval + LLM: tests/test_query_llm_fallback.py (no server; mocks retrieval).

LLM backend must be up for the configured provider: tests/test_llm_backend_available.py (GET /api/index_status: llm_provider, ollama_ok).
"""

import os
from typing import Any, Dict

import pytest
import requests

from tests._helpers import require_no_auth_or_skip


def test_index_status_contract(http: requests.Session, base_url: str) -> None:
    r = http.get(f"{base_url}/api/index_status", timeout=15)
    require_no_auth_or_skip(r)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
    assert "exists" in data
    assert isinstance(data["exists"], bool)
    assert data.get("mode") in ("local_chroma", "vertex")
    assert data.get("llm_provider") in ("ollama", "vertex")
    if data.get("llm_provider") == "ollama":
        assert "ollama_ok" in data


@pytest.mark.parametrize(
    "payload",
    [
        {"question": "what did buddha say about water?", "book": "all", "k": 3, "use_llm": False},
        {"question": "hi", "book": "all", "k": 3, "use_llm": False},
    ],
)
def test_query_contract_smoke(http: requests.Session, base_url: str, payload: Dict[str, Any]) -> None:
    # Allow a long timeout: first request may cold-load embedding models.
    timeout = 300
    if os.environ.get("SMOKE_WITH_LLM", "").strip().lower() in ("1", "true", "yes", "on"):
        payload = dict(payload)
        payload["use_llm"] = True
        timeout = 600
    r = http.post(f"{base_url}/api/query", json=payload, timeout=timeout)
    require_no_auth_or_skip(r)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, dict)
    assert "chunks" in data and isinstance(data["chunks"], list)
    assert "answer" in data and isinstance(data["answer"], str)
    assert "used_llm" in data and isinstance(data["used_llm"], bool)
    assert "timings_ms" in data and isinstance(data["timings_ms"], dict)
    assert "total_ms" in data["timings_ms"]
    assert "retrieve_ms" in data["timings_ms"] or payload.get("question") == "hi"


def test_query_timings_contract_when_enabled(http: requests.Session, base_url: str) -> None:
    """
    Timings are dev-only / local-only (or opt-in via env), so this test asserts the shape
    *when timings_ms is present* and skips otherwise.
    """
    payload: Dict[str, Any] = {"question": "what did buddha say about water?", "book": "all", "k": 3, "use_llm": False}
    timeout = 300
    if os.environ.get("SMOKE_WITH_LLM", "").strip().lower() in ("1", "true", "yes", "on"):
        payload = dict(payload)
        payload["use_llm"] = True
        timeout = 600

    r = http.post(f"{base_url}/api/query", json=payload, timeout=timeout)
    require_no_auth_or_skip(r)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, dict)

    tm = data.get("timings_ms")
    assert isinstance(tm, dict)

    # Always expected when timings are enabled.
    assert "total_ms" in tm
    assert "retrieve_ms" in tm

    used_llm = bool(data.get("used_llm"))
    if used_llm:
        # New breakdown fields for perf work.
        assert "prompt_build_ms" in tm
        assert "llm_first_token_ms" in tm
        assert "llm_done_ms" in tm
        assert "post_citations_ms" in tm
