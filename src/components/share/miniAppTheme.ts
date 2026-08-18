// Applies the host app's themeParams when the share view runs inside a
// Telegram Mini App (docs/PLAN.md, Phase 4 read-only trimming). No-op in a
// plain browser. The color scheme goes through the regular settings flow so
// both the documentElement theme class and the wallpaper engine follow;
// palette colors are mapped onto the main CSS variables, unmapped params
// keep the built-in theme values.

import { getActions } from '../../global';

import type { WebAppThemeParams } from '../../api/share/miniApp';

import { getMiniApp } from '../../api/share/miniApp';

// switchTheme writes its end-state inline styles asynchronously
// (requestMutation) and animates for up to DURATION + ENABLE_DELAY ms, so
// the themeParams overrides are applied once more after that window
const THEME_SETTLE_MS = 800;

const THEME_PARAM_VARIABLES: Record<keyof WebAppThemeParams, string> = {
  bg_color: '--color-background',
  text_color: '--color-text',
  hint_color: '--color-text-secondary',
  link_color: '--color-links',
  button_color: '--color-primary',
  secondary_bg_color: '--color-background-secondary',
};

export function applyMiniAppTheme() {
  const webApp = getMiniApp();
  if (!webApp) return;

  if (webApp.colorScheme === 'dark' || webApp.colorScheme === 'light') {
    getActions().setSharedSettingOption({ theme: webApp.colorScheme });
  }

  const applyThemeParams = () => {
    const themeParams = webApp.themeParams || {};
    Object.entries(THEME_PARAM_VARIABLES).forEach(([param, variable]) => {
      const value = themeParams[param as keyof WebAppThemeParams];
      if (value) document.documentElement.style.setProperty(variable, value);
    });
  };
  applyThemeParams();
  setTimeout(applyThemeParams, THEME_SETTLE_MS);
}
