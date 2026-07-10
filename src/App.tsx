import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { setUnauthorizedHandler } from "@/api/client";
import AppShell from "@/components/AppShell";
import { initI18n } from "@/i18n";
import BrowsePage from "@/pages/BrowsePage";
import FavoritesPage from "@/pages/FavoritesPage";
import HomePage from "@/pages/HomePage";
import LibraryPage from "@/pages/LibraryPage";
import LoginPage from "@/pages/LoginPage";
import MediaDetailPage from "@/pages/MediaDetailPage";
import PhotoPage from "@/pages/PhotoPage";
import PlayerPage from "@/pages/PlayerPage";
import ReaderPage from "@/pages/ReaderPage";
import SettingsPage from "@/pages/SettingsPage";
import SetupPage from "@/pages/SetupPage";
import { useAuthStore } from "@/store/auth";
import { useConfigStore } from "@/store/config";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const serverUrl = useConfigStore((s) => s.serverUrl);
  const location = useLocation();

  if (!serverUrl) return <Navigate to="/setup" replace />;
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function AuthEffects() {
  const navigate = useNavigate();
  const uiLocale = useAuthStore((s) => s.uiLocale);

  useEffect(() => {
    initI18n(uiLocale);
  }, [uiLocale]);

  useEffect(() => {
    setUnauthorizedHandler(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthEffects />
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="library/:id" element={<LibraryPage />} />
          <Route path="media/:id" element={<MediaDetailPage />} />
          <Route path="reader/:id" element={<ReaderPage />} />
        </Route>
        <Route
          path="/player/:id"
          element={
            <RequireAuth>
              <PlayerPage />
            </RequireAuth>
          }
        />
        <Route
          path="/photo/:id"
          element={
            <RequireAuth>
              <PhotoPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
