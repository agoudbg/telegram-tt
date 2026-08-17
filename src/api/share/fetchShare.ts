// Fetches the sanitized share payload from the backend share API.

import type { ShareResponse } from './types';

export type ShareFetchResult = {
  status: 'ok';
  data: ShareResponse;
} | {
  status: 'not_found' | 'revoked' | 'error';
};

export async function fetchShare(shareId: string, signal?: AbortSignal): Promise<ShareFetchResult> {
  try {
    const response = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, { signal });
    if (response.status === 404) return { status: 'not_found' };
    if (response.status === 410) return { status: 'revoked' };
    if (!response.ok) return { status: 'error' };
    const data = await response.json() as ShareResponse;
    return { status: 'ok', data };
  } catch {
    return { status: 'error' };
  }
}
