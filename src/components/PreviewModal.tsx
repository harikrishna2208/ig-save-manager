import React, { useState, useEffect, useRef } from "react";
import type { Media, CarouselMedia } from "../types";
import { DownloaderService } from "../services/downloader";
import { Button } from "./Button";

interface PreviewModalProps {
  media: Media;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  autoplayVideos?: boolean;
  videoMutedByDefault?: boolean;
  onMuteChange?: (muted: boolean) => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  media,
  onClose,
  onNext,
  onPrev,
  autoplayVideos = true,
  videoMutedByDefault = true,
  onMuteChange,
}) => {
  // Carousel active index state
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Image Zoom states
  const [zoom, setZoom] = useState(1.0);

  // Rotation state (degrees: 0, 90, 180, 270)
  const [rotation, setRotation] = useState(0);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Video player custom states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(videoMutedByDefault ? 0 : 0.8);
  const [isMuted, setIsMuted] = useState(videoMutedByDefault);
  const [speed, setSpeed] = useState(1.0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset active configurations on media shifts
  useEffect(() => {
    setCarouselIndex(0);
    setZoom(1.0);
    setRotation(0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSpeed(1.0);
  }, [media.id]);

  // Track fullscreen state changes (e.g. user presses Escape to exit)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Bind Keyboard Listeners for Accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNextClick();
      } else if (e.key === "ArrowLeft") {
        handlePrevClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [media, carouselIndex]);

  // Handle Carousel & Multi-post transitions
  const isCarousel = media.media_type === 8 && "carousel_media" in media;
  const carouselItems = isCarousel ? (media as CarouselMedia).carousel_media : [];

  const handleNextClick = () => {
    if (isCarousel && carouselIndex < carouselItems.length - 1) {
      setCarouselIndex(carouselIndex + 1);
      setZoom(1.0);
    } else if (onNext) {
      onNext();
    }
  };

  const handlePrevClick = () => {
    if (isCarousel && carouselIndex > 0) {
      setCarouselIndex(carouselIndex - 1);
      setZoom(1.0);
    } else if (onPrev) {
      onPrev();
    }
  };

  // Resolve current active item context
  const activeItem = isCarousel ? carouselItems[carouselIndex] : media;
  const isVideo = activeItem.media_type === 2;

  // Zoom control triggers
  const handleZoomIn = () => setZoom((z) => Math.min(3.0, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));
  const handleZoomReset = () => setZoom(1.0);

  // Custom Video playback controllers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => console.log("Play failed", err));
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
    video.muted = vol === 0;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
    onMuteChange?.(nextMuted);
  };

  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleRotateReset = () => setRotation(0);

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      modalRef.current?.requestFullscreen();
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.playbackRate = val;
    setSpeed(val);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // AutoPlay synchronization on element loading
  useEffect(() => {
    const video = videoRef.current;
    if (video && isVideo) {
      video.muted = isMuted;
      video.volume = isMuted ? 0 : volume;
      video.playbackRate = speed;
      if (autoplayVideos) {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  }, [activeItem.id, isVideo]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>
              Preview Post: {media.code}
            </span>
            {isCarousel && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                Carousel Item {carouselIndex + 1} of {carouselItems.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={handleFullscreen}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", lineHeight: 0 }}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                  <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                  <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text)", fontSize: "20px", cursor: "pointer", padding: "4px" }}
              aria-label="Close Preview"
            >
              &times;
            </button>
          </div>
        </div>

        {/* View Body */}
        <div className="modal-body">
          {/* Navigation Arrows */}
          {(carouselIndex > 0 || onPrev) && (
            <button
              onClick={handlePrevClick}
              style={{
                position: "absolute",
                left: "8px",
                zIndex: 10,
                backgroundColor: "rgba(0,0,0,0.6)",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                color: "white",
                cursor: "pointer",
                fontSize: "18px",
              }}
              aria-label="Previous Post"
            >
              &#10094;
            </button>
          )}

          {(carouselIndex < carouselItems.length - 1 || onNext) && (
            <button
              onClick={handleNextClick}
              style={{
                position: "absolute",
                right: "8px",
                zIndex: 10,
                backgroundColor: "rgba(0,0,0,0.6)",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                color: "white",
                cursor: "pointer",
                fontSize: "18px",
              }}
              aria-label="Next Post"
            >
              &#10095;
            </button>
          )}

          {/* Media Renderer */}
          {isVideo ? (
            <video
              ref={videoRef}
              src={
                "video_versions" in activeItem && Array.isArray((activeItem as { video_versions: { url: string }[] }).video_versions)
                  ? (activeItem as { video_versions: { url: string }[] }).video_versions[0].url
                  : undefined
              }
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              style={{ maxWidth: "100%", maxHeight: "100%", outline: "none", transform: rotation ? `rotate(${rotation}deg)` : undefined, transition: "transform 0.2s ease" }}
              playsInline
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "auto",
              }}
            >
              <img
                src={
                  "image_versions2" in activeItem
                    ? activeItem.image_versions2.candidates[0].url
                    : undefined
                }
                alt="Post Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  transform: `rotate(${rotation}deg) scale(${zoom})`,
                  transition: "transform 0.2s ease",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
        </div>

        {/* Video Control Bar or Zoom Panel */}
        {isVideo && videoRef.current && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {/* Seek Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "white" }}>{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={handleSeekChange}
                style={{ flex: 1, cursor: "pointer", accentColor: "var(--primary)" }}
              />
              <span style={{ fontSize: "11px", color: "white" }}>{formatTime(duration)}</span>
            </div>

            {/* Sub Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={togglePlay}
                  style={{
                    background: "none",
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    onClick={toggleMute}
                    style={{
                      background: "none",
                      border: "none",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    {isMuted ? "Unmute" : "Mute"}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    style={{ width: "60px", accentColor: "var(--primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  onClick={handleRotate}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px", color: "white", cursor: "pointer", padding: "2px 6px", fontSize: "11px" }}
                  title="Rotate 90°"
                >
                  ↻
                </button>
                {rotation !== 0 && (
                  <button
                    onClick={handleRotateReset}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer", padding: "2px 6px", fontSize: "11px" }}
                    title="Reset rotation"
                  >
                    {rotation}°
                  </button>
                )}
                <select
                  value={speed}
                  onChange={handleSpeedChange}
                  style={{
                    backgroundColor: "transparent",
                    color: "white",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    padding: "2px 4px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  <option value="0.5" style={{ color: "black" }}>0.5x</option>
                  <option value="1.0" style={{ color: "black" }}>1.0x</option>
                  <option value="1.5" style={{ color: "black" }}>1.5x</option>
                  <option value="2.0" style={{ color: "black" }}>2.0x</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {!isVideo && (
          <div
            style={{
              padding: "6px 12px",
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleZoomOut}>Zoom -</button>
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleZoomReset}>Reset ({Math.round(zoom * 100)}%)</button>
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleZoomIn}>Zoom +</button>
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleRotate} title="Rotate 90°">↻</button>
            {rotation !== 0 && (
              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleRotateReset} title="Reset rotation">{rotation}°</button>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Back to Grid
          </Button>
          <Button
            onClick={() => {
              DownloaderService.downloadItem(media);
            }}
          >
            Download Original
          </Button>
        </div>
      </div>
    </div>
  );
};
