// @ts-check
import { defineConfig } from "astro/config";
import solidJs from "@astrojs/solid-js";
import solidSvg from "vite-plugin-solid-svg";
import svgoConfig from "./svgo.config.mjs";

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs()],
  vite: {
    plugins: [
      solidSvg({
        defaultAsComponent: false,
        svgo: { enabled: true, svgoConfig },
      }),
    ],
  },
});
