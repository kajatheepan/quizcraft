import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders common study markdown blocks", () => {
    render(React.createElement(MarkdownRenderer, {
      content: [
        "## Why it works",
        "- First point",
        "- **Important** point with `code`",
        "",
        "| Term | Meaning |",
        "| --- | --- |",
        "| MAC | Address |",
        "",
        "```",
        "A -> B",
        "```",
      ].join("\n"),
    }));

    expect(screen.getByRole("heading", { name: "Why it works" })).toBeInTheDocument();
    expect(screen.getByText("First point")).toBeInTheDocument();
    expect(screen.getByText("Important")).toBeInTheDocument();
    expect(screen.getByText("MAC")).toBeInTheDocument();
    expect(screen.getByText("A -> B")).toBeInTheDocument();
  });

  it("renders raw HTML as text instead of executing it", () => {
    render(React.createElement(MarkdownRenderer, {
      content: "<img src=x onerror=alert(1)>",
    }));

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
