import { an148Quiz, type SuttaMCQ } from "./an148Quiz";
import { an1Quizzes } from "./an1Quizzes";
import { an11Quizzes } from "./an11Quizzes";
import { an5Quizzes } from "./an5Quizzes";

function normalizeSuttaId(suttaId: string): string {
  return suttaId.trim().replace(/^AN\s+/i, "");
}

const mcqs = [an148Quiz, ...an1Quizzes, ...an11Quizzes, ...an5Quizzes];

export function getSuttaMCQ(suttaId: string): SuttaMCQ | null {
  const normalized = normalizeSuttaId(suttaId);
  return mcqs.find((mcq) => normalizeSuttaId(mcq.suttaId) === normalized) ?? null;
}

export const suttaMCQs = mcqs;
