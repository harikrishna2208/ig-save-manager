import React, { useState, useEffect, useRef } from "react";
import { InstagramApiClient } from "../services/instagramApiClient";
import { DownloaderService } from "../services/downloader";
import { type Collection } from "../types";
import { Button } from "../components/Button";

interface CollectionsScreenProps {
  onSelectCollection: (collection: Collection) => void;
  username: string;
  lastSelectedCollectionId?: string;
}

export const CollectionsScreen: React.FC<CollectionsScreenProps> = ({
  onSelectCollection,
  username,
  lastSelectedCollectionId,
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [nextMaxId, setNextMaxId] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  // Prevents concurrent fetches when auto-fill effect fires rapidly
  const fetchingRef = useRef(false);

  const fetchCollections = async () => {
    if (loading || !hasMore || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await InstagramApiClient.getCollections(nextMaxId);

      const filtered = (response.items || []).filter(
        (col) => col.collection_id !== "AUDIO_AUTO_COLLECTION"
      );

      setCollections((prev) => {
        // Prevent duplication of collection cards on hot reloads
        const existingIds = new Set(prev.map((c) => c.collection_id));
        const merged = [...prev];
        for (const col of filtered) {
          if (!existingIds.has(col.collection_id)) {
            merged.push(col);
          }
        }
        return merged;
      });

      setNextMaxId(response.next_max_id || "");
      setHasMore(!!response.more_available && !!response.next_max_id);
    } catch (err) {
      console.error(err);
      setError("Failed to load collections. Try again.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  // Initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCollections(); }, []);

  // Auto-fill: if collections don't overflow the viewport, keep fetching pages.
  // Runs after every render; guards exit immediately when not needed.
  useEffect(() => {
    if (loading || !hasMore) return;
    const el = contentRef.current;
    if (!el || el.scrollHeight > el.clientHeight + 2) return;
    fetchCollections();
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const threshold = target.scrollHeight - target.clientHeight - 50;
    if (target.scrollTop >= threshold) {
      fetchCollections();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header bar section */}
      <div className="header-bar">
        <h2 style={{ fontSize: "16px", fontWeight: 700 }}>
          {username ? `${username}'s Collections` : "Your Collections"}
        </h2>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {collections.length} loaded{hasMore ? " · more available" : ""}
        </span>
      </div>

      {/* Main Grid display scrollable */}
      <div className="content-area" ref={contentRef} onScroll={handleScroll}>
        {error && (
          <div style={{ textAlign: "center", padding: "16px", color: "var(--danger)" }}>
            <p style={{ marginBottom: "10px" }}>{error}</p>
            <Button variant="secondary" onClick={() => { setHasMore(true); fetchCollections(); }}>
              Retry
            </Button>
          </div>
        )}

        <div className="collection-grid">
          {collections.map((col) => {
            const covers = col.cover_media_list || [];
            const hasMedia = col.collection_media_count > 0;

            return (
              <div
                key={col.collection_id}
                style={{ display: "flex", flexDirection: "column", gap: "5px", cursor: "pointer" }}
                onClick={() => onSelectCollection(col)}
              >
                <div className={`tile${col.collection_id === lastSelectedCollectionId ? " selected" : ""}`}
                  style={{ cursor: "pointer" }}>
                {/* Cover pictures quadrant grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gridTemplateRows: "repeat(2, 1fr)",
                    width: "100%",
                    height: "100%",
                    background: "var(--border)",
                  }}
                >
                  {hasMedia && covers.length > 0 ? (
                    // Render up to 4 cover photos
                    Array.from({ length: 4 }).map((_, idx) => {
                      const mediaItem = covers[idx % covers.length];
                      if (!mediaItem) return <div key={idx} style={{ background: "var(--surface)" }} />;
                      return (
                        <img
                          key={idx}
                          src={DownloaderService.getThumbnailUrl(mediaItem)}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            border: "0.5px solid var(--border)",
                          }}
                        />
                      );
                    })
                  ) : (
                    <div
                      style={{
                        gridColumn: "span 2",
                        gridRow: "span 2",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        background: "var(--surface)",
                      }}
                    >
                      Empty
                    </div>
                  )}
                </div>
                </div>
                {/* Name and count below the tile image */}
                <div style={{ padding: "0 2px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {col.collection_name}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    {col.collection_media_count} posts
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
            <button className="btn" disabled>Loading collections...</button>
          </div>
        )}

        {!loading && hasMore && (
          <div style={{ display: "flex", justifyContent: "center", padding: "12px" }}>
            <Button variant="secondary" onClick={fetchCollections}>
              Load More
            </Button>
          </div>
        )}

        {!loading && collections.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            <p>No collections found on this account.</p>
          </div>
        )}
      </div>
    </div>
  );
};
