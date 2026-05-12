export type ThemePreference = 'system' | 'light' | 'dark';

export const SETTINGS_PREFS_KEY = 'secureops_settings_preferences';

export function resolveThemePreference(preference: ThemePreference) {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyThemePreference(preference: ThemePreference) {
  const resolvedTheme = resolveThemePreference(preference);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function readStoredThemePreference(): ThemePreference {
  const raw = localStorage.getItem(SETTINGS_PREFS_KEY);
  if (!raw) return 'system';

  try {
    const parsed = JSON.parse(raw) as { themePreference?: ThemePreference };
    return parsed.themePreference ?? 'system';
  } catch {
    return 'system';
  }
}
