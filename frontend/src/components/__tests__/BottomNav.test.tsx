import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "../BottomNav";

let pathname = "/";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname }),
  Link: ({ to, children, className, ...props }: { to: string; children: React.ReactNode; className?: string; [key: string]: any }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe("BottomNav", () => {
  beforeEach(() => {
    pathname = "/";
    document.documentElement.style.removeProperty("--dama-bottom-pad");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the Home icon as the primary control", () => {
    render(<BottomNav />);

    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("highlights the Home icon when on the home page", () => {
    pathname = "/";
    const { container } = render(<BottomNav />);

    // The icon is inside the link
    const icon = container.querySelector(".lucide-house");
    expect(icon).toHaveClass("text-primary");
  });

  it("dims the Home icon when not on the home page", () => {
    pathname = "/sutta/1.48";
    const { container } = render(<BottomNav />);

    const icon = container.querySelector(".lucide-house");
    expect(icon).toHaveClass("text-muted-foreground");
  });
});
