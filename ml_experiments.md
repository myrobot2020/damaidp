# ML Quality System: Experiments & Roadmap

## 1. Data Collection & Datasets
### Artifact Warehouse
*   **Source**: Every successful run of `pipeline.py` saves its output JSON to `data/artifacts/v{version}/{sutta_id}.json`.
*   **Gold Standard Dataset**: Manually curated set of 50 "Perfect Suttas" (High quality transcript, accurate KG, challenging but fair MCQ).
*   **Failure Library**: Collection of known bad outputs (hallucinations, truncated audio, broken graph references) labeled by category.

## 2. Feature Engineering Experiments
### Content Features
*   **Pali-to-Local Ratio**: Calculate the density of Pali terms. Too low = potentially over-simplified. Too high = potentially unreadable.
*   **Entropy/Vocabulary Richness**: Measure the TTR (Type-Token Ratio). Low TTR might indicate repetitive/looped AI generations.
*   **Commentary-Sutta Alignment**: Cosine similarity between the commentary summary and the canonical sutta text.

### MCQ Features
*   **Distractor Separation**: Embedding distance between the gold answer and each distractor. 
    *   *Too close* = Ambiguous.
    *   *Too far* = Too easy.
*   **Contextual Entailment**: Use a Cross-Encoder to verify if the Sutta text actually *entails* the Gold Answer.

### Graph Features
*   **Isomorphism Checks**: Compare the generated graph against "Template Graphs" for specific sutta families (e.g., the "Five Growths" template).
*   **Edge Entropy**: Distribution of relation types.

## 3. Planned ML Models
### Model A: The Outlier Sentinel (Isolation Forest)
*   **Type**: Unsupervised Anomaly Detection.
*   **Goal**: Flag suttas that are "statistically weird" (e.g., unusually short transcript with an unusually dense graph).
*   **Explainability**: Use SHAP values to show *which* feature made it an outlier.

### Model B: MCQ Quality Regressor
*   **Type**: Supervised (using the Failure Library).
*   **Goal**: Predict a "Review Probability" for a generated MCQ before a human ever sees it.

### Model C: Topic Drift Detector
*   **Type**: Embedding-based clustering.
*   **Goal**: Detect if the pipeline's "interpretation" of Buddhist concepts is shifting over time as models/prompts change.

## 4. Rule Discovery (The "Maturity" Engine)
### Recurring Anomaly Clustering
1.  Run `Isolation Forest` on 1000 suttas.
2.  Group anomalies by feature similarity (e.g., "All these have 0 edges in the graph").
3.  Generate a **Candidate Rule**: `ASSERT edge_count > 0`.
4.  Human approves -> Promote to `rules.py`.

## 5. Visual Regression Experiments
*   **Layout Stability**: Compare screenshot DOM trees of the Sutta page across different generations.
*   **Color Distribution**: Detect if the "Visual View" is rendering empty/black screens by analyzing pixel histograms.
