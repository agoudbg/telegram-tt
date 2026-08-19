import type { ApiKeyboardButton } from '../../api/types';

import { getShareContext } from './shareContext';

const SHARE_VIEW_ALLOWED_ACTIONS = new Set([
  'cancelMediaDownload',
  'closeAudioPlayer',
  'closeMediaViewer',
  'downloadMedia',
  'openAudioPlayer',
  'openMediaViewer',
  'openUrl',
  'setMediaViewerHidden',
  'setMediaViewerMuted',
  'setMediaViewerPlaybackRate',
  'setMediaViewerVolume',
  'updateLastPlaybackTimestamp',
]);

export function isShareViewActive(): boolean {
  return Boolean(getShareContext());
}

export function isShareViewActionAllowed(actionName: string): boolean {
  return !isShareViewActive() || SHARE_VIEW_ALLOWED_ACTIONS.has(actionName);
}

export function isShareViewInlineButtonAllowed(button: ApiKeyboardButton): boolean {
  if (button.type !== 'url') {
    return false;
  }

  const context = getShareContext();
  if (!context) {
    return true;
  }

  try {
    const url = new URL(button.url);
    const startParam = url.searchParams.get('start');
    const isTelegramBotLink = url.protocol === 'https:' && (url.hostname === 't.me' || url.hostname === 'www.t.me');

    return Boolean(isTelegramBotLink && startParam?.startsWith(`get_${context.shareId}_`));
  } catch {
    return false;
  }
}
