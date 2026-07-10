import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "./zh-CN.json";
import en from "./en.json";

export function initI18n(locale?: string | null) {
  const lng = locale?.startsWith("en") ? "en" : "zh-CN";
  if (i18n.isInitialized) {
    void i18n.changeLanguage(lng);
    return i18n;
  }
  void i18n.use(initReactI18next).init({
    resources: {
      "zh-CN": { translation: zhCN },
      en: { translation: en },
    },
    lng,
    fallbackLng: "zh-CN",
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export default i18n;
