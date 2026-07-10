import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfigStore } from "@/store/config";
import { usePlayerStore } from "@/store/player";
import MusicBar from "./MusicBar";

const NAV = [
  { to: "/", labelKey: "nav.home", end: true },
  { to: "/browse", labelKey: "nav.browse" },
  { to: "/favorites", labelKey: "nav.favorites" },
  { to: "/settings", labelKey: "nav.settings" },
];

export default function AppShell() {
  const { t } = useTranslation();
  const appName = useConfigStore((s) => s.appName);
  const mediaId = usePlayerStore((s) => s.mediaId);
  const fileType = usePlayerStore((s) => s.fileType);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">{appName}</div>
        <nav className="app-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <Outlet />
        {mediaId && fileType === "audio" ? <MusicBar /> : null}
      </div>
    </div>
  );
}

export function PageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <header className="app-topbar">
        <div className="app-topbar-title">{title}</div>
      </header>
      <main className="app-content">{children}</main>
    </>
  );
}
