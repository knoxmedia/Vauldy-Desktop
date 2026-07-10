import { create } from "zustand";
import type { MediaItem } from "@/api/types";

type PlayerState = {
  mediaId: number | null;
  title: string | null;
  fileType: string | null;
  poster: string | null;
  playing: boolean;
  position: number;
  duration: number;
  setNowPlaying: (item: Pick<MediaItem, "id" | "title" | "file_type">, poster?: string | null) => void;
  setPlaybackState: (playing: boolean, position?: number, duration?: number) => void;
  clear: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  mediaId: null,
  title: null,
  fileType: null,
  poster: null,
  playing: false,
  position: 0,
  duration: 0,
  setNowPlaying: (item, poster = null) =>
    set({
      mediaId: item.id,
      title: item.title,
      fileType: item.file_type,
      poster,
      playing: true,
    }),
  setPlaybackState: (playing, position, duration) =>
    set((s) => ({
      playing,
      position: position ?? s.position,
      duration: duration ?? s.duration,
    })),
  clear: () =>
    set({
      mediaId: null,
      title: null,
      fileType: null,
      poster: null,
      playing: false,
      position: 0,
      duration: 0,
    }),
}));
