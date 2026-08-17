from typing import Dict, Any, List
from .rules import run_all_rules
from .features import extract_features

class QualityEngine:
    def __init__(self, version: str = "1.0.0"):
        self.version = version

    def evaluate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        rule_results = run_all_rules(data)
        features = extract_features(data)

        # Calculate scores
        rule_score = sum(1 for r in rule_results if r.passed) / len(rule_results) if rule_results else 1.0

        # Determine status
        hard_failures = [r for r in rule_results if not r.passed]
        status = "FAIL" if hard_failures else "PASS"

        # Final Report
        report = {
            "sutta_id": data.get("sutta_id", "unknown"),
            "pipeline_version": self.version,
            "status": status,
            "overall_score": rule_score, # For now, just rule-based
            "checks": {
                "rules": [r.to_dict() for r in rule_results],
                "features": features
            },
            "human_review": {
                "required": status == "FAIL",
                "reason": "Hard rule failure" if status == "FAIL" else None
            }
        }

        return report
