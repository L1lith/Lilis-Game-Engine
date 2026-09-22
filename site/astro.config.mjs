import { defineConfig } from "astro/config";
import solidJs from "@astrojs/solid-js";
import mdx from "@astrojs/mdx";

// Check if we're running in GitHub Actions
const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

// Base configuration for all environments
const config = {
  integrations: [solidJs(), mdx()],
};

// Add GitHub Pages specific settings only when in GitHub Actions
if (isGitHubActions) {
  config.site = "https://engine.webslc.com";
  config.base = "/";
  config.output = "static";
}

// https://astro.build/config
export default defineConfig(config);
