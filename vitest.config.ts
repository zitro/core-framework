import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    globals: true,
    // Avoid worker_threads + jsdom hang seen with vitest 4.1 / jsdom 29.
    pool: "forks",
    // Hard timeouts so a hung test surfaces in CI instead of consuming runner minutes.
    testTimeout: 15000,
    hookTimeout: 15000,
    teardownTimeout: 5000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
