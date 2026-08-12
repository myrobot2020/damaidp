from __future__ import annotations

import re

import requests

from tests._helpers import require_no_auth_or_skip


def test_app_serves_chat_embed_html(http: requests.Session, base_url: str) -> None:
    r = http.get(f"{base_url}/app", timeout=20, allow_redirects=False)
    # If auth is on, /app may redirect to / or return 302; treat as auth-protected.
    if r.status_code in (301, 302, 303, 307, 308):
        # Likely redirect to landing when not logged in.
        return
    require_no_auth_or_skip(r)
    assert r.status_code == 200
    ct = (r.headers.get("content-type") or "").lower()
    assert "text/html" in ct


def test_citation_linkifier_code_present(http: requests.Session, base_url: str) -> None:
    r = http.get(f"{base_url}/app", timeout=20)
    if r.status_code in (301, 302, 303, 307, 308):
        return
    require_no_auth_or_skip(r)
    assert r.status_code == 200
    html = r.text or ""

    # Ensure we served the updated citation helper that supports non-parenthesized citations.
    assert "function linkifyCitationsInElement" in html
    assert '<script src="/static/ui_linkify.js"></script>' in html
    assert "normalizeSuttaCiteRef(" in html

    # Ensure the regex allows bare AN/cAN/pAN citations.
    # Match the JS regex literal as text (avoid brittle escaping rules inside the HTML).
    assert r"/\b(cAN|pAN|AN)\s*\d+(?:\.\d+)*\b/gi" in html, "Expected bare citation regex in served HTML"


def test_citation_highlight_hint_wiring_present(http: requests.Session, base_url: str) -> None:
    r = http.get(f"{base_url}/app", timeout=20)
    if r.status_code in (301, 302, 303, 307, 308):
        return
    require_no_auth_or_skip(r)
    assert r.status_code == 200
    html = r.text or ""

    # The UI should embed code that attaches per-citation highlight hints based on retrieval chunks.
    assert "function enrichCiteHintsFromChunks" in html
    assert "data-cite-hint" in html
    assert "encodeURIComponent(" in html
    # The query response should pass chunks into appendMsg meta so hints can be derived per message.
    assert "chunks: chunks" in html


def test_chat_timing_breakdown_labels_present(http: requests.Session, base_url: str) -> None:
    """
    Contract: the UI should contain the comma-separated timing breakdown labels so the feature
    doesn't silently regress in the served HTML.
    """
    r = http.get(f"{base_url}/app", timeout=20)
    if r.status_code in (301, 302, 303, 307, 308):
        return
    require_no_auth_or_skip(r)
    assert r.status_code == 200
    html = r.text or ""

    # Labels used in the status line (comma-separated).
    assert "Total " in html
    assert "Retrieval " in html
    assert "Prompt build " in html
    assert "LLM first-token " in html
    assert "Post/citations " in html
    assert "Render " in html
