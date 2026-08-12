import type { SuttaMCQ } from "./an148Quiz";
import { getSuttaMCQ } from "./suttaQuizzes";

export type SuttaPractice = {
  suttaId: string;
  vow: string;
  technique: {
    title: string;
    steps: string[];
  };
  mcq: SuttaMCQ;
};

function normalizeSuttaId(suttaId: string): string {
  return suttaId.trim().replace(/^AN\s+/i, "");
}

const bookOnePracticeText: Record<string, Omit<SuttaPractice, "mcq">> = {
  "1.18.13": {
    suttaId: "AN 1.18.13",
    vow: "Today I will not romanticize becoming, even for a small moment.",
    technique: {
      title: "One unpleasant image",
      steps: [
        "Notice one craving as it starts to decorate an experience.",
        "Name the cost plainly: this too is conditioned and unstable.",
        "Let the image cool the craving without adding aversion.",
      ],
    },
  },
  "1.19": {
    suttaId: "AN 1.19",
    vow: "Today I will welcome one difficult truth instead of choosing the easy ground.",
    technique: {
      title: "Choose the hard path once",
      steps: [
        "Find one moment where comfort is pulling you away from honesty.",
        "Pause and ask what the Dhamma would ask you to face.",
        "Take the smaller truthful action.",
      ],
    },
  },
  "1.19.2": {
    suttaId: "AN 1.19.2",
    vow: "Today I will treat this human chance as rare and not waste it.",
    technique: {
      title: "Rare chance reflection",
      steps: [
        "Bring to mind that this day is not guaranteed.",
        "Pick one wholesome act that protects the mind.",
        "Do it before the mind negotiates it away.",
      ],
    },
  },
  "1.20.1": {
    suttaId: "AN 1.20.1",
    vow: "Today I will count simplicity and training as real gains.",
    technique: {
      title: "Recount your gains",
      steps: [
        "Name one support for practice already present in your life.",
        "Use it without turning it into status.",
        "Drop one unnecessary complication for the next hour.",
      ],
    },
  },
  "1.20.2": {
    suttaId: "AN 1.20.2",
    vow: "Today I will honor even one real breath of collectedness.",
    technique: {
      title: "Finger-snap collectedness",
      steps: [
        "Sit or stand still for one breath.",
        "Let attention gather around a single simple object.",
        "Repeat briefly, caring more about sincerity than duration.",
      ],
    },
  },
  "1.21.47": {
    suttaId: "AN 1.21.47",
    vow: "Today I will return to the body before I believe every thought.",
    technique: {
      title: "Body first",
      steps: [
        "Feel the feet, hands, or breath before answering a mental story.",
        "Stay with raw sensation for three slow breaths.",
        "Act only after the body has steadied the mind.",
      ],
    },
  },
  "1.48": {
    suttaId: "AN 1.48",
    vow: "Today I will use the mind's quickness for good before it turns away.",
    technique: {
      title: "Catch the first wholesome impulse",
      steps: [
        "When a wholesome intention appears, name it immediately.",
        "Take one tiny action while the intention is still warm.",
        "When an unwholesome impulse appears, wait without feeding it.",
      ],
    },
  },
};

export function getBookOnePractice(suttaId: string): SuttaPractice | null {
  const key = normalizeSuttaId(suttaId);
  const text = bookOnePracticeText[key];
  const mcq = getSuttaMCQ(suttaId);
  if (!text || !mcq) return null;
  return { ...text, mcq };
}

export function getFallbackPractice(suttaId: string, quote: string): SuttaPractice {
  return {
    suttaId,
    vow: "Today I will turn this teaching into one small action.",
    technique: {
      title: "One-line practice",
      steps: [
        "Read the sutta once slowly.",
        "Choose the phrase that challenges you most.",
        "Practice that phrase in one ordinary moment today.",
      ],
    },
    mcq: {
      suttaId,
      quote,
      options: [
        {
          id: "practice-now",
          title: "Practice now",
          body: "The teaching asks for a small present-moment change in conduct or attention.",
        },
        {
          id: "store-idea",
          title: "Store the idea",
          body: "The teaching is mainly something to remember for later.",
        },
        {
          id: "admire-style",
          title: "Admire the style",
          body: "The important thing is the beauty of the wording.",
        },
        {
          id: "avoid-life",
          title: "Avoid life",
          body: "Practice means withdrawing from every ordinary responsibility.",
        },
      ],
      goldOptionId: "practice-now",
      teacherSummary:
        "A sutta becomes useful when it changes one moment of attention, speech, or action. Start small and make the teaching concrete.",
    },
  };
}
