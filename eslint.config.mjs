import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "scripts/dev/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Signed preview URLs are plain <img> on purpose (see next.config.ts).
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default config;
