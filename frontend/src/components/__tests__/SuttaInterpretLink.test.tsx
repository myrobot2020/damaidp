import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SuttaInterpretLink } from "../SuttaInterpretLink";

const linkProps = vi.hoisted(() => ({ latest: null as null | { to: string; params: unknown } }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params: unknown;
    children: React.ReactNode;
    className?: string;
  }) => {
    linkProps.latest = { to, params };
    return (
      <a href={to} className={className}>
        {children}
      </a>
    );
  },
}));

describe("SuttaInterpretLink", () => {
  it("links the current sutta to its practice route", () => {
    render(<SuttaInterpretLink suttaId="1.48" />);

    expect(screen.getByRole("link", { name: "Practice" })).toBeInTheDocument();
    expect(linkProps.latest).toEqual({ to: "/practice/$suttaId", params: { suttaId: "1.48" } });
  });
});
