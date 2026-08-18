// Holds the currently displayed share so sibling modules (media URL wiring,
// unhosted-media placeholders) can resolve share-scoped URLs without
// re-fetching.
//
// `avatars` maps the WebA-encoded peer id (channels `-100…`, groups `-…`,
// users bare) to the avatar URL, matching the ids on the injected ApiUser /
// ApiChat objects and therefore the `avatar<peerId>` media hashes.

import type { ShareMediaEntry } from './types';

import { restoreMessageBuilderCurrentUserId } from '../gramjs/apiBuilders/messages';

export interface ShareContext {
  shareId: string;
  media: Record<string, ShareMediaEntry>;
  avatars: Record<string, string>;
  nestedForwardMessageIds: Set<number>;
  messageBuilderCurrentUserId: string | undefined;
}

let currentContext: ShareContext | undefined;

export function setShareContext(context: ShareContext) {
  currentContext = context;
}

export function clearShareContext() {
  const context = currentContext;
  currentContext = undefined;
  if (context) restoreMessageBuilderCurrentUserId(context.messageBuilderCurrentUserId);
}

export function getShareContext(): ShareContext | undefined {
  return currentContext;
}
