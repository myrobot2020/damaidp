"""
Fail when the chat LLM backend the server is configured to use is not actually available:

- ``llm_provider == "ollama"`` (typical local dev): Ollama must respond at ``OLLAMA_BASE_URL``
  from the **API process** — see ``ollama_ok`` on ``GET /api/index_status``.
- ``mode == "vertex"`` (typical cloud RAG): the Vertex bundle must load — ``exists`` and no ``error``.

Set ``SKIP_LLM_BACKEND_CHECK=1`` to skip (e.g. CI that does not run Ollama).
Set ``RUN_LLM_BACKEND_CHECK=1`` to run the backend availability check.

Requires a running server; see ``tests/conftest.py`` / ``SMOKE_BASE_URL``.
"""

from __future__ import annotations

import os

import pytest

from tests._helpers import require_no_auth_or_skip


def test_index_status_reports_llm_provider(http, base_url: str) -> None:
    r = http.get(f"{base_url}/api/index_status", timeout=20)
    require_no_auth_or_skip(r)
    assert r.status_code == 200
    data = r.json()
    assert data.get("llm_provider") in ("ollama", "vertex")


def test_llm_backend_reachable_for_configured_provider(http, base_url: str) -> None:
    # Default: skip this test unless explicitly requested.
    #
    # Rationale: local Ollama can be intentionally off, restarting, or blocked by firewall,
    # and we don't want the whole suite to fail unless the developer opts in.
    if os.environ.get("RUN_LLM_BACKEND_CHECK", "").strip().lower() not in ("1", "true", "yes", "on"):
        pytest.skip("RUN_LLM_BACKEND_CHECK not set")

    r = http.get(f"{base_url}/api/index_status", timeout=20)
    require_no_auth_or_skip(r)
    assert r.status_code == 200
    data = r.json()
    mode = data.get("mode")
    lp = data.get("llm_provider")

    assert lp in ("ollama", "vertex"), f"unexpected llm_provider: {lp!r}"

    if lp == "ollama":
        assert data.get("ollama_ok") is True, (
            "Ollama is not reachable from the API process (ollama_ok is not true). "
            "Start Ollama, or set DAMA_OLLAMA_BASE_URL / OLLAMA_BASE_URL so the server matches your Ollama host."
        )

    if mode == "vertex":
        assert data.get("exists") is True, (
            "Vertex RAG bundle missing or empty. Rebuild or fix AN1_VERTEX_BUNDLE_GCS_URI / bundle path."
        )
        err = data.get("error")
        assert not err, f"Vertex bundle failed to load: {err}"

    if lp == "vertex" and mode == "local_chroma":
        # Vertex Gemini for LLM + local Chroma for retrieval — index must exist for queries.
        assert data.get("exists") is True, (
            "Local Chroma index is empty; build with POST /api/build while using Vertex LLM."
        )
