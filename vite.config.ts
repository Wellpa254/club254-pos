import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

// Deployment target: Nitro auto-detects the host (Vercel, Netlify, Cloudflare, Node...).
// To force one, set NITRO_PRESET at build time, e.g. NITRO_PRESET=node-server or cloudflare-module.
export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
    VitePWA({
      strategies: "generateSW",
      // Nitro serves .output/public; without this sw.js lands in dist/ and 404s in production.
      outDir: ".output/public",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: {
        name: "Blooms Members Club",
        short_name: "Blooms",
        description: "POS, inventory, shifts and financial intelligence for clubs, bars and lounges.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0b0c0e",
        theme_color: "#0b0c0e",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,woff2,png,svg,ico,jpg,webp}"],
        globIgnores: ["**/og-image.jpg"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "clubos-pages", networkTimeoutSeconds: 4, expiration: { maxEntries: 40 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: { cacheName: "clubos-assets", expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query", "@tanstack/react-start"],
  },
}));
