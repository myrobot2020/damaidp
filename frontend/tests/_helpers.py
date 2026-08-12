from __future__ import annotations

import pytest
import requests


def require_no_auth_or_skip(resp: requests.Response) -> None:
    if resp.status_code == 401:
        pytest.skip(
            "Server requires login (DIY). For unattended tests, start server with DAMA_DIY_AUTH=0."
        )

