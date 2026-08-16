// Resolves WebA media hashes (`photo<id>`, `document<id>`, `avatar<peerId>`,
// see global/helpers/messageMedia.ts and global/helpers/chats.ts) to the
// backend's hosted media URLs. Unhosted media resolves to undefined, leaving
// the placeholder UI (unhostedMedia.ts) in charge.

import { getShareContext } from './shareContext';

const SHARE_MEDIA_HASH_PATTERN = /^(?:photo|document)(\d+)(?:\?.*)?$/;
const SHARE_AVATAR_HASH_PATTERN = /^avatar(-?\d+)(?:\?.*)?$/;
const THUMB_SIZE_PATTERN = /(^|&)size=[ma](&|$)/;

export function resolveShareMediaUrl(hash: string): string | undefined {
  const context = getShareContext();
  if (!context) return undefined;

  const avatarMatch = SHARE_AVATAR_HASH_PATTERN.exec(hash);
  if (avatarMatch) return context.avatars[avatarMatch[1]];

  const mediaMatch = SHARE_MEDIA_HASH_PATTERN.exec(hash);
  if (!mediaMatch) return undefined;

  const entry = context.media[mediaMatch[1]];
  if (!entry?.hosted || !entry.url) return undefined;

  const query = hash.split('?')[1] || '';
  return THUMB_SIZE_PATTERN.test(query) && entry.thumbUrl ? entry.thumbUrl : entry.url;
}
