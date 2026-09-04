// @ts-check
import { defineConfig } from "astro/config";

import solidJs from "@astrojs/solid-js";

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs()],
  site: "https://l1lith.github.io",
  base: "/Lilis-Game-Engine/pixi-rudimentary", // This is the subpath
  output: "static", // SSG mode
});
