import type { NextConfig } from "next";
import path from "path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  output: "standalone",

  // Required for monorepo — OpenNext needs the full monorepo context
  // to resolve the nested standalone path (apps/web/.next/standalone/apps/web/...).
  outputFileTracingRoot: path.resolve(__dirname, "../.."),

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
