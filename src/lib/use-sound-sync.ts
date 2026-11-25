import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import type { VideoPlayer } from 'expo-video';
import { useEffect, useRef } from 'react';

export type SoundInfo = { url: string; start: number; length: number };

// Plays a chosen part of a sound in step with a video
export function useSoundSync(
  sound: SoundInfo | null | undefined,
  video: VideoPlayer,
  paused: boolean,
  muted: boolean = false
) {
  const url = sound ? sound.url : null;
  const start = sound ? sound.start : 0;
  const length = sound ? sound.length : 0;

  const audio = useAudioPlayer(url);
  const started = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      audio.muted = muted;
    } catch {
      // not ready yet
    }
  }, [muted, audio]);

  useEffect(() => {
    if (!url) {
      return;
    }
    started.current = false;
    const end = length > 0 ? start + length : Infinity;

    const id = setInterval(() => {
      try {
        if (!audio.isLoaded) {
          return;
        }
        if (!started.current) {
          started.current = true;
          audio.seekTo(start);
          if (!pausedRef.current) {
            audio.play();
          }
          return;
        }
        if (pausedRef.current) {
          if (audio.playing) {
            audio.pause();
          }
          return;
        }
        if (!audio.playing) {
          audio.play();
        }
        if (audio.currentTime >= end) {
          audio.seekTo(start);
        } else if (video.currentTime < 0.4 && audio.currentTime > start + 1) {
          audio.seekTo(start);
        }
      } catch {
        // player was released
      }
    }, 250);

    return () => {
      clearInterval(id);
      try {
        audio.pause();
      } catch {
        // already released
      }
    };
  }, [url, start, length, audio, video]);
}