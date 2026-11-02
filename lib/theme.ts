export type ThemePref = "light" | "dark" | "system";
export const THEME_KEY = "theme";

export function getStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function setStoredTheme(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Storage can be blocked; the choice just won't be remembered
  }
}

export function applyTheme(pref: ThemePref): void {
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

// Runs in <head> before the first paint, so there's no flash of the wrong theme
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;