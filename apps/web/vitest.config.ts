import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@ar/db": path.resolve(__dirname, "../../packages/db/src"),
      "@ar/wa": path.resolve(__dirname, "../../packages/wa/src"),
      "@ar/splits": path.resolve(__dirname, "../../packages/splits/src"),
      "@ar/ai": path.resolve(__dirname, "../../packages/ai/src"),
      "@ar/docs-gen": path.resolve(__dirname, "../../packages/docs-gen/src"),
      "@ar/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@ar/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
