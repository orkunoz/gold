"use client";

import { useI18n } from "./i18n-provider";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const { t } = useI18n();
  function toggle() {
    const next: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("zlata-theme", next);
  }
  return <button type="button" onClick={toggle} className="icon-button" aria-label={t("theme.toggle")} title={t("theme.toggle")}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="theme-light-icon"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" /></svg>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="theme-dark-icon"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  </button>;
}
