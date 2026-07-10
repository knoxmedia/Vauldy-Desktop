const TV_TYPES = new Set(["tv", "anime"]);
const MUSIC_TYPES = new Set(["music"]);
const PHOTO_TYPES = new Set(["photo"]);
const DOCUMENT_TYPES = new Set(["document"]);

export function isTVLibraryType(type: string): boolean {
  return TV_TYPES.has(type);
}

export function isMusicLibraryType(type: string): boolean {
  return MUSIC_TYPES.has(type);
}

export function isPhotoLibraryType(type: string): boolean {
  return PHOTO_TYPES.has(type);
}

export function isDocumentLibraryType(type: string): boolean {
  return DOCUMENT_TYPES.has(type);
}

export function libraryFileType(type: string): string | undefined {
  if (isMusicLibraryType(type)) return "audio";
  if (isPhotoLibraryType(type)) return "image";
  if (isDocumentLibraryType(type)) return "document";
  if (type === "movie" || type === "video" || isTVLibraryType(type)) return "video";
  return undefined;
}

export function libraryTypeLabel(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    movie: t("library.type.movie"),
    tv: t("library.type.tv"),
    anime: t("library.type.anime"),
    music: t("library.type.music"),
    photo: t("library.type.photo"),
    document: t("library.type.document"),
    video: t("library.type.video"),
  };
  return map[type] || type;
}

export const libGradients: Record<string, [string, string]> = {
  movie: ["#1a2a4a", "#0d1528"],
  tv: ["#2a1a4a", "#150d28"],
  anime: ["#4a1a3a", "#280d20"],
  music: ["#1a3a2a", "#0d2818"],
  photo: ["#1a3a4a", "#0d2028"],
  document: ["#3a3a2a", "#202018"],
  video: ["#2a2a3a", "#14141c"],
};

export function libGradient(type: string, id: number): [string, string, string] {
  const [a, b] = libGradients[type] || ["#252535", "#12121a"];
  const tint = id % 40;
  return [a, b, `hsl(${220 + tint}, 28%, ${14 + (id % 8)}%)`];
}
