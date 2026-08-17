// Transforms the sanitized share payload into Api* objects ready for the
// official render pipeline: TL JSON messages are hydrated back into GramJs
// instances and passed through the official `buildApiMessage`; origin peers
// become minimal ApiUser/ApiChat entries; hosted media is wired to the
// backend URLs via `blobUrl`/thumbnails (the rest goes through the
// mediaLoader short-circuit, see shareMediaUrl.ts). Media flagged
// `hosted: false` (oversized files, docs/PLAN.md §2.5) is stripped from the
// content and replaced with a placeholder text plus, when the bot can
// re-send it, an official inline URL button with the `get_<id>_<seq>`
// deep link.

import { Api as GramJs } from '../../lib/gramjs';

import type {
  ApiChat, ApiDimensions, ApiMessage, ApiMessagePoll, ApiThumbnail, ApiUser,
} from '../types';
import type { ShareMediaEntry, ShareResponse } from './types';

import { CHANNEL_ID_BASE } from '../../config';
import { getTranslationFn } from '../../util/localization';
import { formatFileSize } from '../../util/textFormat';
import { buildMessagePollFromMedia } from '../gramjs/apiBuilders/messageContent';
import { buildApiMessage, setMessageBuilderCurrentUserId } from '../gramjs/apiBuilders/messages';
import { hydrateTL } from './hydrate';
import { getTLRegistry } from './tlRegistry';

// Never a valid peer id, so every share message renders as incoming
const SHARE_VIEWER_USER_ID = '0';
const VIRTUAL_CHAT_TITLE = 'Shared Messages';
// Non-empty marker enabling the `avatar<peerId>` hash (the value itself is
// not used; the resolver maps the peer id to the hosted avatar URL)
const SHARE_AVATAR_PHOTO_ID = 'share';
// Content keys that can carry a hosted/unhosted media file
const MEDIA_CONTENT_KEYS = ['photo', 'video', 'document', 'sticker', 'audio', 'voice'] as const;

export interface BuiltShare {
  chatId: string;
  chat: ApiChat;
  user: ApiUser;
  users: ApiUser[];
  chats: ApiChat[];
  messages: ApiMessage[];
  /** Poll summaries referenced by the messages (the official builder only
   *  stores `content.pollId`; the renderer reads the rest from state) */
  polls: ApiMessagePoll[];
  avatars: Record<string, string>;
}

export function buildShare(data: ShareResponse): BuiltShare | undefined {
  setMessageBuilderCurrentUserId(SHARE_VIEWER_USER_ID);
  const registry = getTLRegistry();

  // Peers first: the nested-forward degradation below resolves origin names
  // through this map, keyed by the same WebA-encoded ids the ApiUser/ApiChat
  // objects get
  const avatars: Record<string, string> = {};
  const peerNames: Record<string, string> = {};
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
      if (peer.displayName) peerNames[peer.id] = peer.displayName;
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
    if (peer.displayName) peerNames[id] = peer.displayName;
    if (peer.avatarUrl) avatars[id] = peer.avatarUrl;
  });

  const messages: ApiMessage[] = [];
  const polls: ApiMessagePoll[] = [];
  data.messages.forEach((entry) => {
    const tlMessage = hydrateTL(entry.message, registry) as GramJs.TypeMessage;
    const apiMessage = buildApiMessage(tlMessage);
    if (apiMessage) {
      wireShareMedia(apiMessage, entry.seq, data);
      if (entry.nestedForward) degradeForwardOrigin(apiMessage, peerNames);
      messages.push(apiMessage);
      const poll = tlMessage instanceof GramJs.Message && tlMessage.media
        ? buildMessagePollFromMedia(tlMessage.media)
        : undefined;
      if (poll) polls.push(poll);
    }
  });
  if (!messages.length) return undefined;

  // The sanitizer replaced every message's `peerId` with the virtual-chat
  // peer, so all messages resolve to the same chat id
  const chatId = messages[0].chatId;

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
    chatId, chat, user, users, chats, messages, polls, avatars,
  };
}

