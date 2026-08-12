import pytest
import subprocess
import time
import socket
from pathlib import Path
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

@pytest.fixture(scope="module", autouse=True)
def local_server():
    """Start a local web server for the frontend."""
    port = 8000
    process = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    # Wait for server to start
    for _ in range(10):
        if is_port_open(port):
            break
        time.sleep(0.5)

    yield f"http://localhost:{port}"

    process.terminate()

def test_app_loads(page: Page, local_server):
    """Verify index.html loads and has the correct title."""
    page.goto(local_server)
    expect(page).to_have_title(re.compile("Buddhist Sutta", re.I))

    # Check if search bar exists
    search = page.locator("input#searchInput")
    expect(search).to_be_visible()

def test_nikaya_tabs(page: Page, local_server):
    """Verify Nikaya tabs are present and clickable."""
    page.goto(local_server)

    tabs = ["DN", "SN", "AN", "KN"]
    for tab in tabs:
        btn = page.locator(f"button#tab-{tab.lower()}")
        expect(btn).to_be_visible()
        btn.click()
        expect(btn).to_have_class(re.compile("active"))

import sys
import re
