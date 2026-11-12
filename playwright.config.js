import { defineConfig, devices } from "@playwright/test";

// Se BASE_URL estiver definida, usa um servidor que você já subiu.
// Caso contrário, sobe um servidor estático na porta 4173 automaticamente.
const externalUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalUrl || "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalUrl
    ? undefined
    : {
        command: "npx http-server . -p 4173 -c-1 --silent",
        url: "http://localhost:4173",
        reuseExistingServer: true,
        timeout: 30_000,
      },
  // npm run test:e2e        -> desktop + mobile (Chromium; rápido, uso diário)
  // npm run test:e2e:todos  -> + Firefox, WebKit (Safari) e iPhone
  // npm run test:e2e:edge   -> Microsoft Edge (precisa do Edge instalado)
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
  ],
});
