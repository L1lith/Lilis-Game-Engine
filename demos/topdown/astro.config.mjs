// @ts-check
import { defineConfig } from "astro/config";
import solidJs from "@astrojs/solid-js";
import solidSvg from "vite-plugin-solid-svg";
import svgoConfig from "./svgo.config.mjs";

// Check if we're running in GitHub Actions
const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

// Base configuration for all environments
const config = {
  integrations: [solidJs()],
  vite: {
    plugins: [
      solidSvg({
        defaultAsComponent: false,
        svgo: { enabled: true, svgoConfig },
      }),
    ],
  },
};

// Add GitHub Pages specific settings only when in GitHub Actions
if (isGitHubActions) {
  config.site = "https://engine.webslc.com";
  config.base = "/demos/topdown";
  config.output = "static";
}

// https://astro.build/config
export default defineConfig(config);
