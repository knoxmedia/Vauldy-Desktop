import { create, type StoreApi, type UseBoundStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PlayerPrefs } from "@web/lib/playerPrefs";

export type UserRole = "admin" | "user" | "api_client";

export function isAdminRole(role: UserRole | null | undefined) {
  return role === "admin";
}

type AuthState = {
  token: string | null;
  role: UserRole | null;
  username: string | null;
  canPlay: boolean | null;
  avatarUrl: string | null;
  uiLocale: string | null;
  playerPrefs: PlayerPrefs | null;
  setToken: (t: string | null) => void;
  setProfile: (
    username: string,
    role: UserRole,
    caps?: {
      canPlay?: boolean;
      avatarUrl?: string | null;
      uiLocale?: string | null;
      playerPrefs?: PlayerPrefs | null;
    },
  ) => void;
  clearSession: () => void;
};

type AuthStore = UseBoundStore<StoreApi<AuthState>>;

const AUTH_STORE_GLOBAL = "__vauldy_desktop_auth_store__";

function createAuthStore(): AuthStore {
  return create<AuthState>()(
    persist(
      (set) => ({
        token: null,
        role: null,
        username: null,
        canPlay: null,
        avatarUrl: null,
        uiLocale: null,
        playerPrefs: null,
        setToken: (t) => set({ token: t }),
        setProfile: (username, role, caps) =>
          set({
            username,
            role,
            ...(caps?.canPlay !== undefined ? { canPlay: caps.canPlay } : {}),
            ...(caps?.avatarUrl !== undefined ? { avatarUrl: caps.avatarUrl } : {}),
            ...(caps?.uiLocale !== undefined ? { uiLocale: caps.uiLocale } : {}),
            ...(caps?.playerPrefs !== undefined ? { playerPrefs: caps.playerPrefs } : {}),
          }),
        clearSession: () =>
          set({
            token: null,
            role: null,
            username: null,
            canPlay: null,
            avatarUrl: null,
            uiLocale: null,
            playerPrefs: null,
          }),
      }),
      {
        name: "vauldy-desktop-auth",
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({
          token: s.token,
          role: s.role,
          username: s.username,
          avatarUrl: s.avatarUrl,
          uiLocale: s.uiLocale,
          playerPrefs: s.playerPrefs,
        }),
      },
    ),
  );
}

/**
 * Process-wide singleton. The web↔desktop Vite bridge can evaluate this module
 * twice under different IDs; without a global latch, language updates write to
 * one store while the shell reads another.
 */
export const useAuthStore: AuthStore = (() => {
  const g = globalThis as typeof globalThis & { [AUTH_STORE_GLOBAL]?: AuthStore };
  if (!g[AUTH_STORE_GLOBAL]) {
    g[AUTH_STORE_GLOBAL] = createAuthStore();
  }
  return g[AUTH_STORE_GLOBAL];
})();
