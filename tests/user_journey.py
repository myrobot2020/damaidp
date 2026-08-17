import re
import os
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

class UserJourneyTester:
    """Repeat recorded user actions and verify UI state."""
    def __init__(self, results_dir: Path = Path("test_results")):
        self.results_dir = results_dir
        self.results_dir.mkdir(exist_ok=True, parents=True)

    def run_standard_exploration(self, base_url: str = "http://localhost:8080"):
        """
        Automated version of the user-recorded journey.
        """
        report = {"journey": "standard_exploration", "steps": [], "status": "IN_PROGRESS"}

        with sync_playwright() as p:
            # We use headless=False so the user can see it if running locally,
            # but usually CI/CD would use headless=True
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                record_video_dir=str(self.results_dir),
                record_video_size={"width": 1280, "height": 720}
            )
            page = context.new_page()

            try:
                # 1. Navigation
                page.goto(base_url)
                report["steps"].append({"action": "goto", "status": "PASS"})

                # 2. Click AN Nikaya
                # The label matches the 'AN Nikāya Suttas Available' text from recording
                page.get_by_role("button", name=re.compile(r"AN Nikāya", re.I)).click()
                report["steps"].append({"action": "click_an_nikaya", "status": "PASS"})

                # 3. Handle 'VISUAL View +' (Graph interactions)
                visual_btn = page.get_by_role("button", name="VISUAL View +")
                if visual_btn.is_visible():
                    visual_btn.click()
                    report["steps"].append({"action": "visual_view", "status": "PASS"})

                # 4. Final state check
                page.wait_for_timeout(2000) # Let animations settle
                screenshot_path = self.results_dir / f"journey_final_{datetime.now().strftime('%H%M%S')}.png"
                page.screenshot(path=str(screenshot_path))
                report["screenshot"] = str(screenshot_path)
                report["status"] = "SUCCESS"

            except Exception as e:
                report["steps"].append({"action": "error", "message": str(e), "status": "FAIL"})
                report["status"] = "FAILED"
            finally:
                context.close()
                browser.close()

        return report

if __name__ == "__main__":
    # Allow running this test standalone
    tester = UserJourneyTester()
    result = tester.run_standard_exploration()
    print(f"Test Result: {result['status']}")
