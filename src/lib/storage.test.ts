import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "@/lib/constants";
import { getThemeMode, saveThemeMode } from "@/lib/storage";

describe("theme mode persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists light, dark, and system theme modes", () => {
    saveThemeMode("light");
    expect(getThemeMode()).toBe("light");

    saveThemeMode("dark");
    expect(getThemeMode()).toBe("dark");

    saveThemeMode("system");
    expect(getThemeMode()).toBe("system");
  });

  it("falls back to system for invalid stored theme mode", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode: "sepia" }));

    expect(getThemeMode()).toBe("system");
  });

  it("does not throw when stored app data is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "{broken json");

    expect(() => getThemeMode()).not.toThrow();
    expect(getThemeMode()).toBe("system");
  });
});
