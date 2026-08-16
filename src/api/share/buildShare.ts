// Transforms the sanitized share payload into Api* objects ready for the
// official render pipeline: TL JSON messages are hydrated back into GramJs
// instances and passed through the official `buildApiMessage`; origin peers
// become minimal ApiUser/ApiChat entries; hosted media is wired to the
// backend URLs via `blobUrl`/thumbnails (the rest goes through the
// mediaLoader short-circuit, see shareMediaUrl.ts).

import type { Api as GramJs } from '../../lib/gramjs';
import type {
  ApiChat, ApiMessage, ApiThumbnail, ApiUser,
} from '../types';
import type { ShareMediaEntry, ShareResponse } from './types';

import { CHANNEL_ID_BASE } from '../../config';
import { buildApiMessage, setMessageBuilderCurrentUserId } from '../gramjs/apiBuilders/messages';
import { hydrateTL } from './hydrate';
import { getTLRegistry } from './tlRegistry';

// Never a valid peer id, so every share message renders as incoming
const SHARE_VIEWER_USER_ID = '0';
const VIRTUAL_CHAT_TITLE = 'Shared Messages';
// Non-empty marker enabling the `avatar<peerId>` hash (the value itself is
// not used; the resolver maps the peer id to the hosted avatar URL)
const SHARE_AVATAR_PHOTO_ID = 'share';

export interface BuiltShare {
  chatId: string;
  chat: ApiChat;
  user: ApiUser;
  users: ApiUser[];
  chats: ApiChat[];
  messages: ApiMessage[];
  avatars: Record<string, string>;
}

export function buildShare(data: ShareResponse): BuiltShare | undefined {
  setMessageBuilderCurrentUserId(SHARE_VIEWER_USER_ID);
  const registry = getTLRegistry();

  const messages: ApiMessage[] = [];
  data.messages.forEach((entry) => {
    const tlMessage = hydrateTL(entry.message, registry);
    const apiMessage = buildApiMessage(tlMessage as GramJs.TypeMessage);
    if (apiMessage) messages.push(apiMessage);
  });
  if (!messages.length) return undefined;

  messages.forEach((message) => wireShareMedia(message, data.media));

  // The sanitizer replaced every message's `peerId` with the virtual-chat
  // peer, so all messages resolve to the same chat id
  const chatId = messages[0].chatId;

  const avatars: Record<string, string> = {};
  const users: ApiUser[] = [];
  const chats: ApiChat[] = [];
  data.peers.forEach((peer) => {
    if (peer.kind === 'user') {
      users.push({
        id: peer.id,
        isMin: false,
        type: 'userTypeRegular',
        firstName: peer.displayName,
        usernames: peer.username
          ? [{ username: peer.username, isActive: true, isEditable: false }]
          : undefined,
        phoneNumber: '',
        avatarPhotoId: peer.avatarUrl ? SHARE_AVATAR_PHOTO_ID : undefined,
      });
      if (peer.avatarUrl) avatars[peer.id] = peer.avatarUrl;
      return;
    }
    // Server peer ids are bare; WebA encodes channels as `-(id + 10^12)`
    // and basic groups as `-id` (see `buildApiPeerId`)
    const id = peer.kind === 'channel'
      ? (-(BigInt(peer.id) + CHANNEL_ID_BASE)).toString()
      : (-BigInt(peer.id)).toString();
    chats.push({
      id,
      type: peer.kind === 'channel' ? 'chatTypeChannel' : 'chatTypeBasicGroup',
      title: peer.displayName || '',
      usernames: peer.username
        ? [{ username: peer.username, isActive: true, isEditable: false }]
        : undefined,
      avatarPhotoId: peer.avatarUrl ? SHARE_AVATAR_PHOTO_ID : undefined,
    });
    if (peer.avatarUrl) avatars[id] = peer.avatarUrl;
  });

  const chat: ApiChat = {
    id: chatId,
    type: 'chatTypePrivate',
    title: VIRTUAL_CHAT_TITLE,
  };
  const user: ApiUser = {
    id: chatId,
    isMin: false,
    type: 'userTypeRegular',
    firstName: VIRTUAL_CHAT_TITLE,
    phoneNumber: '',
  };

  return {
    chatId, chat, user, users, chats, messages, avatars,
  };
}

function wireShareMedia(message: ApiMessage, media: Record<string, ShareMediaEntry>) {
  const {
    photo, video, document, sticker,
  } = message.content;

  if (photo) {
    const entry = media[photo.id];
    if (entry?.hosted && entry.url) {
      photo.blobUrl = entry.url;
      if (!photo.thumbnail) photo.thumbnail = buildShareThumbnail(entry);
    }
  }

  if (video) {
    const entry = media[video.id];
    if (entry?.hosted && entry.url) {
      video.blobUrl = entry.url;
      if (!video.thumbnail) video.thumbnail = buildShareThumbnail(entry);
    }
  }

  if (document) {
    const entry = document.id ? media[document.id] : undefined;
    if (entry?.hosted && entry.thumbUrl) {
      if (!document.thumbnail) document.thumbnail = buildShareThumbnail(entry);
      if (!document.previewBlobUrl) document.previewBlobUrl = entry.thumbUrl;
    }
  }

  if (sticker) {
    const entry = media[sticker.id];
    if (entry?.hosted && entry.thumbUrl && !sticker.thumbnail) {
      sticker.thumbnail = buildShareThumbnail(entry);
    }
  }
}

function buildShareThumbnail(entry: ShareMediaEntry): ApiThumbnail | undefined {
  return entry.thumbUrl
    ? { dataUri: entry.thumbUrl, width: entry.width || 0, height: entry.height || 0 }
    : undefined;
}
