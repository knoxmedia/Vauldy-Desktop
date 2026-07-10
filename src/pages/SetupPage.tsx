import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { checkHealth, fetchBranding } from "@/api/client";
import { normalizeServerUrl, useConfigStore } from "@/store/config";

export default function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const serverUrl = useConfigStore((s) => s.serverUrl);
  const setServerUrl = useConfigStore((s) => s.setServerUrl);
  const setAppName = useConfigStore((s) => s.setAppName);
  const [url, setUrl] = useState(serverUrl || "http://127.0.0.1:8200");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function testConnection() {
    setLoading(true);
    setError(null);
    setOk(false);
    const normalized = normalizeServerUrl(url);
    setServerUrl(normalized);
    try {
      const healthy = await checkHealth();
      if (!healthy) throw new Error("health");
      const branding = await fetchBranding();
      setAppName(branding.app_name);
      setOk(true);
    } catch {
      setError(t("setup.failed"));
      setServerUrl(null);
    } finally {
      setLoading(false);
    }
  }

  function onContinue() {
    navigate("/login", { replace: true });
  }

  return (
    <div className="page-center">
      <div className="auth-card">
        <h1 className="auth-title">{t("setup.title")}</h1>
        <p className="auth-hint">{t("setup.hint")}</p>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {ok ? <div className="alert alert-success">{t("setup.success")}</div> : null}
        <div className="form-field">
          <label className="form-label" htmlFor="server-url">
            {t("setup.server_url")}
          </label>
          <input
            id="server-url"
            className="form-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://127.0.0.1:8200"
          />
        </div>
        <button type="button" className="btn btn-secondary btn-block" disabled={loading} onClick={() => void testConnection()}>
          {t("setup.test")}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 12 }}
          disabled={!ok || loading}
          onClick={onContinue}
        >
          {t("setup.continue")}
        </button>
      </div>
    </div>
  );
}
