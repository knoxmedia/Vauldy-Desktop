import { useEffect, useMemo, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import type { Locale } from "antd/lib/locale";
import enUS from "antd/locale/en_US";
import jaJP from "antd/locale/ja_JP";
import koKR from "antd/locale/ko_KR";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import { setUnauthorizedHandler } from "@/api/client";
import AppShell from "@/components/AppShell";
import { I18nProvider, useI18n } from "@/i18n";
import BrowsePage from "@/pages/BrowsePage";
import FavoritesPage from "@/pages/FavoritesPage";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import MediaDetailPage from "@/pages/MediaDetailPage";
import PlaybackHistoryPage from "@/pages/PlaybackHistoryPage";
import PhotoPage from "@/pages/PhotoPage";
import PlayerPage from "@/pages/PlayerPage";
import PlaylistsPage from "@/pages/PlaylistsPage";
import ReaderPage from "@/pages/ReaderPage";
import SearchPage from "@/pages/SearchPage";
import SettingsPage from "@/pages/SettingsPage";
import SetupPage from "@/pages/SetupPage";
import SeriesDetailPage from "@/pages/SeriesDetailPage";
import AlbumDetailPage from "@/pages/AlbumDetailPage";
import ArtistDetailPage from "@/pages/ArtistDetailPage";
import GenreDetailPage from "@/pages/GenreDetailPage";
import { useBrandingStore } from "@/store/branding";
import { useAuthStore } from "@/store/auth";
import { useConfigStore } from "@/store/config";

const ANTD_LOCALES: Record<string, Locale> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  en: enUS,
  ja: jaJP,
  ko: koKR,
};

function AppAntdProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const antdLocale = useMemo(() => ANTD_LOCALES[locale] ?? zhCN, [locale]);
  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: "#00a4dc", borderRadius: 8 },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const serverUrl = useConfigStore((s) => s.serverUrl);
  const location = useLocation();

  if (!serverUrl) return <Navigate to="/setup" replace />;
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function LegacyMediaToBrowse() {
  const { search } = useLocation();
  return <Navigate to={`/browse${search}`} replace />;
}

function LegacyLibraryRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/browse" replace />;
  return <Navigate to={`/browse?library_id=${id}`} replace />;
}

function LegacyMediaDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;
  return <Navigate to={`/detail/${id}`} replace />;
}

function BrandingBootstrap() {
  useEffect(() => {
    void useBrandingStore.getState().load();
  }, []);
  return null;
}

function AuthEffects() {
  const navigate = useNavigate();

  useEffect(() => {
    setUnauthorizedHandler(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <AppAntdProvider>
        <BrowserRouter>
          <BrandingBootstrap />
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
              <Route path="favorites" element={<FavoritesPage />} />
              <Route path="browse" element={<BrowsePage />} />
              <Route path="series/:id" element={<SeriesDetailPage />} />
              <Route path="album/:id" element={<AlbumDetailPage />} />
              <Route path="artist/:id" element={<ArtistDetailPage />} />
              <Route path="genre" element={<GenreDetailPage />} />
              <Route path="playback-history" element={<PlaybackHistoryPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="detail/:id" element={<MediaDetailPage />} />
              <Route path="playlists" element={<PlaylistsPage />} />
              <Route path="media" element={<LegacyMediaToBrowse />} />
              <Route path="library/:id" element={<LegacyLibraryRedirect />} />
              <Route path="media/:id" element={<LegacyMediaDetailRedirect />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            <Route
              path="/player/:id?"
              element={
                <RequireAuth>
                  <PlayerPage />
                </RequireAuth>
              }
            />
            <Route
              path="/reader/:id"
              element={
                <RequireAuth>
                  <ReaderPage />
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
      </AppAntdProvider>
    </I18nProvider>
  );
}
