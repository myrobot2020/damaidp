import json
import re
import os
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict

# ============================================================
# CORE MODELS & DATA STRUCTURES
# ============================================================

@dataclass
class RuleResult:
    rule_id: str
    passed: bool
    message: str = ""

    def to_dict(self):
        return asdict(self)

@dataclass
class QualityReport:
    sutta_id: str
    pipeline_version: str
    status: str
    overall_score: float
    checks: Dict[str, Any]
    anomalies: List[Dict[str, Any]]
    rules_triggered: List[str]
    candidate_rules: List[str]
    human_review: Dict[str, Any]

    def to_json(self):
        return json.dumps(asdict(self), indent=2)

# ============================================================
# PHASE 1: DETERMINISTIC RULES
# ============================================================

class RuleEngine:
    @staticmethod
    def check_schema(data: Dict[str, Any]) -> List[RuleResult]:
        results = []
        required = ["sutta_id", "transcript", "quiz", "knowledge_graph", "commentary"]
        for field in required:
            val = data.get(field)
            passed = val is not None and (len(val) > 0 if hasattr(val, "__len__") else True)
            results.append(RuleResult(f"RULE_REQUIRED_{field.upper()}", passed, f"Field '{field}' missing or empty" if not passed else ""))
        return results

    @staticmethod
    def check_mcq(data: Dict[str, Any]) -> List[RuleResult]:
        results = []
        quiz = data.get("quiz", {})
        options = quiz.get("options", [])

        results.append(RuleResult("RULE_MCQ_COUNT_4", len(options) == 4, f"Found {len(options)} options, expected 4"))

        ids = [opt.get("id") for opt in options if "id" in opt]
        results.append(RuleResult("RULE_MCQ_UNIQUE_IDS", len(set(ids)) == len(ids) and len(ids) == len(options), "Duplicate or missing option IDs"))

        gold_id = quiz.get("goldOptionId")
        results.append(RuleResult("RULE_MCQ_GOLD_EXISTS", any(opt.get("id") == gold_id for opt in options), f"goldOptionId {gold_id} not in options"))

        return results

    @staticmethod
    def check_graph(data: Dict[str, Any]) -> List[RuleResult]:
        results = []
        graph = data.get("knowledge_graph", {})
        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])

        node_ids = {n.get("id") for n in nodes if n.get("id")}
        results.append(RuleResult("RULE_GRAPH_NOT_EMPTY", len(nodes) > 0, "Graph has no nodes"))

        orphans = []
        for edge in edges:
            if edge.get("source") not in node_ids or edge.get("target") not in node_ids:
                orphans.append(f"{edge.get('source')}->{edge.get('target')}")

        results.append(RuleResult("RULE_GRAPH_INTEGRITY", len(orphans) == 0, f"Dangling edges: {orphans}" if orphans else ""))
        return results

# ============================================================
# PHASE 2: FEATURE EXTRACTION
# ============================================================

def extract_features(data: Dict[str, Any]) -> Dict[str, Any]:
    f = {}

    # Transcript
    t = data.get("transcript", "")
    if isinstance(t, list): t = " ".join(str(x) for x in t)
    f["transcript_char_count"] = len(t)
    f["transcript_word_count"] = len(t.split())

    # Commentary
    c = data.get("commentary", "")
    f["commentary_word_count"] = len(c.split()) if isinstance(c, str) else 0

    # MCQ
    quiz = data.get("quiz", {})
    q_text = quiz.get("question", "") or quiz.get("quote", "")
    f["question_len"] = len(q_text)
    options = quiz.get("options", [])
    f["mcq_option_count"] = len(options)
    if options:
        f["avg_option_len"] = sum(len(opt.get("body", "")) for opt in options) / len(options)

    # Graph
    graph = data.get("knowledge_graph", {})
    f["node_count"] = len(graph.get("nodes", []))
    f["edge_count"] = len(graph.get("edges", []))
    if f["node_count"] > 0:
        f["graph_density"] = f["edge_count"] / (f["node_count"] * (f["node_count"] - 1)) if f["node_count"] > 1 else 0

    return f

# ============================================================
# PHASE 3: ANOMALY (Placeholder for ML)
# ============================================================

class AnomalyDetector:
    def detect(self, features: Dict[str, Any]) -> List[Dict[str, Any]]:
        # In later phases, this will load a model from models/
        return []

# ============================================================
# QUALITY ENGINE
# ============================================================

class QualityEngine:
    def __init__(self, version="1.0.0"):
        self.version = version
        self.rules = RuleEngine()
        self.anomaly = AnomalyDetector()

    def evaluate(self, data: Dict[str, Any]) -> QualityReport:
        # Run deterministic checks
        rule_results = []
        rule_results.extend(self.rules.check_schema(data))
        rule_results.extend(self.rules.check_mcq(data))
        rule_results.extend(self.rules.check_graph(data))

        # Extract features
        features = extract_features(data)

        # ML Anomaly detection
        anomalies = self.anomaly.detect(features)

        # Calculate summary
        passed_rules = [r for r in rule_results if r.passed]
        failed_rules = [r for r in rule_results if not r.passed]

        score = len(passed_rules) / len(rule_results) if rule_results else 1.0
        status = "PASS" if not failed_rules else "FAIL"

        # Force FAIL on critical rule failures
        if any(r.rule_id.startswith("RULE_REQUIRED") and not r.passed for r in rule_results):
            status = "FAIL"

        return QualityReport(
            sutta_id=data.get("sutta_id", "unknown"),
            pipeline_version=self.version,
            status=status,
            overall_score=round(score, 4),
            checks={
                "rule_details": [r.to_dict() for r in rule_results],
                "feature_vector": features
            },
            anomalies=anomalies,
            rules_triggered=[r.rule_id for r in rule_results if r.passed],
            candidate_rules=[],
            human_review={
                "required": status == "FAIL" or len(anomalies) > 0,
                "reason": "Rule failure" if status == "FAIL" else ("Anomaly detected" if anomalies else None)
            }
        )

# ============================================================
# CLI / UTILS
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Buddhist Sutta Quality Engine")
    parser.add_argument("path", help="Path to sutta JSON file or directory")
    parser.add_argument("--save", action="store_true", help="Save quality_report.json next to source")
    args = parser.parse_args()

    engine = QualityEngine()
    path = Path(args.path)

    if path.is_file():
        process_file(path, engine, args.save)
    elif path.is_dir():
        for f in path.rglob("*.json"):
            if "quality_report" not in f.name:
                process_file(f, engine, args.save)

def process_file(path: Path, engine: QualityEngine, save: bool):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, dict) or "sutta_id" not in data:
            return

        report = engine.evaluate(data)

        if save:
            report_path = path.parent / f"{path.stem}.quality_report.json"
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(report.to_json())
            print(f"Processed {path.name} -> {report.status} ({report.overall_score})")
        else:
            print(report.to_json())

    except Exception as e:
        print(f"Error processing {path}: {e}")

if __name__ == "__main__":
    main()
