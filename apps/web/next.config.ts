/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      resolveAliases: {
        "@ar/db": "../../packages/db/src",
        "@ar/wa": "../../packages/wa/src",
        "@ar/splits": "../../packages/splits/src",
        "@ar/ai": "../../packages/ai/src",
        "@ar/docs-gen": "../../packages/docs-gen/src",
        "@ar/ui": "../../packages/ui/src",
        "@ar/shared": "../../packages/shared/src",
      },
    },
  },
};

export default nextConfig;
