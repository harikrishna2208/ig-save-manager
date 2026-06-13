import { describe, it, expect, beforeEach, vi } from "vitest";
import { InstagramApiClient, AuthenticationError, RateLimitError } from "../services/instagramApiClient";

// Mock Logger
vi.mock("../services/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("InstagramApiClient Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should validate active session correctly on success response", async () => {
    const mockResponse = {
      form_data: { username: "testuser" },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 200,
      redirected: false,
      json: () => Promise.resolve(mockResponse),
    } as any);

    const valid = await InstagramApiClient.validateSession();
    expect(valid).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://i.instagram.com/api/v1/accounts/edit/web_form_data/",
      expect.any(Object),
    );
  });

  it("should fail session validation on redirection or error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 200,
      redirected: true, // Indicates login redirect
    } as any);

    const valid = await InstagramApiClient.validateSession();
    expect(valid).toBe(false);
  });

  it("should parse rate limit status 429 to RateLimitError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 429,
      redirected: false,
    } as any);

    await expect(InstagramApiClient.getAccountInfo()).rejects.toThrow(RateLimitError);
  });

  it("should parse 401 unauthorized status to AuthenticationError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 401,
      redirected: false,
    } as any);

    await expect(InstagramApiClient.getAccountInfo()).rejects.toThrow(AuthenticationError);
  });

  it("should map envelopes to flat media items in getCollectionMedia", async () => {
    const mockEnvelopeResponse = {
      status: "ok",
      items: [
        { media: { id: "123_456", code: "code1", media_type: 1 } },
        { media: { id: "789_012", code: "code2", media_type: 2 } },
      ],
      more_available: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 200,
      redirected: false,
      json: () => Promise.resolve(mockEnvelopeResponse),
    } as any);

    const result = await InstagramApiClient.getCollectionMedia("col_id");
    expect(result.items.length).toBe(2);
    expect(result.items[0]).toEqual({ id: "123_456", code: "code1", media_type: 1 });
    expect(result.items[1]).toEqual({ id: "789_012", code: "code2", media_type: 2 });
  });
});
