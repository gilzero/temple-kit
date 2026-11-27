// @file: eslint.config.js
// @desc: lint shared temple kit sources
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**"] },
  ...tseslint.configs.recommended,
);
