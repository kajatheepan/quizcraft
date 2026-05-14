import { beforeEach, describe, expect, it } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizCraftApp from "@/components/QuizCraftApp";

describe("QuizCraftApp smoke", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("quizcraft_onboarding_seen", "true");
  });

  it("renders the home screen primary actions and theme selector", () => {
    render(React.createElement(QuizCraftApp));

    expect(screen.getByRole("heading", { name: /welcome to\s*quizcraft plus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /paste a quiz/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate one with ai/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /theme selector/i })).toBeInTheDocument();
  });

  it("navigates to the prompt page", async () => {
    const user = userEvent.setup();
    render(React.createElement(QuizCraftApp));

    await user.click(screen.getAllByRole("button", { name: /get ai prompt/i })[0]);

    expect(await screen.findByText(/prompt preview/i)).toBeInTheDocument();
  });
});
