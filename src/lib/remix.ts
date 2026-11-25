import { useSyncExternalStore } from 'react';

export type Remix = { kind: 'green' | 'sound'; from: string };

let current: Remix | null = null;
const listeners = new Set<() => void>();

export function setRemix(r: Remix | null) {
  current = r;
  listeners.forEach((l) => l());
}

export function getRemix(): Remix | null {
  return current;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function remixLabel(r: Remix): string {
  return (r.kind === 'green' ? 'Green screen from @' : 'Sound from @') + r.from;
}

export function useRemix(): Remix | null {
  return useSyncExternalStore(subscribe, getRemix, getRemix);
}