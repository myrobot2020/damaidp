import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookOfOnesInterpretations } from "../BookOfOnesInterpretations";

const linkProps: { latest: Array<{ to: string; params?: { suttaId: string } }> } = {
  latest: [],
};

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params?: { suttaId: string };
    children: React.ReactNode;
    className?: string;
  }) => {
    linkProps.latest.push({ to, params });
    return (
      <a href={`${to}/${params?.suttaId ?? ""}`} className={className}>
        {children}
      </a>
    );
  },
}));

describe("BookOfOnesInterpretations", () => {
  it("renders the current sutta visual interpretation card with its practice link", () => {
    linkProps.latest = [];
    render(<BookOfOnesInterpretations currentSuttaId="AN 1.18.13" />);

    expect(screen.getByRole("heading", { name: "Book of Ones interpretations" })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Practice" })).toHaveLength(1);
    expect(linkProps.latest.map((x) => x.to)).toEqual(["/practice/$suttaId"]);
    expect(linkProps.latest.map((x) => x.params?.suttaId)).toEqual(["AN 1.18.13"]);
  });

  it("renders nothing outside the five Book of Ones cards", () => {
    const { container } = render(<BookOfOnesInterpretations currentSuttaId="AN 1.48" />);

    expect(container).toBeEmptyDOMElement();
  });
});
