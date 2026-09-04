// @ts-check
import { defineConfig } from "astro/config";
import solidJs from "@astrojs/solid-js";

// Check if we're running in GitHub Actions
const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

// Base configuration for all environments
const config = {
  integrations: [solidJs()],
};

// Add GitHub Pages specific settings only when in GitHub Actions
if (isGitHubActions) {
  config.site = "https://l1lith.github.io";
  config.base = "/Lilis-Game-Engine/examples/level-loader-demo";
  config.output = "static";
}

// https://astro.build/config
export default defineConfig(config);
