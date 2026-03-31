import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { writeFileSync, mkdirSync } from "fs";

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://testio.online/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://testio.online/auth</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://testio.online/terms</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>
  <url><loc>https://testio.online/verify-email</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>
  <url><loc>https://testio.online/reset-password</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>
</urlset>`;

const robotsTxt = `User-agent: *\nAllow: /\nSitemap: https://testio.online/sitemap.xml\n`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "generate-seo-files",
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        writeFileSync("dist/sitemap.xml", sitemapXml);
        writeFileSync("dist/robots.txt", robotsTxt);
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
