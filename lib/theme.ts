export type ThemePref = "dark" | "light" | "auto";
const KEY = "hisab-theme";

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "dark";
  const t = localStorage.getItem(KEY);
  return t === "light" || t === "auto" ? t : "dark";
}

export function applyTheme(pref: ThemePref = getThemePref()) {
  const dark = pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setThemePref(pref: ThemePref) {
  localStorage.setItem(KEY, pref);
  applyTheme(pref);
}
