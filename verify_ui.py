import sys
import json
from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        url = "http://localhost:8080"
        print(f"Checking {url}...")
        try:
            page.goto(url, timeout=10000)
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Error: Could not connect to {url}. {e}")
            return

        # 1. Check Home Screen Nikayas
        print("\nVerifying Home Screen Nikayas...")
        page.wait_for_selector("button", timeout=5000)
        buttons = page.locator("button").all()
        active_count = 0
        for btn in buttons:
            text = btn.text_content()
            if "Nikāya" in text:
                is_disabled = "cursor-not-allowed" in (btn.get_attribute("class") or "")
                status = "EMPTY/GRAYSCALE" if is_disabled else "ACTIVE"
                print(f"Card '{text.strip().replace('\\n', ' ')}': {status}")
                if not is_disabled: active_count += 1

        # 2. Check Browse Page
        print("\nChecking Browse Page (All Nikayas)...")
        page.goto(f"{url}/browse")
        page.wait_for_load_state("networkidle")

        # Check if items are shown
        items = page.locator("a[href*='/sutta/']").all()
        print(f"Total Items found in Browse: {len(items)}")

        found_an = False
        found_mn = False
        for it in items:
            text = it.text_content()
            if "AN 5.4.40" in text: found_an = True
            if "MN 1" in text: found_mn = True
            print(f" - Found: {text.strip()[:50]}")

        if found_an: print("SUCCESS: AN 5.4.40 listed.")
        else: print("FAIL: AN 5.4.40 NOT listed.")

        if found_mn: print("SUCCESS: MN 1 listed.")
        else: print("FAIL: MN 1 NOT listed.")

        browser.close()

if __name__ == "__main__":
    verify()
