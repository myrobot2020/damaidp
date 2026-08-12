import type { SuttaQuiz } from "./an148Quiz";

export const an11Quizzes: SuttaQuiz[] = [
  {
    suttaId: "AN 11.6",
    quote:
      "If a monk abuses and reviles noble ones, it is unavoidable that he comes to one of eleven disasters.",
    options: [
      {
        id: "respect-noble-ones",
        title: "Respect noble ones",
        body: "Reviling noble companions damages one's own practice and can lead to grave downfall.",
      },
      {
        id: "mere-politeness",
        title: "Mere politeness",
        body: "The teaching is only about keeping pleasant social manners in the monastery.",
      },
      {
        id: "meditation-method",
        title: "Meditation method",
        body: "The passage mainly explains a technique for entering concentration.",
      },
      {
        id: "fixed-destiny",
        title: "Fixed destiny",
        body: "Once a monk makes a mistake, the eleven disasters must all happen to him.",
      },
    ],
    goldOptionId: "respect-noble-ones",
    teacherSummary:
      "The teacher says abusing holy monks can obstruct the path: one may fail to attain, lose concentration or psychic power, become conceited, lose delight in the holy life, break training, become ill or confused, and even be reborn in hell. The point is that reviling noble ones is spiritually dangerous, not merely impolite.",
  },
];
