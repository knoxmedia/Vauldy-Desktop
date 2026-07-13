import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;
const webRoot = path.resolve(__dirname, "../web/src");
const desktopRoot = path.resolve(__dirname, "src");

/** Normalized absolute paths — must be identical everywhere to avoid duplicate React context / zustand stores. */
const desktopI18n = path.resolve(desktopRoot, "i18n/index.ts");
const desktopAuth = path.resolve(desktopRoot, "store/auth.ts");
const desktopApi = path.resolve(desktopRoot, "api/client.ts");
const desktopBranding = path.resolve(desktopRoot, "store/branding.ts");
const desktopReact = path.resolve(__dirname, "node_modules/react");
const desktopReactDom = path.resolve(__dirname, "node_modules/react-dom");
const desktopReactRouter = path.resolve(__dirname, "node_modules/react-router-dom");

const DESKTOP_OVERRIDES: Record<string, string> = {
  "store/auth.ts": desktopAuth,
  "api/client.ts": desktopApi,
  "store/branding.ts": desktopBranding,
  "i18n/index.ts": desktopI18n,
};

function resolveWithExtensions(base: string): string | null {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function webUiBridge(): Plugin {
  return {
    name: "web-ui-bridge",
    enforce: "pre",
    resolveId(source, importer) {
      // Bare / alias singletons (App + web must share one module instance).
      if (source === "@/i18n" || source === "@/i18n/index.ts" || source === "@/i18n/index") {
        return desktopI18n;
      }
      if (source === "@/store/auth" || source === "@/store/auth.ts") {
        return desktopAuth;
      }
      if (source === "react") return desktopReact;
      if (source === "react-dom") return desktopReactDom;
      if (source === "react-router-dom") return desktopReactRouter;

      // Direct absolute / @fs hits on web copies → desktop singletons.
      const normSource = source.replace(/\\/g, "/");
      if (normSource.includes("/web/src/i18n/") || /\/web\/src\/i18n$/.test(normSource)) {
        return desktopI18n;
      }
      if (normSource.includes("/web/src/store/auth")) return desktopAuth;
      if (normSource.includes("/web/src/api/client")) return desktopApi;
      if (normSource.includes("/web/src/store/branding")) return desktopBranding;

      if (!importer || !source.startsWith(".")) return null;
      const normImporter = importer.replace(/\\/g, "/");
      if (!normImporter.includes("/web/src/")) return null;

      const resolved = resolveWithExtensions(path.resolve(path.dirname(importer), source));
      if (!resolved) return null;

      const rel = path.relative(webRoot, resolved).replace(/\\/g, "/");
      const override = DESKTOP_OVERRIDES[rel];
      return override ?? null;
    },
    transform(code, id) {
      const normId = id.replace(/\\/g, "/");
      if (!normId.includes("/web/src/") || normId.includes("/web/src/i18n/")) return null;

      let out = code;
      let changed = false;

      // Rewrite relative singleton imports to @/ so App + web share one module graph node.
      const rewritten = out
        .replace(/(from\s+["'])(?:\.\.\/)+i18n(?:\/index)?(["'])/g, "$1@/i18n$2")
        .replace(/(from\s+["'])(?:\.\.\/)+store\/auth(?:\.ts)?(["'])/g, "$1@/store/auth$2")
        .replace(/(from\s+["'])(?:\.\.\/)+api\/client(?:\.ts)?(["'])/g, "$1@/api/client$2")
        .replace(/(from\s+["'])(?:\.\.\/)+store\/branding(?:\.ts)?(["'])/g, "$1@/store/branding$2");
      if (rewritten !== out) {
        out = rewritten;
        changed = true;
      }

      if (normId.includes("/web/src/pages/PhotoBrowse.tsx")) {
        const browsePatched = out.replace(
          `  useEffect(() => {
    void load();
  }, [load]);`,
          `  useEffect(() => {
    void load();
  }, [libraryId, sortMode, drillDown]);`,
        );
        if (browsePatched !== out) {
          out = browsePatched;
          changed = true;
        }
      }

      if (normId.includes("/web/src/components/PhotoLightbox.tsx")) {
        let lightboxPatched = out.replace(
          "  }, [index, resetView, item?.photo_tags]);",
          "  }, [index, resetView, item?.id]);",
        );
        if (!lightboxPatched.includes("onError={() => setLoading(false)}")) {
          lightboxPatched = lightboxPatched.replace(
            `            onLoad={(e) => {
              const img = e.currentTarget;
              setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
              setLoading(false);
            }}`,
            `            onError={() => setLoading(false)}
            onLoad={(e) => {
              const img = e.currentTarget;
              setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
              setLoading(false);
            }}`,
          );
        }
        if (lightboxPatched !== out) {
          out = lightboxPatched;
          changed = true;
        }
      }

      return changed ? out : null;
    },
  };
}

export default defineConfig({
  plugins: [react(), webUiBridge()],
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: [
      { find: "@", replacement: desktopRoot },
      { find: "@web", replacement: webRoot },
      { find: "react", replacement: desktopReact },
      { find: "react-dom", replacement: desktopReactDom },
      { find: "react-router-dom", replacement: desktopReactRouter },
      // Pin web tree copies to desktop singletons (covers non-relative imports).
      { find: path.resolve(webRoot, "i18n/index.ts"), replacement: desktopI18n },
      { find: path.resolve(webRoot, "i18n"), replacement: desktopI18n },
      { find: path.resolve(webRoot, "store/auth.ts"), replacement: desktopAuth },
      { find: path.resolve(webRoot, "store/auth"), replacement: desktopAuth },
      { find: path.resolve(webRoot, "api/client.ts"), replacement: desktopApi },
      { find: path.resolve(webRoot, "api/client"), replacement: desktopApi },
      { find: path.resolve(webRoot, "store/branding.ts"), replacement: desktopBranding },
      { find: path.resolve(webRoot, "store/branding"), replacement: desktopBranding },
    ],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
