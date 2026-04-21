import type { StorybookConfig } from "@storybook/nextjs";

/**
 * Minimal Storybook config for the CORE Discovery Framework UI.
 *
 * Intentionally lightweight — Storybook is treated as an opt-in dev tool.
 * Install with:
 *   pnpm add -D @storybook/nextjs @storybook/react storybook
 * Then run:
 *   pnpm storybook
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: [],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
};

export default config;
