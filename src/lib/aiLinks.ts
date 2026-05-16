import type { AILinkSettings, AIProvider } from "@/types/quiz";

export interface BuiltAIUrl {
  url: string;
  usedFallback: boolean;
}

interface NormalizedConversationRef {
  path: string;
}

function isPlainRef(value: string): boolean {
  return !value.includes("/") && !value.includes("?");
}

function isChatGPTHost(hostname: string): boolean {
  return hostname === "chatgpt.com" || hostname === "www.chatgpt.com";
}

function normalizeChatGPTRef(rawRef: string): NormalizedConversationRef | null {
  const value = rawRef.trim();
  if (!value) return null;

  if (isPlainRef(value)) return { path: `/c/${encodeURIComponent(value)}` };

  try {
    const parsed = new URL(value);
    if (!isChatGPTHost(parsed.hostname)) return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    const cIndex = parts.findIndex((part) => part === "c");

    if (parts[0] === "share" && parts[1]) {
      return { path: `/c/${encodeURIComponent(parts[1])}` };
    }

    if (parts[0] === "g" && parts[1] && cIndex >= 0 && parts[cIndex + 1]) {
      return {
        path: `/g/${encodeURIComponent(parts[1])}/c/${encodeURIComponent(parts[cIndex + 1])}`,
      };
    }

    if (cIndex >= 0 && parts[cIndex + 1]) {
      return { path: `/c/${encodeURIComponent(parts[cIndex + 1])}` };
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeClaudeRef(rawRef: string): NormalizedConversationRef | null {
  const value = rawRef.trim();
  if (!value) return null;

  // Accept plain IDs directly.
  if (isPlainRef(value)) return { path: `/chat/${encodeURIComponent(value)}` };

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);

    const chatIndex = parts.findIndex((part) => part === "chat");
    if (chatIndex >= 0 && parts[chatIndex + 1]) {
      return { path: `/chat/${encodeURIComponent(parts[chatIndex + 1])}` };
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeConversationRef(provider: AIProvider, rawRef: string): NormalizedConversationRef | null {
  if (provider === "chatgpt") return normalizeChatGPTRef(rawRef);
  return normalizeClaudeRef(rawRef);
}

function buildNewChatUrl(provider: AIProvider, encodedPrompt: string): string {
  if (provider === "chatgpt") return `https://chatgpt.com/?prompt=${encodedPrompt}`;
  return `https://claude.ai/?prompt=${encodedPrompt}`;
}

function buildContinueUrl(provider: AIProvider, conversationRef: NormalizedConversationRef, encodedPrompt: string): string {
  const base = provider === "chatgpt" ? "https://chatgpt.com" : "https://claude.ai";
  return `${base}${conversationRef.path}?prompt=${encodedPrompt}`;
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

  const conversationRef = normalizeConversationRef(provider, providerConfig.conversationRef);
  if (!conversationRef) {
    return { url: buildNewChatUrl(provider, encodedPrompt), usedFallback: true };
  }

  return {
    url: buildContinueUrl(provider, conversationRef, encodedPrompt),
    usedFallback: false,
  };
}
