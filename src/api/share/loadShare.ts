// Loads a share end to end on the main thread: fetch the sanitized payload,
// build Api* objects through the official builders and inject them straight
// into global state. This replaces the worker-side `fetchMessages` flow for
// share pages — hydrated GramJs instances must not cross the worker boundary.

import { getGlobal, setGlobal } from '../../global';

import type { ShareLoadStatus } from './types';
import { MAIN_THREAD_ID } from '../types/messages';

import { updateChats } from '../../global/reducers/chats';
import {
  addChatMessagesById, safeReplaceViewportIds, updateListedIds,
} from '../../global/reducers/messages';
import { updateTabState } from '../../global/reducers/tabs';
import { updateUsers } from '../../global/reducers/users';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../util/iteratees';
import { buildShare } from './buildShare';
import { fetchShare } from './fetchShare';
import { setShareContext } from './shareContext';

export async function loadShare(shareId: string): Promise<ShareLoadStatus> {
  const result = await fetchShare(shareId);
  if (result.status !== 'ok') return result.status;

  const built = buildShare(result.data);
  if (!built) return 'error';

  setShareContext({ shareId, media: result.data.media, avatars: built.avatars });

  const tabId = getCurrentTabId();
  let global = getGlobal();
  global = updateUsers(global, buildCollectionByKey([built.user, ...built.users], 'id'));
  global = updateChats(global, buildCollectionByKey([built.chat, ...built.chats], 'id'));
  global = addChatMessagesById(global, built.chatId, buildCollectionByKey(built.messages, 'id'));
  const messageIds = built.messages.map((message) => message.id);
  global = updateListedIds(global, built.chatId, MAIN_THREAD_ID, messageIds);
  global = safeReplaceViewportIds(global, built.chatId, MAIN_THREAD_ID, messageIds, tabId);
  global = updateTabState(global, {
    messageLists: [{ chatId: built.chatId, threadId: MAIN_THREAD_ID, type: 'thread' }],
  }, tabId);
  setGlobal(global);

  return 'ready';
}