// A nestedForward flag means the origin attribution is unreliable (the
// message is likely a forward of a forward, docs/PLAN.md §2.7): degrade the
// forward header to the official hidden-user form — origin name as plain,
// non-clickable text, no profile link or avatar
function degradeForwardOrigin(message: ApiMessage, peerNames: Record<string, string>) {
  const forwardInfo = message.forwardInfo;
  if (!forwardInfo) return;

  const originName = (forwardInfo.fromId && peerNames[forwardInfo.fromId])
    || (forwardInfo.fromChatId && peerNames[forwardInfo.fromChatId])
    || forwardInfo.hiddenUserName
    || getTranslationFn()('ShareUnknownOrigin');
  message.forwardInfo = {
    date: forwardInfo.date,
    isChannelPost: false,
    hiddenUserName: originName,
  };
}

function wireShareMedia(message: ApiMessage, seq: number, data: ShareResponse) {
  const { media } = data;
  const {
    photo, video, document, sticker,
  } = message.content;

  if (applyUnhostedPlaceholder(message, seq, data)) return;

  if (photo) {
    const entry = media[photo.id];
    if (entry?.hosted && entry.url) {
      photo.blobUrl = entry.url;
      if (!photo.thumbnail) {
        const photoSize = photo.sizes[photo.sizes.length - 1];
        photo.thumbnail = buildShareThumbnail(entry, photoSize);
      }
    }
  }

  if (video) {
    const entry = media[video.id];
    if (entry?.hosted && entry.url) {
      video.blobUrl = entry.url;
      if (!video.thumbnail) {
        const videoSize = video.width !== undefined && video.height !== undefined
          ? { width: video.width, height: video.height }
          : video.previewPhotoSizes?.[video.previewPhotoSizes.length - 1];
        video.thumbnail = buildShareThumbnail(entry, videoSize);
      }
    }
  }

  if (document) {
    const entry = document.id ? media[document.id] : undefined;
    if (entry?.hosted && entry.thumbUrl) {
      if (!document.thumbnail) document.thumbnail = buildShareThumbnail(entry, document.mediaSize);
      if (!document.previewBlobUrl) document.previewBlobUrl = entry.thumbUrl;
    }
  }

  if (sticker) {
    const entry = media[sticker.id];
    if (entry?.hosted && entry.thumbUrl && !sticker.thumbnail) {
      const stickerDimensions = sticker.width !== undefined && sticker.height !== undefined
        ? { width: sticker.width, height: sticker.height }
        : sticker.previewPhotoSizes?.[sticker.previewPhotoSizes.length - 1];
      sticker.thumbnail = buildShareThumbnail(entry, stickerDimensions);
    }
  }
}

// Oversized media is not hosted (docs/PLAN.md §2.5): strip it from the
// content so renderers show a plain bubble, append a placeholder note and,
// when the bot can re-send the file, attach an official inline URL button
// with the `get_<shareId>_<seq>` deep link. Returns true when applied.
function applyUnhostedPlaceholder(message: ApiMessage, seq: number, data: ShareResponse): boolean {
  const { content } = message;
  const mediaKey = MEDIA_CONTENT_KEYS.find((key) => {
    const media = content[key];
    const entry = media?.id ? data.media[media.id] : undefined;
    return entry && !entry.hosted;
  });
  if (!mediaKey) return false;

  const entry = data.media[content[mediaKey]!.id!];
  delete content[mediaKey];

  const lang = getTranslationFn();
  const note = entry.size
    ? `${lang('ShareMediaUnavailable')} (${formatFileSize(lang, entry.size)})`
    : lang('ShareMediaUnavailable');
  // Appending keeps the original caption entities valid (offsets unchanged)
  content.text = content.text?.text
    ? { ...content.text, text: `${content.text.text}\n\n${note}` }
    : { text: note };

  if (entry.retrievable && data.botUsername) {
    message.inlineButtons = [[{
      type: 'url',
      text: lang('ShareViewInTelegram'),
      url: `https://t.me/${data.botUsername}?start=get_${data.share.id}_${seq}`,
    }]];
  }
  return true;
}

function buildShareThumbnail(entry: ShareMediaEntry, dimensions?: ApiDimensions): ApiThumbnail | undefined {
  if (!entry.thumbUrl) return undefined;

  const width = entry.width ?? dimensions?.width;
  const height = entry.height ?? dimensions?.height;
  if (width === undefined || height === undefined) return undefined;

  return { dataUri: entry.thumbUrl, width, height };
}
