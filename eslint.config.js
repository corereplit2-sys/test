import tseslint from "typescript-eslint";

export default tseslint.config({
  ignores: [
    "node_modules/**",
    "dist/**",
    "build/**",
    "migrations/**",
    "*.config.js",
    "*.config.ts",
    "vite.config.ts",
    "tailwind.config.ts",
    "postcss.config.js",
    "client/src/workers/**",
    "**/*.d.ts",
  ],
  extends: [tseslint.configs.recommended],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "off",
  },
});
