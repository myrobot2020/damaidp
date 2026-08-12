export type MCQOption = {
  id: string;
  title: string;
  body: string;
};

export type SuttaMCQ = {
  suttaId: string;
  quote: string;
  options: MCQOption[];
  /** Which option turns a yellow leaf gold (teacher-aligned review). */
  goldOptionId: string;
  /** Short teacher-aligned explanation shown after the user submits. */
  teacherSummary?: string;
  /** Optional teacher micro-clip window (seconds) for review mode. */
  teacherClip?: { startS: number; endS: number; label: string };
  /** Optional Japanese spoken explanation for the teacher-aligned point. */
  japaneseAudio?: { label: string; src: string; text: string };
};

export type SuttaQuiz = SuttaMCQ;

export const an148Quiz: SuttaMCQ = {
  suttaId: "1.48",
  quote: "Monks, I know not of any other single thing so quick to change as the mind.",
  options: [
    {
      id: "speed",
      title: "Speed of change (literal)",
      body: "The mind changes extremely quickly.",
    },
    {
      id: "impermanence",
      title: "Impermanence of states",
      body: "Any mental state is short-lived.",
    },
    {
      id: "transformation",
      title: "Possibility of transformation",
      body: "Change in the mind does not require long time.",
    },
    {
      id: "unreliability",
      title: "Unreliability of current experience",
      body: "What is present in the mind now is not stable.",
    },
    {
      id: "trainability",
      title: "Trainability of the mind",
      body: "Because it changes quickly, the mind can be redirected.",
    },
  ],
  goldOptionId: "trainability",
  teacherClip: { startS: 328.7, endS: 412.06, label: "Teacher micro-clip" },
  japaneseAudio: {
    label: "日本語オーディオ",
    src: "/audio/an-1-48-ja.mp3",
    text: [
      "心は非常に速く変わります。",
      "そして、心は非常に速く変わるので、それを知っているなら、それをよい利益のために使うべきです。",
      "たとえば、よい意図が起こります。",
      "たとえば、ある人は、もしかしたら私は僧になるべきかもしれない、と考えます。",
      "ですから、よい意図があるので、すぐに行動するべきです。",
      "ゆっくり行動してはいけません。",
      "心は変わってしまいます。",
      "心は難しいものです。",
      "ですから、よい意図、よい資源があるとき、それが変わってしまうかもしれないと恐れるので、すぐに行動します。",
      "一方で、悪い意図、または悪い資源があるなら、それに基づいて行動してはいけません。",
      "たとえば、怒りが起こります。",
      "そして、もし強い怒りで行動すれば、必ず不善なこと、賢明でないことをしてしまう、と考えます。",
      "なぜなら、あなたの心の状態は乱れているからです。",
      "そして、それを知ったなら、行動する代わりに、何もしません。",
      "ただ、怒りがおさまるのを待ちます。",
      "そして、心は変わるのが速いので、待ち続ければ、それはおさまります。",
      "ただ何もしないことです。",
      "ただ、それに基づいて行動しないと決意します。",
      "つまり、それが利用するということです。",
    ].join(" "),
  },
};
