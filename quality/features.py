import re
from typing import Dict, Any

def extract_features(data: Dict[str, Any]) -> Dict[str, Any]:
    features = {}

    # Transcript features
    transcript = data.get("transcript", "") or data.get("sutta", "") # Handle different field names
    if isinstance(transcript, list): # Some formats use lists for transcript
        transcript = " ".join([t.get("text", "") if isinstance(t, dict) else str(t) for t in transcript])

    features["transcript_char_count"] = len(transcript)
    features["transcript_word_count"] = len(transcript.split())

    # Commentary features
    commentary = data.get("commentary", "")
    features["commentary_word_count"] = len(commentary.split()) if isinstance(commentary, str) else 0

    # Quiz features
    quiz = data.get("quiz", {})
    options = quiz.get("options", [])
    features["mcq_option_count"] = len(options)
    features["question_char_count"] = len(quiz.get("quote", ""))

    if options:
        avg_option_len = sum(len(opt.get("body", "")) for opt in options) / len(options)
        features["avg_option_char_count"] = avg_option_len
    else:
        features["avg_option_char_count"] = 0

    # Graph features
    graph = data.get("knowledge_graph", {})
    features["node_count"] = len(graph.get("nodes", []))
    features["edge_count"] = len(graph.get("edges", []))

    return features
