// Share route parsing: the backend serves browser shares at `/s/<shareId>`;
// Telegram direct links open the Mini App root and pass the id separately.

import { getMiniAppShareId } from './miniApp';

const SHARE_PATH_PATTERN = /^\/s\/([\w-]+)\/?$/;

export function parseShareId(pathname: string = window.location.pathname): string | undefined {
  const match = SHARE_PATH_PATTERN.exec(pathname);
  return match ? match[1] : getMiniAppShareId();
}
