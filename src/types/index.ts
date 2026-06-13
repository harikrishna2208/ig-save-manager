export type Collection = {
  collection_id: string;
  collection_media_count: number;
  collection_name: string;
  collection_type: "MEDIA" | "ALL_MEDIA_AUTO_COLLECTION" | "AUDIO_AUTO_COLLECTION";
  cover_media_list?: Media[];
};

export type Image2Versions = {
  candidates: MediaInfo[];
};

export type MediaInfo = {
  height: number;
  width: number;
  url: string;
};

export type BaseMedia = {
  id: string;
  code?: string;
  media_type: number;
};

export type ImageMedia = {
  image_versions2: Image2Versions;
};

export type VideoMedia = {
  image_versions2: Image2Versions;
  video_versions: Video[];
};

export type Video = MediaInfo & {
  type: number;
  id: string;
};

export type CarouselMedia = {
  carousel_media: (BaseMedia & (ImageMedia | VideoMedia))[];
  carousel_media_count: number;
};

export type Media = BaseMedia & (ImageMedia | VideoMedia | CarouselMedia);

export type MediaEnvelope = {
  media: Media;
};

export type CollectionResponse<T> = {
  auto_load_more_enabled: boolean;
  status: string;
  more_available: boolean;
  items: T[];
  next_max_id?: string;
  num_results?: number;
};

export enum QueueState {
  IDLE = "IDLE",
  LOADING = "LOADING",
  READY = "READY",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  RATE_LIMITED = "RATE_LIMITED",
  RETRYING = "RETRYING",
  CANCELLING = "CANCELLING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface QueueProgress {
  state: QueueState;
  currentIndex: number;
  totalItems: number;
  processedItems: number;
  retryCount: number;
  lastUpdated: string;
  error?: string;
  mediaIds: string[];
  collectionId?: string;
}

export interface UserPreferences {
  theme: "light" | "dark";
  popupSize: "compact" | "normal" | "expanded";
  downloadMedia: boolean;
  includeThumbnails: boolean;
  waitTime: number;
  autoplayVideos: boolean;
  videoMutedByDefault: boolean;
  videoVolume: number;
  showPreviewModal: boolean;
  lastSelectedCollectionId?: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  popupSize: "normal",
  downloadMedia: false,
  includeThumbnails: false,
  waitTime: 1000,
  autoplayVideos: true,
  videoMutedByDefault: false,
  videoVolume: 0.75,
  showPreviewModal: true,
};
