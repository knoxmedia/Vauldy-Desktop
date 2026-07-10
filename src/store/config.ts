import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CloseBehavior = "exit" | "tray";

type ConfigState = {
  serverUrl: string | null;
  appName: string;
  closeBehavior: CloseBehavior;
  setServerUrl: (url: string | null) => void;
  setAppName: (name: string) => void;
  setCloseBehavior: (b: CloseBehavior) => void;
};

export function normalizeServerUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) {
    u = `http://${u}`;
  }
  return u;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      serverUrl: null,
      appName: "Vauldy",
      closeBehavior: "tray",
      setServerUrl: (url) => set({ serverUrl: url ? normalizeServerUrl(url) : null }),
      setAppName: (name) => set({ appName: name || "Vauldy" }),
      setCloseBehavior: (b) => set({ closeBehavior: b }),
    }),
    {
      name: "vauldy-desktop-config",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
