import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/.next-stale*/**",
      "**/.next.backup-*/**",
      "**/.next-bad-*/**",
      "**/.open-next/**",
      "**/.open-next.backup-*/**",
      "**/.playwright-cli/**",
      "**/.wrangler/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/pages-dist/**",
      "**/pages-dist.backup-*/**",
      "**/node_modules-stale-*/**",
      "**/coverage/**",
      "**/next-env.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.cjs", "**/tailwind.config.ts"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      "no-constant-binary-expression": "off",
      "no-useless-assignment": "off",
      "no-useless-escape": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
