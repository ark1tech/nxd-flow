import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["packages/**/*.test.ts"],
    exclude: ["**/.autopilot/**", "**/node_modules/**", "**/dist/**"],
    testTimeout: 30000
  }
});
