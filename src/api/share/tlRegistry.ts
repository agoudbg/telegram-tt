// className → GramJs constructor registry for the hydrator, built from the
// fork's generated `Api` namespace. Namespaced constructors are registered
// under their dotted path (`messages.Messages`), matching the `className`
// values produced by the backend serializer.

import { Api } from '../../lib/gramjs/tl';

import type { TLRegistry } from './hydrate';

const MAX_NAMESPACE_DEPTH = 3;

let registry: TLRegistry | undefined;

export function getTLRegistry(): TLRegistry {
  if (!registry) {
    registry = {};
    collectNamespace(Api, registry, '', 0);
  }
  return registry;
}

function collectNamespace(ns: Record<string, unknown>, out: TLRegistry, prefix: string, depth: number) {
  if (depth > MAX_NAMESPACE_DEPTH) return;

  Object.entries(ns).forEach(([key, value]) => {
    if (typeof value === 'function' && value.prototype) {
      out[`${prefix}${key}`] = value;
      return;
    }
    if (typeof value === 'object' && Boolean(value)) {
      collectNamespace(value as Record<string, unknown>, out, `${prefix}${key}.`, depth + 1);
    }
  });
}
