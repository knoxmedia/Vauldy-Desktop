import { create } from "zustand";
import { fetchBranding } from "@/api/client";
import { useConfigStore } from "@/store/config";

export type BrandingState = {
  appName: string;
  faviconUrl: string;
  loaded: boolean;
  load: () => Promise<void>;
};

const DEFAULT_APP_NAME = "Vauldy";

function applyBrandingToDocument(appName: string, faviconUrl: string) {
  if (typeof document === "undefined") return;
  document.title = appName;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  const ext = faviconUrl.split("?")[0].split(".").pop()?.toLowerCase();
  link.type =
    ext === "png" ? "image/png" : ext === "ico" ? "image/x-icon" : "image/svg+xml";
  link.href = faviconUrl;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  appName: useConfigStore.getState().appName || DEFAULT_APP_NAME,
  faviconUrl: "/favicon.svg",
  loaded: false,
  load: async () => {
    try {
      const data = await fetchBranding();
      const appName = (data.app_name || DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
      const faviconUrl = (data.favicon_url || "/favicon.svg").trim() || "/favicon.svg";
      applyBrandingToDocument(appName, faviconUrl);
      useConfigStore.getState().setAppName(appName);
      set({ appName, faviconUrl, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));

export function useAppName(): string {
  return useBrandingStore((s) => s.appName);
}
