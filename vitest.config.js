import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Necessário para os onclick="..." inline do app funcionarem no jsdom.
    environmentOptions: {
      jsdom: { runScripts: "dangerously", pretendToBeVisual: true },
    },
    globals: true,
    include: ["tests/**/*.test.js"],
    exclude: ["node_modules/**", "e2e/**"],
  },
});
