/**
 * DAMA Harness Prompt Registry (Point 33)
 * Centralized, versioned prompts for global-scale operations.
 */

export type PromptDefinition = {
  version: string;
  template: string;
  model: string;
};

export const INGESTION_REGISTRY: Record<string, PromptDefinition> = {
  IDENTIFY_SUTTAS: {
    version: "1.0.0",
    model: "gpt-4o-mini",
    template: `
      You are a Pali Canon scholar. Given the following transcript of a Dhamma talk,
      identify all distinct suttas discussed.
      For each sutta, provide the Pāḷi citation (e.g. AN 3.12) and the start/end timestamps if available.

      TRANSCRIPT:
      {{transcript}}
    `
  },
  GENERATE_METADATA: {
    version: "1.0.1",
    model: "gpt-4o-mini",
    template: `
      Based on this specific segment of a Dhamma talk, generate:
      1. A concise, clear English title (follow Sutta Central style).
      2. A 2-3 sentence summary of the core teaching.
      3. The primary Nikāya and Book number.

      SEGMENT:
      {{segment}}
    `
  },
  GENERATE_QUIZ: {
    version: "1.0.0",
    model: "gpt-4o-mini",
    template: `
      Create a multiple-choice question (MCQ) for the following sutta teaching.
      Provide 4 options, a 'gold' correct option, and a brief teacher-style explanation for why it is correct.

      SUTTA TEXT:
      {{suttaText}}
    `
  }
};

export const REFLECTION_REGISTRY: Record<string, PromptDefinition> = {
  BUDDHA_BOT: {
    version: "1.2.0",
    model: "gpt-4o-mini",
    template: `
      You are BuddhaBot, an AI grounded in the Suttas.
      A user has shared this reflection: "{{reflection}}"
      Based on the suttas they have read ({{suttaContexts}}), provide a compassionate response
      that directly references the Buddha's teachings.
    `
  }
};

export const CALIBRATION_REGISTRY: Record<string, PromptDefinition> = {
  VERIFY_CONCLUSION: {
    version: "1.0.0",
    model: "gpt-4o-mini",
    template: `
      You are a logic auditor for a Dhamma app.
      PREMISE (Sutta): {{suttaContext}}
      CONCLUSION (AI Answer): {{answer}}

      Does the CONCLUSION logically entail from the PREMISE?
      Check for:
      1. Direct contradictions.
      2. Misrepresenting the Buddha's advice (e.g. saying to do something the sutta warns against).

      Respond in JSON: { "pass": boolean, "reason": "brief explanation", "score": 0.0-1.0 }
    `
  }
};
