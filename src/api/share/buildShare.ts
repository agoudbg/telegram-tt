// Transforms the sanitized share payload into Api* objects ready for the
// official render pipeline: TL JSON messages are hydrated back into GramJs
// instances and passed through the official `buildApiMessage`; origin peers
// become minimal ApiUser/ApiChat entries (avatars fall back to letters until
// media wiring fills them in).

import type { Api as GramJs } from '../../lib/gramjs';
import type { ApiChat, ApiMessage, ApiUser } from '../types';
import type { ShareResponse } from './types';

import { CHANNEL_ID_BASE } from '../../config';
import { buildApiMessage, setMessageBuilderCurrentUserId } from '../gramjs/apiBuilders/messages';
import { hydrateTL } from './hydrate';
import { getTLRegistry } from './tlRegistry';

// Never a valid peer id, so every share message renders as incoming
const SHARE_VIEWER_USER_ID = '0';
const VIRTUAL_CHAT_TITLE = 'Shared Messages';

export interface BuiltShare {
  chatId: string;
  chat: ApiChat;
  user: ApiUser;
  users: ApiUser[];
  chats: ApiChat[];
  messages: ApiMessage[];
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

  // The sanitizer replaced every message's `peerId` with the virtual-chat
  // peer, so all messages resolve to the same chat id
  const chatId = messages[0].chatId;

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
      });
      return;
    }
    chats.push({
      // Server peer ids are bare; WebA encodes channels as `-(id + 10^12)`
      // and basic groups as `-id` (see `buildApiPeerId`)
      id: peer.kind === 'channel'
        ? (-(BigInt(peer.id) + CHANNEL_ID_BASE)).toString()
        : (-BigInt(peer.id)).toString(),
      type: peer.kind === 'channel' ? 'chatTypeChannel' : 'chatTypeBasicGroup',
      title: peer.displayName || '',
      usernames: peer.username
        ? [{ username: peer.username, isActive: true, isEditable: false }]
        : undefined,
    });
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
    chatId, chat, user, users, chats, messages,
  };
}
