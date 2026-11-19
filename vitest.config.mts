import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@leave": fileURLToPath(new URL("./apps/leave/", import.meta.url)),
      "@": fileURLToPath(new URL("./apps/timer/", import.meta.url)),
    },
  },
  test: { include: ["tests/**/*.test.ts"], 
    environment: "node" ,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    maxWorkers: 2,
  },
});


