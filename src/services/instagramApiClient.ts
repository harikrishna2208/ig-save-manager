import {
  type Collection,
  type CollectionResponse,
  type Media,
  type MediaEnvelope,
} from "../types";
import { Logger } from "./logger";

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

export class AuthenticationError extends Error {
  constructor(message = "Not logged in to Instagram") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends Error {
  constructor(message = "Instagram API rate limit hit (HTTP 429)") {
    super(message);
    this.name = "RateLimitError";
  }
}

export class InstagramApiClient {
  private static APP_ID = "936619743392459";
  private static ASBD_ID = "198387";

  private static getHeaders(csrfToken?: string): HeadersInit {
    const headers: Record<string, string> = {
      accept: "*/*",
      "sec-ch-ua-mobile": "?0",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      "x-ig-app-id": this.APP_ID,
      "x-asbd-id": this.ASBD_ID,
      "x-requested-with": "XMLHttpRequest",
    };

    if (csrfToken) {
      headers["x-csrftoken"] = csrfToken;
    }

    return headers;
  }

  private static getCsrfToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof chrome === "undefined" || !chrome.cookies) {
        // Fallback for tests / non-extension runs
        resolve("mock_csrf_token");
        return;
      }

      chrome.cookies.get(
        { url: "https://www.instagram.com", name: "csrftoken" },
        (cookie) => {
          if (cookie && cookie.value) {
            resolve(cookie.value);
          } else {
            reject(new Error("CSRF token cookie not found. Please log in."));
          }
        },
      );
    });
  }

  private static async request<T>(
    url: string,
    options: RequestInit = {},
    csrfRequired = false,
  ): Promise<T> {
    let csrfToken: string | undefined;
    if (csrfRequired) {
      try {
        csrfToken = await this.getCsrfToken();
      } catch (err) {
        throw new AuthenticationError((err as Error).message);
      }
    } else {
      // Proactively fetch if available
      try {
        csrfToken = await this.getCsrfToken();
      } catch {
        // Ignore if not strictly required
      }
    }

    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(csrfToken),
        ...(options.headers || {}),
      },
      credentials: "include",
      mode: "cors",
      referrer: "https://www.instagram.com/",
    };

    try {
      const response = await fetch(url, mergedOptions);

      if (response.redirected) {
        // Redirection to accounts/login indicates missing session
        throw new AuthenticationError();
      }

      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError("Session expired or permission denied");
      }

      if (response.status === 429) {
        throw new RateLimitError();
      }

      if (response.status !== 200) {
        const text = await response.text();
        throw new InstagramApiError(
          `Request failed: ${text || response.statusText}`,
          response.status,
          response.statusText,
        );
      }

      return await response.json();
    } catch (err) {
      if (
        err instanceof AuthenticationError ||
        err instanceof RateLimitError ||
        err instanceof InstagramApiError
      ) {
        throw err;
      }
      throw new Error(`Instagram connection failed: ${(err as Error).message}`);
    }
  }

  public static async getAccountInfo(): Promise<{ username: string }> {
    await Logger.debug("InstagramApiClient", "Fetching account info");
    const result = await this.request<{ form_data: { username: string } }>(
      "https://i.instagram.com/api/v1/accounts/edit/web_form_data/",
      { method: "GET" },
    );
    if (!result || !result.form_data || !result.form_data.username) {
      throw new AuthenticationError("Failed to resolve user account credentials");
    }
    return result.form_data;
  }

  public static async validateSession(): Promise<boolean> {
    try {
      const info = await this.getAccountInfo();
      return !!info.username;
    } catch (err) {
      await Logger.warn("InstagramApiClient", "Session validation failed", err);
      return false;
    }
  }

  public static async getCollections(maxId = ""): Promise<CollectionResponse<Collection>> {
    await Logger.debug("InstagramApiClient", "Fetching collections list", { maxId });
    const query =
      'collection_types=["ALL_MEDIA_AUTO_COLLECTION","MEDIA","AUDIO_AUTO_COLLECTION"]&include_public_only=0&get_cover_media_lists=true';
    const url = `https://i.instagram.com/api/v1/collections/list/?${query}&max_id=${maxId}`;
    return await this.request<CollectionResponse<Collection>>(url, { method: "GET" });
  }

  public static async getCollectionMedia(
    collectionId: string,
    maxId = "",
  ): Promise<CollectionResponse<Media>> {
    await Logger.debug("InstagramApiClient", "Fetching collection media", {
      collectionId,
      maxId,
    });
    const url = `https://i.instagram.com/api/v1/feed/collection/${collectionId}/posts/?max_id=${maxId}`;
    const result = await this.request<CollectionResponse<MediaEnvelope>>(url, { method: "GET" });

    // Map envelopes to direct Media arrays
    const items = (result.items || []).map((envelope) => envelope.media).filter(Boolean);
    return {
      ...result,
      items,
    };
  }

  public static async getAllSavedMedia(maxId = ""): Promise<CollectionResponse<Media>> {
    await Logger.debug("InstagramApiClient", "Fetching all saved media", { maxId });
    const url = `https://i.instagram.com/api/v1/feed/saved/posts/?max_id=${maxId}`;
    const result = await this.request<CollectionResponse<MediaEnvelope>>(url, { method: "GET" });

    const items = (result.items || []).map((envelope) => envelope.media).filter(Boolean);
    return {
      ...result,
      items,
    };
  }

  public static async unsaveMedia(mediaId: string): Promise<void> {
    await Logger.info("InstagramApiClient", `Requesting unsave for mediaId: ${mediaId}`);
    const url = `https://www.instagram.com/api/v1/web/save/${mediaId}/unsave/`;
    await this.request<any>(url, { method: "POST" }, true);
  }
}
