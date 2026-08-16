// Holds the currently displayed share so sibling modules (media URL wiring,
// unhosted-media placeholders) can resolve share-scoped URLs without
// re-fetching.

import type { ShareMediaEntry } from './types';

export interface ShareContext {
  shareId: string;
  media: Record<string, ShareMediaEntry>;
}

let currentContext: ShareContext | undefined;

export function setShareContext(context: ShareContext) {
  currentContext = context;
}

export function getShareContext(): ShareContext | undefined {
  return currentContext;
}
