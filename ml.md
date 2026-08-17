# ML-First Generative-Data Quality and Rule-Discovery System

## Core Philosophy
We acknowledge that initially, we do not know all the rules that define a "good" generated sutta artifact. Our strategy is to:
1. **Observe** generated data.
2. **Extract** measurable features.
3. **Learn** normal distributions and detect anomalies.
4. **Transparently Score** every artifact with explainable metrics.
5. **Human-in-the-loop** for investigation and rule promotion.
6. **Promote** discovered invariants to deterministic rules.
7. **Simplify** the ML responsibility over time as the system becomes more deterministic.

## Architecture
The quality system is decoupled from `pipeline.py`. It lives in a separate `quality/` package.

```
quality/
    __init__.py
    collector.py    # Gathers artifacts for evaluation
    features.py     # Extracts numeric/categorical features from JSON/text
    rules.py        # Hard deterministic checks (Phase 1 & Phase 10)
    anomaly.py      # ML models for anomaly detection (Isolation Forest, etc.)
    semantic.py     # Embedding-based similarity and NLI checks
    graph.py        # Knowledge graph specific metrics and structure checks
    regression.py   # Historical comparison and drift detection
    scorer.py       # Aggregates results into an explainable report
    report.py       # Generates human and machine readable reports
    baseline.py     # Manages historical baselines
    discovery.py    # Identifies candidate rules from recurring anomalies
    models/         # Serialized ML models
    schemas/        # JSON schemas for validation
    history/        # Historical feature vectors and scores
```

## Quality Report Structure
Every evaluation produces a `quality_report.json` alongside the sutta artifact.

```json
{
    "sutta_id": "5.4.40",
    "pipeline_version": "1.2.3",
    "status": "PASS",
    "overall_score": 0.92,
    "checks": {
        "schema": { "score": 1.0, "status": "PASS" },
        "transcript_length": {
            "value": 1842,
            "baseline": 1760,
            "percentile": 72,
            "anomaly_score": 0.03,
            "status": "PASS"
        },
        "mcq_relevance": {
            "score": 0.93,
            "method": "embedding_similarity",
            "status": "PASS"
        }
    },
    "anomalies": [],
    "rules_triggered": ["RULE_SCHEMA_VALID", "RULE_MCQ_COUNT_4"],
    "candidate_rules": [],
    "human_review": { "required": false, "reason": null }
}
```

## Implementation Phases

### Phase 1: Deterministic Baseline
Implement mandatory structural checks:
- Valid JSON and Schema compliance.
- Required fields (sutta_id, transcript, quiz, knowledge_graph).
- Correct MCQ structure (exactly 4 options, unique IDs, goldOptionId exists).
- Graph integrity (nodes exist for all edge references).

### Phase 2: Feature Extraction
Extract measurable features for every sutta:
- **Content**: Word counts, character counts, vocabulary size, Pali-token density.
- **MCQ**: Question/Option length ratios, semantic similarity (MCQ vs Sutta).
- **Graph**: Node/Edge counts, density, degree distribution.
- **Media**: Audio/Transcript duration ratios.

### Phase 3: Anomaly Detection
Use unsupervised models (e.g., Isolation Forest) to answer: *"How unusual is this artifact compared to previous ones?"*

### Phase 4: Semantic Quality
Use embeddings to verify:
- Transcript alignment with canonical text.
- MCQ question relevance to the sutta content.
- Gold answer entailment (NLI).

### Phase 5: Rule Discovery
Track recurring anomalies. When a human confirms a pattern (e.g., "Knowledge graphs for AN 5.x must always have 5 growth nodes"), promote it to a deterministic rule in `rules.py`.

## Success Metrics
The system's maturity is tracked by:
- Ratio of Deterministic Rules vs. ML Checks.
- Number of confirmed failures caught by ML.
- Reduction in "Unknown Space" of data quality.
