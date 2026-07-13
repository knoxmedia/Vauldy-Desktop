import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Space,
  Tooltip,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  CloseOutlined,
  MenuOutlined,
  PlayCircleOutlined,
  PushpinOutlined,
  SlidersOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { fetchUserInfo, logout } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { useAppName } from "@/store/branding";
import { resolveLocale, useI18n, useT } from "@/i18n";
import MainNav from "@web/components/MainNav";
import MusicPlayerBar from "@web/components/MusicPlayerBar";
import ScrollToTopFab from "@web/components/ScrollToTopFab";
import SearchHeaderControls from "@web/components/SearchHeaderControls";
import { useMusicPlayerStore } from "@web/store/musicPlayer";

const { Header, Content, Sider } = Layout;

const SIDEBAR_MODE_KEY = "knox-media-sidebar-mode";

type SidebarMode = "expanded" | "collapsed" | "hidden";

function readSidebarMode(): SidebarMode {
  try {
    const v = localStorage.getItem(SIDEBAR_MODE_KEY);
    if (v === "expanded" || v === "collapsed" || v === "hidden") return v;
  } catch {
    /* ignore */
  }
  return "expanded";
}

function ProfileSync() {
  const token = useAuthStore((s) => s.token);
  const setProfile = useAuthStore((s) => s.setProfile);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    if (!token) return;
    void fetchUserInfo()
      .then((u) =>
        setProfile(u.username, u.role, {
          canPlay: u.can_play !== false,
          avatarUrl: u.avatar_url || null,
          uiLocale: u.ui_locale ? resolveLocale(u.ui_locale) : null,
        }),
      )
      .catch(() => clearSession());
  }, [token, setProfile, clearSession]);

  return null;
}

