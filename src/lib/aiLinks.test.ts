import { describe, expect, it } from "vitest";
import { buildAIUrl } from "@/lib/aiLinks";
import type { AILinkSettings } from "@/types/quiz";

const prompt = "Explain this question";
const encodedPrompt = encodeURIComponent(prompt);
const chatId = "6a0656e6-e744-83a6-b89c-3fb60e18fea5";
const projectSlug = "g-p-69fc23df0214819196266ebeb0166b22-programming-languages";

function settings(conversationRef: string): AILinkSettings {
  return {
    chatgpt: { mode: "continue", conversationRef },
    claude: { mode: "continue", conversationRef },
  };
}

describe("buildAIUrl", () => {
  it("builds a ChatGPT continue URL from a plain id", () => {
    const result = buildAIUrl("chatgpt", prompt, settings(chatId));

    expect(result).toEqual({
      url: `https://chatgpt.com/c/${chatId}?prompt=${encodedPrompt}`,
      usedFallback: false,
    });
  });

  it("builds a ChatGPT continue URL from a normal chat URL", () => {
    const result = buildAIUrl("chatgpt", prompt, settings(`https://chatgpt.com/c/${chatId}`));

    expect(result.url).toBe(`https://chatgpt.com/c/${chatId}?prompt=${encodedPrompt}`);
    expect(result.usedFallback).toBe(false);
  });

  it("preserves ChatGPT project or GPT context from a project chat URL", () => {
    const result = buildAIUrl("chatgpt", prompt, settings(`https://chatgpt.com/g/${projectSlug}/c/${chatId}`));

    expect(result.url).toBe(`https://chatgpt.com/g/${projectSlug}/c/${chatId}?prompt=${encodedPrompt}`);
    expect(result.usedFallback).toBe(false);
  });

  it("converts a normal ChatGPT shared URL into a continue URL", () => {
    const result = buildAIUrl("chatgpt", prompt, settings(`https://chatgpt.com/share/${chatId}`));

    expect(result.url).toBe(`https://chatgpt.com/c/${chatId}?prompt=${encodedPrompt}`);
    expect(result.usedFallback).toBe(false);
  });

  it("converts a project ChatGPT shared URL into a project continue URL", () => {
    const result = buildAIUrl(
      "chatgpt",
      prompt,
      settings(`https://chatgpt.com/g/${projectSlug}/shared/c/${chatId}?owner_user_id=user-fJePRDBLRh65qIWbtaEztfc2`)
    );

    expect(result.url).toBe(`https://chatgpt.com/g/${projectSlug}/c/${chatId}?prompt=${encodedPrompt}`);
    expect(result.usedFallback).toBe(false);
  });

  it("falls back for invalid ChatGPT hosts", () => {
    const result = buildAIUrl("chatgpt", prompt, settings(`https://example.com/c/${chatId}`));

    expect(result.url).toBe(`https://chatgpt.com/?prompt=${encodedPrompt}`);
    expect(result.usedFallback).toBe(true);
  });

  it("keeps Claude chat URL support unchanged", () => {
    const result = buildAIUrl("claude", prompt, settings(`https://claude.ai/chat/${chatId}`));

    expect(result.url).toBe(`https://claude.ai/chat/${chatId}?prompt=${encodedPrompt}`);
    expect(result.usedFallback).toBe(false);
  });
});
