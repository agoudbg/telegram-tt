// Server share API contract (`GET /api/shares/:id`, apps/server). The TL JSON
// in `messages[].message` is sanitized and hydrates back into GramJs class
// instances (see `hydrate.ts`).

export type TLJsonPrimitive = string | number | boolean | null;

export interface TLJsonLong {
  $long: string;
}

export interface TLJsonBytes {
  $bytes: string;
}

export type TLJsonValue = TLJsonPrimitive | TLJsonLong | TLJsonBytes | TLJsonObject | TLJsonValue[];

export interface TLJsonObject {
  className?: string;
  [key: string]: TLJsonValue | undefined;
}

export interface ShareResponse {
  share: {
    id: string;
    createdAt: number;
    finalizedAt: number | undefined;
  };
  messages: Array<{
    seq: number;
    nestedForward: boolean;
    message: TLJsonValue;
  }>;
  peers: Array<{
    /** Share-scoped fake id (bare, without WebA's `-100` channel encoding) */
    id: string;
    kind: 'user' | 'chat' | 'channel';
    displayName: string | undefined;
    username: string | undefined;
    avatarUrl: string | undefined;
  }>;
  media: Record<string, ShareMediaEntry>;
  /** Bot username (no @) for the unhosted-media deep link; undefined when the
   *  server is not configured with BOT_USERNAME */
  botUsername: string | undefined;
}

export interface ShareMediaEntry {
  mime: string | undefined;
  size: number | undefined;
  width: number | undefined;
  height: number | undefined;
  hosted: boolean;
  retrievable: boolean;
  url: string | undefined;
  thumbUrl: string | undefined;
}

export type ShareLoadStatus = 'ready' | 'not_found' | 'revoked' | 'error';
