// Loads a share end to end on the main thread: fetch the sanitized payload,
// build Api* objects through the official builders and inject them straight
// into global state. This replaces the worker-side `fetchMessages` flow for
// share pages — hydrated GramJs instances must not cross the worker boundary.

import { getGlobal, setGlobal } from '../../global';

import type { ShareLoadStatus } from './types';
import { MAIN_THREAD_ID } from '../types/messages';

import { updateChats } from '../../global/reducers/chats';
import {
  addChatMessagesById, safeReplaceViewportIds, updateListedIds, updatePoll,
} from '../../global/reducers/messages';
import { updateTabState } from '../../global/reducers/tabs';
import { updateUsers } from '../../global/reducers/users';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../util/iteratees';
import { ensureFallbackLangPack } from '../../util/localization';
import { ensureShareLegacyLangPack } from '../../util/oldLangProvider';
import {
  getMessageBuilderCurrentUserId,
  restoreMessageBuilderCurrentUserId,
} from '../gramjs/apiBuilders/messages';
import { buildShare } from './buildShare';
import { fetchShare } from './fetchShare';
import { clearShareContext, getShareContext, setShareContext } from './shareContext';

export async function loadShare(shareId: string, signal?: AbortSignal): Promise<ShareLoadStatus> {
  const shareContext = getShareContext();
  const previousMessageBuilderCurrentUserId = shareContext
    ? shareContext.messageBuilderCurrentUserId
    : getMessageBuilderCurrentUserId();
  clearShareContext();

  // Placeholder texts and button labels are baked into the built messages,
  // so the fallback language pack must be loaded first
  await Promise.all([ensureFallbackLangPack(), ensureShareLegacyLangPack()]);
  const result = await fetchShare(shareId, signal);
  if (result.status !== 'ok') return result.status;
  if (signal?.aborted) return 'error';

  const built = buildShare(result.data);
  if (!built) {
    restoreMessageBuilderCurrentUserId(previousMessageBuilderCurrentUserId);
    return 'error';
  }

  setShareContext({
    shareId,
    media: result.data.media,
    avatars: built.avatars,
    nestedForwardMessageIds: built.nestedForwardMessageIds,
    messageBuilderCurrentUserId: previousMessageBuilderCurrentUserId,
  });

  const tabId = getCurrentTabId();
  let global = getGlobal();
  global = updateUsers(global, buildCollectionByKey([built.user, ...built.users], 'id'));
  global = updateChats(global, buildCollectionByKey([built.chat, ...built.chats], 'id'));
  global = addChatMessagesById(global, built.chatId, buildCollectionByKey(built.messages, 'id'));
  built.polls.forEach((poll) => {
    if (poll.summary?.id) {
      global = updatePoll(global, poll.summary.id, { summary: poll.summary, results: poll.results });
    }
  });
  const messageIds = built.messages.map((message) => message.id);
  global = updateListedIds(global, built.chatId, MAIN_THREAD_ID, messageIds);
  global = safeReplaceViewportIds(global, built.chatId, MAIN_THREAD_ID, messageIds, tabId);
  global = updateTabState(global, {
    messageLists: [{ chatId: built.chatId, threadId: MAIN_THREAD_ID, type: 'thread' }],
  }, tabId);
  setGlobal(global);

  return 'ready';
}
