import { useSyncExternalStore } from 'react';

export type RemixSound = {
  title: string;
  url: string;
  start: number;
  length: number;
};

export type Remix = {
  videoId: string;
  username: string;
  sound: RemixSound;
};

let current: Remix | null = null;
const listeners = new Set<() => void>();

export function setRemix(next: Remix | null) {
  current = next;
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

export function useRemix(): Remix | null {
  return useSyncExternalStore(subscribe, getRemix, getRemix);
}

export function remixLabel(r: Remix): string {
  return `Sound from @${r.username}`;
}