export default function AppShell() {
  const loc = useLocation();
  const nav = useNavigate();
  const t = useT();
  const { locale } = useI18n();
  const appName = useAppName();
  const role = useAuthStore((s) => s.role);
  const username = useAuthStore((s) => s.username);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const clearSession = useAuthStore((s) => s.clearSession);
  const isPlayerRoute = loc.pathname.startsWith("/player");
  const isReaderRoute = loc.pathname.startsWith("/reader");
  const isImmersiveRoute = isPlayerRoute || isReaderRoute;
  const isHomeRoute = loc.pathname === "/" || loc.pathname === "";
  const isSearchRoute = loc.pathname.startsWith("/search");
  const musicPlayerActive = useMusicPlayerStore((s: { active: boolean }) => s.active);
  const contentRef = useRef<HTMLElement>(null);

  const [mode, setModeState] = useState<SidebarMode>(() => readSidebarMode());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoCollapseOnLeave, setAutoCollapseOnLeave] = useState(false);

  const setMode = (m: SidebarMode) => {
    setModeState(m);
    if (m === "hidden") setAutoCollapseOnLeave(false);
    try {
      localStorage.setItem(SIDEBAR_MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const siderCollapsed = mode === "collapsed";

  const userMenuItems: MenuProps["items"] = [
    {
      key: "who",
      label: (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {username || t("user_menu.default_user")}
          {role ? ` · ${role === "admin" ? t("user_menu.role_admin") : t("user_menu.role_user")}` : ""}
        </Typography.Text>
      ),
      disabled: true,
    },
    { type: "divider" },
    {
      key: "settings",
      icon: <SlidersOutlined />,
      label: t("user_menu.account_settings"),
      onClick: () => nav("/settings"),
    },
    { type: "divider" },
    {
      key: "logout",
      danger: true,
      label: t("user_menu.logout"),
      onClick: async () => {
        try {
          await logout();
        } catch {
          /* ignore */
        } finally {
          clearSession();
          nav("/login", { replace: true });
        }
      },
    },
  ];

  const pathTitle = (() => {
    const p = loc.pathname;
    if (p === "/" || p === "") return "";
    if (p.startsWith("/favorites")) return t("shell.title.favorites");
    if (p.startsWith("/playlists")) return t("shell.title.playlists");
    if (p.startsWith("/search")) return t("shell.title.search");
    if (p.startsWith("/browse")) return t("shell.title.browse");
    if (p.startsWith("/series")) return t("shell.title.series");
    if (p.startsWith("/album")) return t("shell.title.album");
    if (p.startsWith("/artist")) return t("shell.title.artist");
    if (p.startsWith("/genre")) return t("shell.title.genre");
    if (p.startsWith("/playback-history")) return t("shell.title.playback_history");
    if (p.startsWith("/player")) return t("shell.title.player");
    if (p.startsWith("/reader")) return t("shell.title.reader");
    if (p.startsWith("/settings")) return t("shell.title.settings");
    if (p.startsWith("/library")) return t("shell.title.library");
    if (p.startsWith("/detail")) return t("shell.title.browse");
    return "";
  })();

  return (
    <Layout
      className={`app-shell${isImmersiveRoute ? " app-shell--player" : ""}`}
      style={{ background: isImmersiveRoute ? "transparent" : "#000" }}
    >
      <ProfileSync />
      {!isImmersiveRoute && mode !== "hidden" ? (
        <Sider
          className="app-shell-sider"
          width={260}
          collapsedWidth={64}
          collapsed={siderCollapsed}
          collapsible
          onCollapse={(c) => {
            if (c) {
              setMode("collapsed");
              return;
            }
            setAutoCollapseOnLeave(true);
            setMode("expanded");
          }}
          theme="dark"
          trigger={null}
          onMouseLeave={() => {
            if (autoCollapseOnLeave && mode === "expanded") setMode("collapsed");
          }}
        >
          <div className={`app-sider-brand${autoCollapseOnLeave ? " app-sider-brand-pending-pin" : ""}`}>
            {siderCollapsed ? (
              <Button
                type="text"
                size="small"
                className="app-sider-collapsed-open-btn"
                icon={<MenuOutlined style={{ color: "#aaa" }} />}
                onClick={() => {
                  setAutoCollapseOnLeave(true);
                  setMode("expanded");
                }}
                aria-label={t("shell.expand_sider")}
              />
            ) : (
              <>
                <Button
                  type="text"
                  size="small"
                  className="app-sider-mode-btn"
                  icon={<MenuOutlined style={{ color: "#aaa" }} />}
                  onClick={() => {
                    setAutoCollapseOnLeave(false);
                    setMode("collapsed");
                  }}
                  aria-label={t("shell.icon_only")}
                />
                <Link to="/" className="app-sider-logo" title={t("shell.open_brand")}>
                  <span>{appName}</span>
                </Link>
                {autoCollapseOnLeave ? (
                  <Tooltip title={t("shell.pin_sider")}>
                    <Button
                      type="text"
                      size="small"
                      className="app-sider-pin-btn"
                      icon={<PushpinOutlined style={{ color: "#aaa" }} />}
                      onClick={() => {
                        setAutoCollapseOnLeave(false);
                        setMode("expanded");
                      }}
                      aria-label={t("shell.pin_sider")}
                    />
                  </Tooltip>
                ) : null}
                <Tooltip title={t("shell.hide_sider")}>
                  <Button
                    type="text"
                    size="small"
                    className="app-sider-close-btn"
                    icon={<CloseOutlined style={{ color: "#aaa" }} />}
                    onClick={() => setMode("hidden")}
                    aria-label={t("shell.hide_sider")}
                  />
                </Tooltip>
              </>
            )}
          </div>
          <MainNav key={locale} inlineCollapsed={siderCollapsed} hideAdmin />
        </Sider>
      ) : null}

      <Layout className="app-shell-inner">
        {!isImmersiveRoute ? (
          <Header
            className="app-top-header app-shell-header"
            style={{
              padding: 0,
              background: "#0a0a0a",
              borderBottom: "1px solid #1f1f1f",
              height: 64,
              lineHeight: "normal",
            }}
          >
            <div
              className={`app-header-bar app-shell-header-bar${mode === "hidden" ? " app-shell-header-bar-hidden" : ""}`}
            >
              <div
                className={`app-header-left app-shell-header-left${mode === "hidden" ? " app-shell-header-left-hidden" : ""}`}
              >
                {mode === "hidden" ? (
                  <span className="app-header-hidden-brand">
                    <Button
                      type="text"
                      className="app-hidden-nav-open-btn"
                      aria-label={t("shell.open_nav_aria")}
                      icon={<MenuOutlined style={{ fontSize: 22, color: "#fff" }} />}
                      onClick={() => setDrawerOpen(true)}
                    />
                    {isHomeRoute ? (
                      <Link to="/" className="app-header-hidden-logo">
                        <span>{appName}</span>
                      </Link>
                    ) : isSearchRoute && pathTitle ? (
                      <div className="app-shell-header-search-row app-shell-header-search-row-compact">
                        <Typography.Text className="app-shell-header-title" ellipsis>
                          {pathTitle}
                        </Typography.Text>
                        <SearchHeaderControls />
                      </div>
                    ) : pathTitle ? (
                      <Typography.Text className="app-shell-header-title" ellipsis>
                        {pathTitle}
                      </Typography.Text>
                    ) : null}
                  </span>
                ) : null}
                {isSearchRoute && pathTitle && mode !== "hidden" ? (
                  <div className="app-shell-header-search-row">
                    <Typography.Text className="app-shell-header-title" ellipsis>
                      {pathTitle}
                    </Typography.Text>
                    <SearchHeaderControls />
                  </div>
                ) : pathTitle && mode !== "hidden" && !isSearchRoute ? (
                  <Typography.Text className="app-shell-header-title" ellipsis>
                    {pathTitle}
                  </Typography.Text>
                ) : null}
              </div>
              <div className="app-header-right app-shell-header-right">
                <Space size="middle">
                  <Dropdown
                    menu={{ items: userMenuItems, className: "app-user-dropdown-menu" }}
                    placement="bottomRight"
                    trigger={["click"]}
                  >
                    <span className="app-shell-avatar-wrap" role="button" tabIndex={0}>
                      <Avatar
                        size="default"
                        src={avatarUrl || undefined}
                        style={{ backgroundColor: "#00a4dc", cursor: "pointer" }}
                      >
                        {avatarUrl ? null : (username || "?").slice(0, 1).toUpperCase()}
                      </Avatar>
                    </span>
                  </Dropdown>
                </Space>
              </div>
            </div>
          </Header>
        ) : null}

        {!isImmersiveRoute ? (
          <Drawer
            title={
              <span style={{ color: "#fff", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <PlayCircleOutlined style={{ color: "#00a4dc" }} />
                {appName}
              </span>
            }
            extra={
              <Tooltip title={t("shell.pin_sider")}>
                <Button
                  type="text"
                  icon={<PushpinOutlined style={{ color: "#ddd" }} />}
                  aria-label={t("shell.pin_sider")}
                  onClick={() => {
                    setAutoCollapseOnLeave(false);
                    setMode("expanded");
                    setDrawerOpen(false);
                  }}
                />
              </Tooltip>
            }
            placement="left"
            width={280}
            onClose={() => setDrawerOpen(false)}
            open={drawerOpen}
            styles={{
              body: { padding: 0, background: "#141414" },
              header: { background: "#141414", borderBottom: "1px solid #222" },
            }}
            style={{ background: "#141414" }}
          >
            <div className="app-drawer-nav">
              <MainNav key={locale} onNavigate={() => setDrawerOpen(false)} inlineCollapsed={false} hideAdmin />
            </div>
          </Drawer>
        ) : null}

        <Content
          ref={contentRef}
          className={`app-shell-content${isImmersiveRoute ? " app-shell-content-player" : ""}${musicPlayerActive && !isImmersiveRoute ? " app-shell-content-music-player" : ""}`}
          style={{
            background: isImmersiveRoute ? "transparent" : "#000",
            ...(isImmersiveRoute ? { minHeight: "100vh", overflow: "hidden" } : {}),
          }}
        >
          <div key={locale} className={`app-main-centered${isImmersiveRoute ? " app-main-centered-player" : ""}`}>
            <Outlet />
          </div>
        </Content>
        {!isImmersiveRoute ? <MusicPlayerBar /> : null}
        {!isImmersiveRoute ? (
          <ScrollToTopFab scrollRootRef={contentRef} bottomOffset={musicPlayerActive ? 96 : 24} />
        ) : null}
      </Layout>
    </Layout>
  );
}
