import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchUserInfo, login } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { initI18n } from "@/i18n";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await login(username, password);
      setToken(token);
      const info = await fetchUserInfo();
      setProfile(info.username, info.role, {
        canPlay: info.can_play,
        avatarUrl: info.avatar_url,
        uiLocale: info.ui_locale,
      });
      initI18n(info.ui_locale);
      void i18n.changeLanguage(info.ui_locale?.startsWith("en") ? "en" : "zh-CN");
      navigate("/", { replace: true });
    } catch {
      setError(t("login.failed"));
      useAuthStore.getState().clearSession();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-center">
      <form className="auth-card" onSubmit={(e) => void onSubmit(e)}>
        <h1 className="auth-title">{t("login.title")}</h1>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <div className="form-field">
          <label className="form-label" htmlFor="username">
            {t("login.username")}
          </label>
          <input
            id="username"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="password">
            {t("login.password")}
          </label>
          <input
            id="password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {t("login.submit")}
        </button>
      </form>
    </div>
  );
}
