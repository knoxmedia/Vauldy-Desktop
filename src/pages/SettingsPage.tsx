import WebSettings from "@web/pages/Settings";
import DesktopPlayerSettings from "@/components/DesktopPlayerSettings";

export default function SettingsPage() {
  return <WebSettings extraAfterLanguage={<DesktopPlayerSettings />} />;
}
