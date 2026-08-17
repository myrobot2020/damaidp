import re
from typing import Dict, Any, List, Optional

class RuleResult:
    def __init__(self, rule_id: str, passed: bool, message: str = ""):
        self.rule_id = rule_id
        self.passed = passed
        self.message = message

    def to_dict(self):
        return {
            "rule_id": self.rule_id,
            "status": "PASS" if self.passed else "FAIL",
            "message": self.message
        }

def check_schema(data: Dict[str, Any]) -> List[RuleResult]:
    results = []
    required_fields = ["sutta_id", "sutta_name", "transcript", "quiz", "knowledge_graph", "commentary"]
    for field in required_fields:
        passed = field in data
        results.append(RuleResult(f"RULE_REQUIRED_FIELD_{field.upper()}", passed, f"Field '{field}' is missing" if not passed else ""))
    return results

def check_mcq(data: Dict[str, Any]) -> List[RuleResult]:
    results = []
    quiz = data.get("quiz", {})
    if not quiz:
        results.append(RuleResult("RULE_MCQ_EXISTS", False, "Quiz field is empty"))
        return results

    options = quiz.get("options", [])
    results.append(RuleResult("RULE_MCQ_COUNT_4", len(options) == 4, f"Found {len(options)} options, expected 4"))

    option_ids = [opt.get("id") for opt in options if "id" in opt]
    results.append(RuleResult("RULE_MCQ_UNIQUE_IDS", len(set(option_ids)) == len(option_ids), "Option IDs are not unique"))

    gold_id = quiz.get("goldOptionId")
    results.append(RuleResult("RULE_MCQ_GOLD_EXISTS", gold_id in option_ids, f"goldOptionId '{gold_id}' not found in options"))

    return results

def check_graph(data: Dict[str, Any]) -> List[RuleResult]:
    results = []
    graph = data.get("knowledge_graph", {})
    if not graph:
        results.append(RuleResult("RULE_GRAPH_EXISTS", False, "Knowledge graph is missing"))
        return results

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    node_ids = {node.get("id") for node in nodes if "id" in node}

    invalid_edges = []
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source not in node_ids or target not in node_ids:
            invalid_edges.append(f"{source}->{target}")

    results.append(RuleResult("RULE_GRAPH_INTEGRITY", len(invalid_edges) == 0, f"Edges reference missing nodes: {', '.join(invalid_edges)}" if invalid_edges else ""))

    return results

def run_all_rules(data: Dict[str, Any]) -> List[RuleResult]:
    results = []
    results.extend(check_schema(data))
    results.extend(check_mcq(data))
    results.extend(check_graph(data))
    return results
