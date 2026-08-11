import type { NextConfig } from "next";
import path from "path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  output: "standalone",

  // Restrict to apps/web to avoid EPERM symlink errors on Windows
  // (pnpm store symlinks require Developer Mode to replicate).
  // Webpack bundles all @ar/* packages, so cross-directory tracing
  // isn't needed for them.
  outputFileTracingRoot: path.resolve(__dirname),

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
};

export default nextConfig;
