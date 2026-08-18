// TL JSON → GramJs class instance hydrator. Vendored from the shared
// `packages/tlbridge` package (hydrate.ts / base64.ts / types.ts) so the fork
// stays self-contained; keep the two copies in sync.
//
// `buildApiMessage` discriminates entirely via `instanceof`, so prototypes are
// restored by looking up the constructor table with `className`. Constructors
// are NOT called (their argument shapes vary); `Object.create(prototype)` +
// field assignment is enough because the render path never invokes TL binary
// methods. Unknown constructors degrade to plain passthrough objects.

import type { TLJsonBytes, TLJsonLong, TLJsonValue } from './types';

export interface TLConstructorLike {
  // Only the prototype is needed; any class constructor qualifies
  prototype: object;
}

export type TLRegistry = Record<string, TLConstructorLike | undefined>;

export function hydrateTL(json: TLJsonValue, registry: TLRegistry = {}): unknown {
  if (!json || typeof json !== 'object') return json;
  if (Array.isArray(json)) return json.map((item) => hydrateTL(item, registry));
  if (isTLJsonLong(json)) return BigInt(json.$long);
  if (isTLJsonBytes(json)) return base64ToBytes(json.$bytes);

  const { className, ...fields } = json;
  const hydrated: Record<string, unknown> = {};
  Object.entries(fields).forEach(([key, value]) => {
    // Teleproto represents absent optional TL fields as null. GramJs builders
    // distinguish absent values with undefined, so restoring null would make
    // fields such as groupedId look present and trigger invalid render paths.
    if (value === undefined || (!value && typeof value === 'object')) return;
    hydrated[key] = hydrateTL(value, registry);
  });

  const ctor = typeof className === 'string' ? registry[className] : undefined;
  if (ctor) {
    const obj = Object.assign(Object.create(ctor.prototype), hydrated);
    // If `className` is already provided by a prototype getter (as in some
    // GramJs classes), it works as-is and must not be assigned
    if (typeof className === 'string' && !('className' in obj)) {
      (obj as Record<string, unknown>).className = className;
    }
    return obj;
  }
  return className === undefined ? hydrated : { className, ...hydrated };
}

function isTLJsonLong(value: TLJsonValue): value is TLJsonLong {
  return typeof value === 'object' && Boolean(value) && '$long' in value;
}

function isTLJsonBytes(value: TLJsonValue): value is TLJsonBytes {
  return typeof value === 'object' && Boolean(value) && '$bytes' in value;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
