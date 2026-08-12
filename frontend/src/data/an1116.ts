export type Advantage = {
  n: number;
  title: string;
  img: string;
};

export type SuttaSeed = {
  id: string;
  canon: string;
  advantages: Advantage[];
};

const TITLES = [
  "Sleeps happily",
  "Wakes happily",
  "No bad dreams",
  "Dear to human beings",
  "Dear to non-human beings",
  "Protected by devas",
  "No fire, poison, or weapons harm easily",
  "Mind quickly concentrates",
  "Complexion grows serene",
  "Dies unconfused",
  "If not fully liberated, reaches Brahma world",
];

export const sutta: SuttaSeed = {
  id: "AN 11.16",
  canon:
    "A bhikkhu who develops loving-kindness sleeps happily, wakes happily, and does not dream badly. He is dear to human and non-human beings, protected by devas, and his mind quickly settles in concentration.",
  advantages: TITLES.map((title, idx) => ({
    n: idx + 1,
    title,
    img: `/images/an11/${idx + 1}.jpg`,
  })),
};

