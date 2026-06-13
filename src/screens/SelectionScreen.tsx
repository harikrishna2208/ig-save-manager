import React, { useState, useEffect, useRef } from "react";
import { Grid } from "../components/Grid";
import { Button } from "../components/Button";
import { PreviewModal } from "../components/PreviewModal";
import { InstagramApiClient } from "../services/instagramApiClient";
import { DownloaderService } from "../services/downloader";
import { type Collection, type Media, type UserPreferences } from "../types";
import { StorageService } from "../services/storage";

interface SelectionScreenProps {
  collection: Collection;
  onBack: () => void;
  onStartQueue: (mediaItems: Media[], collectionId?: string) => void;
  prefs: UserPreferences;
}

export const SelectionScreen: React.FC<SelectionScreenProps> = ({
  collection,
  onBack,
  onStartQueue,
  prefs,
}) => {
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [nextMaxId, setNextMaxId] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Media[]>([]); // Items explicitly selected OR explicitly excluded (in Select All mode)

  // Bulk download progress state
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  // Mute preference (local copy so it updates across previews in the same session)
  const [mutedByDefault, setMutedByDefault] = useState(prefs.videoMutedByDefault);

  // Search + filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video" | "carousel">("all");

  // Media Preview states
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null);
  const [previewIndex, setPreviewIndex] = useState(-1);

  // Determine Grid dimensions based on size preferences
  const getGridParams = () => {
    switch (prefs.popupSize) {
      case "compact":
        return { columns: 3, rowHeight: 115, height: 350 };
      case "expanded":
        return { columns: 7, rowHeight: 105, height: 460 };
      case "normal":
      default:
        return { columns: 5, rowHeight: 110, height: 420 };
    }
  };

  const { columns, rowHeight, height: containerHeight } = getGridParams();

  const filteredItems = mediaItems.filter((m) => {
    if (searchQuery && !m.code?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter === "image" && m.media_type !== 1) return false;
    if (typeFilter === "video" && m.media_type !== 2) return false;
    if (typeFilter === "carousel" && m.media_type !== 8) return false;
    return true;
  });

  const fetchingRef = useRef(false);

  const fetchMedia = async () => {
    if (loading || !hasMore || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let response;
      if (collection.collection_id === "ALL_MEDIA_AUTO_COLLECTION") {
        response = await InstagramApiClient.getAllSavedMedia(nextMaxId);
      } else {
        response = await InstagramApiClient.getCollectionMedia(collection.collection_id, nextMaxId);
      }

      const newItems = response.items || [];
      setMediaItems((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        for (const item of newItems) {
          if (!existingIds.has(item.id)) {
            merged.push(item);
          }
        }
        return merged;
      });

      setNextMaxId(response.next_max_id || "");
      setHasMore(!!response.more_available && !!response.next_max_id);
    } catch (err) {
      console.error(err);
      setError("Failed to load posts. Try again.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMedia(); }, []);

  const handleTileClick = (media: Media) => {
    setSelectedItems((prev) => {
      const alreadyHas = prev.some((item) => item.id === media.id);
      if (alreadyHas) {
        return prev.filter((item) => item.id !== media.id);
      }
      return [...prev, media];
    });
  };

  const isMediaSelected = (media: Media) => {
    const inList = selectedItems.some((item) => item.id === media.id);
    return selectAllMode ? !inList : inList;
  };

  const handleSelectAllToggle = () => {
    if (selectAllMode) {
      setSelectAllMode(false);
      setSelectedItems([]);
    } else {
      setSelectAllMode(true);
      setSelectedItems([]); // In select all mode, selectedItems represent excluded items
    }
  };

  const handleOpenPreview = (media: Media, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewMedia(media);
    setPreviewIndex(idx);
  };

  const handleOpenInstagram = (media: Media, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://www.instagram.com/p/${media.code}/`;
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank");
    }
  };

  const handleDownload = (media: Media, e: React.MouseEvent) => {
    e.stopPropagation();
    DownloaderService.downloadItem(media, prefs.includeThumbnails);
  };

  const handleDownloadSelected = async () => {
    const items = getUnsaveList();
    if (items.length === 0) return;
    setDownloadProgress({ done: 0, total: items.length });
    await DownloaderService.downloadItems(items, prefs.includeThumbnails, 1500, (done, total) => {
      setDownloadProgress({ done, total });
    });
    setDownloadProgress(null);
  };

  const getUnsaveList = (): Media[] => {
    if (selectAllMode) {
      // Unsave all loaded items EXCEPT those in selectedItems (excluded)
      return mediaItems.filter((m) => !selectedItems.some((ex) => ex.id === m.id));
    }
    return selectedItems;
  };

  const unsaveCount = selectAllMode
    ? Math.max(0, collection.collection_media_count - selectedItems.length)
    : selectedItems.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div className="header-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text)",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="Back to Collections"
          >
            &#8592;
          </button>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700 }}>{collection.collection_name}</h2>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {mediaItems.length} of {collection.collection_media_count} loaded
            </span>
          </div>
        </div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--primary)" }}>
          Selected: {unsaveCount}
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by post code…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "11px",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "4px 6px",
            fontSize: "11px",
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          <option value="all">All</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="carousel">Carousels</option>
        </select>
        {(searchQuery || typeFilter !== "all") && (
          <button
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}
            onClick={() => { setSearchQuery(""); setTypeFilter("all"); }}
            title="Clear filters"
          >
            &times;
          </button>
        )}
      </div>

      {/* Grid Container */}
      <div className="content-area" style={{ padding: "8px" }}>
        {error && (
          <div style={{ textAlign: "center", padding: "16px", color: "var(--danger)" }}>
            <p style={{ marginBottom: "10px" }}>{error}</p>
            <Button variant="secondary" onClick={() => { setHasMore(true); fetchMedia(); }}>
              Retry
            </Button>
          </div>
        )}

        <Grid
          items={filteredItems}
          columns={columns}
          rowHeight={rowHeight}
          containerHeight={containerHeight}
          onReachEnd={fetchMedia}
          renderItem={(media, idx) => {
            const selected = isMediaSelected(media);
            const isVideo = media.media_type === 2;
            const isCarousel = media.media_type === 8;

            return (
              <div
                key={media.id}
                className={`tile ${selected ? "selected" : ""}`}
                onClick={() => handleTileClick(media)}
              >
                {/* Image thumb */}
                <img src={DownloaderService.getThumbnailUrl(media)} alt="" loading="lazy" />

                {/* Indicators (Video/Carousel) */}
                {(isVideo || isCarousel) && (
                  <div className="tile-overlay-always">
                    {isVideo ? (
                      <span aria-label="video">&#9658;</span>
                    ) : (
                      <span aria-label="carousel">&#128196;</span>
                    )}
                  </div>
                )}

                {/* Selection Checkbox */}
                <div className="tile-checkbox">
                  {selected && (
                    <span style={{ color: "white", fontSize: "10px", fontWeight: "bold" }}>
                      &#10003;
                    </span>
                  )}
                </div>

                {/* Hover control bar */}
                <div className="tile-overlay">
                  <button
                    className="btn btn-primary"
                    style={{ padding: "4px 8px", fontSize: "10px" }}
                    onClick={(e) => handleOpenPreview(media, idx, e)}
                  >
                    Preview
                  </button>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "3px 6px", fontSize: "9px" }}
                      onClick={(e) => handleOpenInstagram(media, e)}
                      title="View on Instagram"
                    >
                      IG
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "3px 6px", lineHeight: 0 }}
                      onClick={(e) => handleDownload(media, e)}
                      title="Download Post"
                      aria-label="Download Post"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          }}
        />

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading posts...</span>
          </div>
        )}

        {!loading && hasMore && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px" }}>
            <Button variant="secondary" onClick={fetchMedia} style={{ fontSize: "12px", padding: "6px 14px" }}>
              Load More
            </Button>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="footer-bar">
        <Button variant="secondary" onClick={handleSelectAllToggle}>
          {selectAllMode ? "Clear Selection" : "Select All"}
        </Button>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {downloadProgress ? (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Downloading {downloadProgress.done}/{downloadProgress.total}…
            </span>
          ) : (
            <Button
              variant="secondary"
              disabled={unsaveCount === 0}
              onClick={handleDownloadSelected}
              title="Download selected items (1.5s delay between each to avoid rate limits)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download ({unsaveCount})
            </Button>
          )}

          <Button
            variant="danger"
            disabled={unsaveCount === 0}
            onClick={() => {
              const itemsToUnsave = getUnsaveList();
              onStartQueue(
                itemsToUnsave,
                selectAllMode ? collection.collection_id : undefined
              );
            }}
          >
            Unsave ({unsaveCount})
          </Button>
        </div>
      </div>

      {/* Media Preview Modal */}
      {previewMedia && (
        <PreviewModal
          media={previewMedia}
          autoplayVideos={prefs.autoplayVideos}
          videoMutedByDefault={mutedByDefault}
          onMuteChange={(muted) => {
            setMutedByDefault(muted);
            StorageService.setPreferences({ videoMutedByDefault: muted });
          }}
          onClose={() => setPreviewMedia(null)}
          onNext={
            previewIndex < filteredItems.length - 1
              ? () => {
                  const nextIdx = previewIndex + 1;
                  setPreviewMedia(filteredItems[nextIdx]);
                  setPreviewIndex(nextIdx);
                }
              : undefined
          }
          onPrev={
            previewIndex > 0
              ? () => {
                  const prevIdx = previewIndex - 1;
                  setPreviewMedia(filteredItems[prevIdx]);
                  setPreviewIndex(prevIdx);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
