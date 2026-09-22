import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const plugins = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/plugins" }),
});

export const collections = { plugins };
