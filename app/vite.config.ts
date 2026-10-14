import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {
  higgsfieldDesignInspectorVitePlugin,
  higgsfieldDesignSourceBabelPlugin,
} from "./src/module/design-inspector/vite";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { nitro } from "nitro/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const designInspectorEnabled = process.env.HF_DESIGN_INSPECTOR === "1" || mode === "design";
  const isVercel = process.env.DEPLOY_TARGET === "vercel" || process.env.VERCEL === "1";

  return {
    // The server bundle runs as a Cloudflare Worker — there is no node_modules
    // at runtime. Vite's default SSR build leaves npm deps as bare external
    // imports (h3, react, @tanstack/*, seroval, …), which resolve on a Node
    // server but throw "No such module" in a Worker. Bundle them all in.
    // (node: builtins stay external — nodejs_compat provides them.)
    ...(isVercel ? {
      resolve: { alias: [{ find: /^.*bindings\.server$/, replacement: resolve(__dirname, "src/lib/bindings.vercel.server.ts") }] },
    } : {
      // The current Higgsfield deployment is a Cloudflare Worker runtime.
      ssr: { noExternal: true, external: ["cloudflare:workers"] },
      build: { rollupOptions: { external: [/^cloudflare:/] } },
    }),
    plugins: [
      // Material Symbols SVGs (the app icon set) import as React components via
      // `?react`. `icon: true` sizes them 1em; fill is forced to currentColor so
      // they color like text (the raw SVGs have no fill attribute). Keep the
      // viewBox so CSS sizing scales the glyph.
      svgr({
        svgrOptions: {
          icon: true,
          svgProps: { fill: "currentColor" },
          svgoConfig: {
            plugins: [
              { name: "preset-default", params: { overrides: { removeViewBox: false } } },
            ],
          },
        },
      }),
      // TanStack Start plugin must run before React's plugin.
      //
      // SSR build: `vite build` emits a Workers-shaped server bundle
      // (dist/server/server.js — `export default { fetch }`) plus dist/client
      // (hashed static assets). The platform publishes that as a per-tenant
      // Worker on Workers for Platforms, served at <sub>.higgsfield.app/ (host
      // root, so Vite's default base "/" — no base-path juggling).
      //
      // Rendering happens on the server per request, so site code must be
      // SSR-safe: never touch browser-only globals (window, document,
      // localStorage, navigator) during render or at module top level — only
      // inside effects/handlers, or guarded with `typeof window !== "undefined"`.
      tanstackStart(isVercel ? {} : { server: { entry: "server" } }),
      ...(isVercel ? [nitro()] : []),
      higgsfieldDesignInspectorVitePlugin(designInspectorEnabled),
      react({
        babel: {
          plugins: designInspectorEnabled ? [higgsfieldDesignSourceBabelPlugin] : [],
        },
      }),
      tailwindcss(),
      tsconfigPaths(),
    ],
  };
});
