import type { Media } from "../types";
import { Logger } from "./logger";

export interface DownloadTask {
  url: string;
  filename: string;
}

export class DownloaderService {
  /**
   * Resolves list of downloadable items with formatting file extensions.
   * Carousel components append sequence indices to prevent conflicts.
   */
  public static getDownloadTasks(media: Media, includeThumbnails = false): DownloadTask[] {
    const code = media.code || media.id;
    const tasks: DownloadTask[] = [];

    switch (media.media_type) {
      case 1: // Image
        this.appendImageTask(media, code, tasks);
        break;
      case 2: // Video
        this.appendVideoTask(media, code, includeThumbnails, tasks);
        break;
      case 8: // Carousel
        if ("carousel_media" in media && Array.isArray(media.carousel_media)) {
          let idx = 1;
          for (const item of media.carousel_media) {
            const subCode = `${code}_${idx}`;
            if (item.media_type === 1) {
              this.appendImageTask(item, subCode, tasks);
            } else if (item.media_type === 2) {
              this.appendVideoTask(item, subCode, includeThumbnails, tasks);
            }
            idx++;
          }
        } else {
          // Fallback if carousel structure is missing
          this.appendImageTask(media, code, tasks);
        }
        break;
      default:
        Logger.warn("DownloaderService", `Skipping unknown media type: ${media.media_type}`);
    }

    return tasks;
  }

  private static appendImageTask(media: any, filenamePrefix: string, tasks: DownloadTask[]): void {
    if (media.image_versions2?.candidates?.length > 0) {
      // Pick highest resolution candidate (first candidate is usually largest)
      const url = media.image_versions2.candidates[0].url;
      tasks.push({ url, filename: `${filenamePrefix}.jpg` });
    } else {
      Logger.warn("DownloaderService", "No image candidates found for image media type");
    }
  }

  private static appendVideoTask(
    media: any,
    filenamePrefix: string,
    includeThumbnails: boolean,
    tasks: DownloadTask[],
  ): void {
    if (media.video_versions?.length > 0) {
      // Pick highest quality video (first video version)
      const url = media.video_versions[0].url;
      tasks.push({ url, filename: `${filenamePrefix}.mp4` });
    } else {
      Logger.warn("DownloaderService", "No video version urls found for video media type");
    }

    if (includeThumbnails) {
      this.appendImageTask(media, `${filenamePrefix}_thumb`, tasks);
    }
  }

  /**
   * Downloads multiple media items sequentially with a delay between each to
   * avoid triggering Instagram rate limits or Chrome download throttling.
   * delayMs should be >= 1000ms; lower values risk getting throttled.
   */
  public static async downloadItems(
    mediaList: Media[],
    includeThumbnails = false,
    delayMs = 1500,
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    const total = mediaList.length;
    if (total === 0) return;

    await Logger.info("DownloaderService", `Starting bulk download: ${total} items, ${delayMs}ms delay`);

    for (let i = 0; i < total; i++) {
      await this.downloadItem(mediaList[i], includeThumbnails);
      onProgress?.(i + 1, total);
      // Delay between items (skip after the last one)
      if (i < total - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    await Logger.info("DownloaderService", `Bulk download complete: ${total} items`);
  }

  /**
   * Triggers download task through browser downloads service.
   */
  public static async downloadItem(media: Media, includeThumbnails = false): Promise<void> {
    const tasks = this.getDownloadTasks(media, includeThumbnails);
    if (tasks.length === 0) {
      await Logger.warn("DownloaderService", `No files found to download for media ID: ${media.id}`);
      return;
    }

    await Logger.info(
      "DownloaderService",
      `Initiating downloads for media ID: ${media.id}. Total files: ${tasks.length}`,
    );

    for (const task of tasks) {
      await this.triggerChromeDownload(task.url, task.filename);
    }
  }

  private static triggerChromeDownload(url: string, filename: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (typeof chrome === "undefined" || !chrome.downloads) {
        // Fallback for tests/mock triggers
        Logger.debug("DownloaderService", `Mock download triggered: ${filename}`);
        resolve(Math.floor(Math.random() * 100000));
        return;
      }

      chrome.downloads.download(
        {
          url: url,
          filename: filename,
          conflictAction: "uniquify",
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (downloadId) {
            resolve(downloadId);
          } else {
            reject(new Error("Unknown chrome download scheduling failure"));
          }
        },
      );
    });
  }

  /**
   * Helper resolving post thumbnail URLs for visual collection lists.
   */
  public static getThumbnailUrl(media: Media): string {
    try {
      if (media.media_type === 1 || media.media_type === 2) {
        if ("image_versions2" in media && media.image_versions2?.candidates?.length > 0) {
          const candidates = media.image_versions2.candidates;
          // Get the last candidate (often lowest resolution for grid speed) or first
          return candidates[candidates.length - 1].url;
        }
      } else if (media.media_type === 8 && "carousel_media" in media) {
        const carousel = media.carousel_media;
        if (carousel?.length > 0) {
          return this.getThumbnailUrl(carousel[0] as Media);
        }
      }
    } catch (err) {
      console.warn("Error parsing thumbnail URL", err);
    }

    // Fallback pixel placeholder url if parse fails
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23222'/></svg>";
  }
}
