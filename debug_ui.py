import time
import json
import os
import subprocess
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright

# Move logs to a hidden folder to avoid triggering Vite reloads
ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / ".debug_logs"
LOG_DIR.mkdir(exist_ok=True)

LOG_FILE = LOG_DIR / "reflection_log.jsonl"
TRACE_FILE = LOG_DIR / "trace.zip"

def append_reflection(event_type, data):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "type": event_type,
            "data": data
        }
        f.write(json.dumps(log_entry) + "\n")

def run_debug_session():
    # Reset log
    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)

    print(f"🕵️ Monitoring started. Logging to {LOG_FILE}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context()
        context.tracing.start(screenshots=True, snapshots=True, sources=True)

        page = context.new_page()

        # Monitor Console Errors
        def handle_console(msg):
            if msg.type == "error":
                print(f"❌ BROWSER ERROR: {msg.text}")
                append_reflection("browser_error", {"text": msg.text, "location": msg.location})
            elif "USER_CLICK" in msg.text:
                print(f"🖱️ {msg.text}")
                try:
                    # Parse the injected USER_CLICK log
                    data = json.loads(msg.text.split('USER_CLICK ')[1])
                    append_reflection("user_click", data)
                except:
                    pass

        page.on("console", handle_console)

        # Monitor Network Fails
        page.on("requestfailed", lambda req: append_reflection("network_fail", {
            "url": req.url,
            "error": req.error_text
        }))

        # Inject Click Tracker
        page.add_init_script("""
            window.addEventListener('mousedown', e => {
                const dot = document.createElement('div');
                dot.style.position = 'fixed';
                dot.style.left = (e.clientX - 10) + 'px';
                dot.style.top = (e.clientY - 10) + 'px';
                dot.style.width = '20px';
                dot.style.height = '20px';
                dot.style.background = 'rgba(255, 0, 0, 0.5)';
                dot.style.borderRadius = '50%';
                dot.style.pointerEvents = 'none';
                dot.style.zIndex = '9999';
                document.body.appendChild(dot);
                setTimeout(() => dot.remove(), 500);

                console.log('USER_CLICK', JSON.stringify({
                    x: e.clientX,
                    y: e.clientY,
                    target: e.target.tagName,
                    text: e.target.innerText?.slice(0, 30).trim(),
                    url: window.location.href
                }));
            });
        """)

        url = "http://localhost:8080"
        print(f"\n🚀 Waiting for {url} to be ready...")

        # Wait for dev server to start
        max_retries = 30
        for i in range(max_retries):
            try:
                page.goto(url)
                break
            except Exception:
                if i == max_retries - 1:
                    print(f"❌ Error: Dev server at {url} never started.")
                    return
                time.sleep(1)

        print("\n✅ Connected! Session Active.")
        print("I am watching your traces. Close the window when finished.\n")

        try:
            while not page.is_closed():
                # Every 5 seconds, capture a "Pulse" state
                try:
                    ux_log = page.evaluate("localStorage.getItem('dama:uxLog')")
                    if ux_log:
                        events = json.loads(ux_log)
                        if events:
                            append_reflection("app_ux_log", events[-5:]) # Last 5 events
                except:
                    pass
                time.sleep(5)
        except Exception as e:
            if "Target closed" not in str(e):
                print(f"Session ended with error: {e}")
        finally:
            print("\n💾 Session Finished.")
            context.tracing.stop(path=str(TRACE_FILE))
            browser.close()
            print(f"Full trace saved to {TRACE_FILE}")
            print(f"Reflection log saved to {LOG_FILE}")

if __name__ == "__main__":
    run_debug_session()
