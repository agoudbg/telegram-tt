interface WebAppThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  secondary_bg_color?: string;
}

interface TelegramWebApp {
  colorScheme?: 'light' | 'dark';
  themeParams?: WebAppThemeParams;
  initDataUnsafe?: {
    start_param?: string;
  };
  ready?: () => void;
  expand?: () => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SHARE_ID_PATTERN = /^[\w-]+$/;
const START_PARAM_QUERY = 'tgWebAppStartParam';

export function initializeMiniApp(): void {
  const webApp = getMiniApp();
  if (!webApp) return;

  webApp.ready?.();
  webApp.expand?.();
}

export function getMiniAppShareId(search: string = window.location.search): string | undefined {
  const queryStartParam = new URLSearchParams(search).get(START_PARAM_QUERY);
  const startParam = queryStartParam || getMiniApp()?.initDataUnsafe?.start_param;
  return startParam && SHARE_ID_PATTERN.test(startParam) ? startParam : undefined;
}

export function getMiniApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export type { WebAppThemeParams };
