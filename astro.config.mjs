import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://kololowieckieprzepiorka.pl",
  outDir: "./docs",
  trailingSlash: "always",
  integrations: [sitemap()],
  build: {
    format: "directory",
  },
});
