import type { AILinkSettings, AIProvider } from "@/types/quiz";

export interface BuiltAIUrl {
  url: string;
  usedFallback: boolean;
}

function normalizeConversationId(provider: AIProvider, rawRef: string): string | null {
  const value = rawRef.trim();
  if (!value) return null;

  // Accept plain IDs directly.
  if (!value.includes("/") && !value.includes("?")) return value;

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (provider === "chatgpt") {
      const cIndex = parts.findIndex((part) => part === "c");
      if (cIndex >= 0 && parts[cIndex + 1]) return parts[cIndex + 1];
    }

    if (provider === "claude") {
      const chatIndex = parts.findIndex((part) => part === "chat");
      if (chatIndex >= 0 && parts[chatIndex + 1]) return parts[chatIndex + 1];
    }
  } catch {
    return null;
  }

  return null;
}

function buildNewChatUrl(provider: AIProvider, encodedPrompt: string): string {
  if (provider === "chatgpt") return `https://chatgpt.com/?q=${encodedPrompt}`;
  return `https://claude.ai/?q=${encodedPrompt}`;
}

function buildContinueUrl(provider: AIProvider, conversationId: string, encodedPrompt: string): string {
  if (provider === "chatgpt") return `https://chatgpt.com/c/${conversationId}/?q=${encodedPrompt}`;
  return `https://claude.ai/chat/${conversationId}?q=${encodedPrompt}`;
}

export function buildAIUrl(
  provider: AIProvider,
  prompt: string,
  settings: AILinkSettings
): BuiltAIUrl {
  const encodedPrompt = encodeURIComponent(prompt);
  const providerConfig = settings[provider];

  if (providerConfig.mode === "new") {
    return { url: buildNewChatUrl(provider, encodedPrompt), usedFallback: false };
  }

  const conversationId = normalizeConversationId(provider, providerConfig.conversationRef);
  if (!conversationId) {
    return { url: buildNewChatUrl(provider, encodedPrompt), usedFallback: true };
  }

  return {
    url: buildContinueUrl(provider, conversationId, encodedPrompt),
    usedFallback: false,
  };
}
