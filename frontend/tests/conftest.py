from __future__ import annotations

import os
from typing import Iterator

import pytest
import requests

from tests._helpers import require_no_auth_or_skip  # re-export for convenience

def _base_url() -> str:
    return os.environ.get("SMOKE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


@pytest.fixture(scope="session")
def base_url() -> str:
    return _base_url()


@pytest.fixture(scope="session")
def http(base_url: str) -> Iterator[requests.Session]:
    s = requests.Session()
    try:
        r = s.get(f"{base_url}/api/index_status", timeout=8)
        r.raise_for_status()
    except OSError as e:
        pytest.skip(f"Cannot reach app at {base_url}: {e}")
    except requests.HTTPError as e:
        pytest.skip(f"Bad response from {base_url}/api/index_status: {e}")
    yield s


__all__ = ["require_no_auth_or_skip"]

