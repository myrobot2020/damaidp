/**
 * DAMA Harness Configuration (Point 31)
 * Central control panel for global-scale execution parameters.
 */

export const HARNESS_CONFIG = {
  // Global timeouts
  DEFAULT_STEP_TIMEOUT_MS: 45_000,
  REFLECTION_TOTAL_TIMEOUT_MS: 60_000,

  // Retry logic (Point 6 & 11)
  RETRIES: {
    CRITICAL_AI_CALL: 2,   // e.g. callReflectionModel
    DATA_LOAD: 1,          // e.g. loadReadSuttas
    OPTIONAL_TRACE: 0,     // e.g. recordTrace
    MIN_DELAY_MS: 500,     // Wait before first retry
  },

  // Model Registry (Point 33/15)
  MODELS: {
    PRIMARY: "gpt-4o-mini",
    FALLBACK: "gemini-1.5-flash",
  },

  // Retrieval Settings (Point 20/21)
  RETRIEVAL: {
    MAX_CONTEXT_SUTTAS: 6,
    VECTOR_MATCH_THRESHOLD: 0.5,
    KEYWORD_MATCH_MIN_LENGTH: 4,
  }
};
