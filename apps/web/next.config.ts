import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack(config) {
    // ===== @ar/* workspace packages =====
    const arPackages = [
      "db",
      "wa",
      "splits",
      "ai",
      "docs-gen",
      "ui",
      "shared",
    ] as const;

    for (const pkg of arPackages) {
      config.resolve.alias[`@ar/${pkg}`] = path.resolve(
        __dirname,
        `../../packages/${pkg}/src`,
      );
    }

    // ===== @/* → apps/web/* =====
    config.resolve.alias["@"] = path.resolve(__dirname, ".");

    return config;
  },

  // Required for monorepo file tracing
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
};

export default nextConfig;
