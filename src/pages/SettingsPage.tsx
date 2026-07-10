import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { checkHealth, fetchBranding, logout, updateUserProfile } from "@/api/client";
import { PageLayout } from "@/components/AppShell";
import { useAuthStore } from "@/store/auth";
import { normalizeServerUrl, useConfigStore, type CloseBehavior } from "@/store/config";

const VERSION = "0.1.0";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const username = useAuthStore((s) => s.username);
  const clearSession = useAuthStore((s) => s.clearSession);
  const serverUrl = useConfigStore((s) => s.serverUrl);
  const closeBehavior = useConfigStore((s) => s.closeBehavior);
  const setServerUrl = useConfigStore((s) => s.setServerUrl);
  const setAppName = useConfigStore((s) => s.setAppName);
  const setCloseBehavior = useConfigStore((s) => s.setCloseBehavior);
  const [url, setUrl] = useState(serverUrl || "");
  const [locale, setLocale] = useState(i18n.language);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveServer() {
    const normalized = normalizeServerUrl(url);
    setServerUrl(normalized);
    try {
      const ok = await checkHealth();
      if (!ok) throw new Error("health");
      const branding = await fetchBranding();
      setAppName(branding.app_name);
      setMsg(t("setup.success"));
    } catch {
      setMsg(t("setup.failed"));
    }
  }

  async function saveLocale() {
    const ui_locale = locale === "en" ? "en-US" : "zh-CN";
    try {
      await updateUserProfile({ ui_locale });
      void i18n.changeLanguage(locale);
      setMsg(t("common.save"));
    } catch {
      setMsg(t("common.error"));
    }
  }

  async function onLogout() {
    await logout();
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <PageLayout title={t("settings.title")}>
      {msg ? <div className="alert alert-success">{msg}</div> : null}

      <section className="settings-section">
        <h3>{t("settings.server")}</h3>
        <div className="form-field">
          <input className="form-input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void saveServer()}>
          {t("common.save")}
        </button>
      </section>

      <section className="settings-section">
        <h3>{t("settings.language")}</h3>
        <div className="settings-row">
          <select className="form-select" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={() => void saveLocale()}>
            {t("common.save")}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h3>{t("settings.close_behavior")}</h3>
        <div className="settings-row">
          <select
            className="form-select"
            value={closeBehavior}
            onChange={(e) => setCloseBehavior(e.target.value as CloseBehavior)}
          >
            <option value="tray">{t("settings.close_tray")}</option>
            <option value="exit">{t("settings.close_exit")}</option>
          </select>
        </div>
      </section>

      <section className="settings-section">
        <h3>{username || t("settings.title")}</h3>
        <button type="button" className="btn btn-secondary" onClick={() => void onLogout()}>
          {t("settings.logout")}
        </button>
      </section>

      <section className="settings-section">
        <h3>{t("settings.about")}</h3>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{t("settings.version", { version: VERSION })}</p>
      </section>
    </PageLayout>
  );
}
