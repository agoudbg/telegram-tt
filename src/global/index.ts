import type { ActionOptions } from '../lib/teact/teactn';
import { typify } from '../lib/teact/teactn';

import type {
  ActionPayloads, GlobalState, RequiredActionPayloads, RequiredGlobalState,
} from './types';

import { isShareViewActionAllowed } from '../api/share/shareInteractionPolicy';

const typed = typify<GlobalState, ActionPayloads & RequiredActionPayloads>();

type ProjectActionTypes =
  ActionPayloads
  & RequiredActionPayloads;

type ProjectActionNames = keyof ProjectActionTypes;

type Helper<T, E> = Exclude<T, E> extends never ? unknown : Exclude<T, E>;

export type TabStateActionNames = {
  [ActionName in ProjectActionNames]:
  'tabId' extends keyof Helper<ProjectActionTypes[ActionName], undefined> ? ActionName : never
}[ProjectActionNames];
// `Required` actions are called from actions to ensure the `tabId` is always provided if needed.
// There are three types of actions:
// 1. With tabId, which is made required when calling action from another action handler
// 2. Without payload (= undefined), hence made the payload not required
// 3. With payload, hence made the payload required
export type RequiredGlobalActions = {
  [ActionName in ProjectActionNames]: ActionName extends TabStateActionNames ? ((
    payload: ProjectActionTypes[ActionName] & { tabId: number },
    options?: ActionOptions,
  ) => void) :
    (undefined extends ProjectActionTypes[ActionName] ? (
      (payload?: ProjectActionTypes[ActionName], options?: ActionOptions) => void
    ) : (
      (payload: ProjectActionTypes[ActionName], options?: ActionOptions) => void
    ))
} & { _: never };

type ActionHandlers = {
  [ActionName in keyof ProjectActionTypes]: (
    global: RequiredGlobalState,
    actions: RequiredGlobalActions,
    payload: ProjectActionTypes[ActionName],
  ) => GlobalState | void | Promise<void>;
};

export const getGlobal = typed.getGlobal;
export const setGlobal = typed.setGlobal;
const actionProxyCache = new WeakMap<object, object>();
const promiseActionProxyCache = new WeakMap<object, object>();

function getShareSafeActions<T extends object>(actions: T, isPromiseAction: boolean): T {
  const cache = isPromiseAction ? promiseActionProxyCache : actionProxyCache;
  const cached = cache.get(actions);
  if (cached) return cached as T;

  const blockedAction = isPromiseAction ? () => Promise.resolve(undefined) : () => undefined;
  const proxy = new Proxy(actions, {
    get(target, property, receiver) {
      const action = Reflect.get(target, property, receiver);
      if (typeof property !== 'string' || typeof action !== 'function' || isShareViewActionAllowed(property)) {
        return action;
      }

      return blockedAction;
    },
  });
  cache.set(actions, proxy);
  return proxy;
}

export function getActions(): ReturnType<typeof typed.getActions> {
  return getShareSafeActions(typed.getActions(), false);
}

export function getPromiseActions(): ReturnType<typeof typed.getPromiseActions> {
  return getShareSafeActions(typed.getPromiseActions(), true);
}
export const addActionHandler = typed.addActionHandler as <ActionName extends ProjectActionNames>(
  name: ActionName,
  handler: ActionHandlers[ActionName],
) => void;
export const execAfterActions = typed.execAfterActions;
export const withGlobal = typed.withGlobal;
export type GlobalActions = ReturnType<typeof getActions>;
