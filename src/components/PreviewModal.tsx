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
  initialVolume?: number;
  onMuteChange?: (muted: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  onAutoplayChange?: (autoplay: boolean) => void;
  onUnsave?: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  media,
  onClose,
  onNext,
  onPrev,
  autoplayVideos = true,
  videoMutedByDefault = false,
  initialVolume = 0.75,
  onMuteChange,
  onVolumeChange,
  onAutoplayChange,
  onUnsave,
}) => {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Per-media rotation memory: survives prev/next navigation within this session
  const rotationMap = useRef<Record<string, number>>({});

  // Video states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoNaturalWidth, setVideoNaturalWidth] = useState(0);
  const [videoNaturalHeight, setVideoNaturalHeight] = useState(0);
  const [volume, setVolume] = useState(videoMutedByDefault ? 0 : initialVolume);
  const [isMuted, setIsMuted] = useState(videoMutedByDefault);
  const [speed, setSpeed] = useState(1.0);
  const [localAutoplay, setLocalAutoplay] = useState(autoplayVideos);

  // Controls + nav visibility (fades after 2.5s of no mouse movement)
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nav arrows hover
  const [navHovered, setNavHovered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const resetControlsTimer = () => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
  };

  // On media change: save current rotation, restore saved rotation for new media
  useEffect(() => {
    setCarouselIndex(0);
    setZoom(1.0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSpeed(1.0);
    setVideoNaturalWidth(0);
    setVideoNaturalHeight(0);
    setControlsVisible(true);
    const saved = rotationMap.current[media.id] ?? 0;
    setRotation(saved);
  }, [media.id]);

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowRight") handleNextClick();
      else if (e.key === "ArrowLeft") handlePrevClick();
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [media, carouselIndex, isPlaying]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  const isCarousel = media.media_type === 8 && "carousel_media" in media;
  const carouselItems = isCarousel ? (media as CarouselMedia).carousel_media : [];

  const handleNextClick = () => {
    if (isCarousel && carouselIndex < carouselItems.length - 1) {
      rotationMap.current[media.id] = rotation;
      setCarouselIndex(carouselIndex + 1);
      setZoom(1.0);
    } else if (onNext) {
      rotationMap.current[media.id] = rotation;
      onNext();
    }
  };

  const handlePrevClick = () => {
    if (isCarousel && carouselIndex > 0) {
      rotationMap.current[media.id] = rotation;
      setCarouselIndex(carouselIndex - 1);
      setZoom(1.0);
    } else if (onPrev) {
      rotationMap.current[media.id] = rotation;
      onPrev();
    }
  };

  const handleClose = () => {
    // Release video memory before closing
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.src = "";
      video.load();
    }
    onClose();
  };

  const activeItem = isCarousel ? carouselItems[carouselIndex] : media;
  const isVideo = activeItem.media_type === 2;

  const handleZoomIn = () => setZoom((z) => Math.min(3.0, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));
  const handleZoomReset = () => setZoom(1.0);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      setVideoNaturalWidth(video.videoWidth);
      setVideoNaturalHeight(video.videoHeight);
    }
  };

  // When video is rotated 90/270, auto-scale to fill the black space
  const computeVideoTransform = (): string | undefined => {
    const parts: string[] = [];
    if (rotation) parts.push(`rotate(${rotation}deg)`);
    if (rotation === 90 || rotation === 270) {
      if (videoNaturalWidth && videoNaturalHeight) {
        const ar = videoNaturalWidth / videoNaturalHeight;
        // Scale by aspect ratio so the rotated video fills the container
        const autoScale = ar > 1 ? ar : 1 / ar;
        parts.push(`scale(${Math.min(autoScale, 2.5).toFixed(3)})`);
      }
    }
    return parts.length > 0 ? parts.join(" ") : undefined;
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
    const muted = vol === 0;
    setIsMuted(muted);
    video.muted = muted;
    onVolumeChange?.(vol);
    if (!muted) onMuteChange?.(false);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      const vol = initialVolume;
      video.volume = vol;
      setVolume(vol);
    }
    onMuteChange?.(nextMuted);
  };

  const handleRotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);
  const handleRotateCW = () => setRotation((r) => (r + 90) % 360);
  const handleRotateReset = () => setRotation(0);

  const handleFullscreen = () => setIsFullscreen((f) => !f);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.playbackRate = val;
    setSpeed(val);
  };

  const toggleAutoplay = () => {
    const next = !localAutoplay;
    setLocalAutoplay(next);
    onAutoplayChange?.(next);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Sync video element when active item changes
  useEffect(() => {
    const video = videoRef.current;
    if (video && isVideo) {
      video.muted = isMuted;
      video.volume = isMuted ? 0 : volume;
      video.playbackRate = speed;
      if (localAutoplay) {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  }, [activeItem.id, isVideo]);

  const controlBarStyle: React.CSSProperties = {
    transition: "opacity 0.4s ease",
    opacity: controlsVisible ? 1 : 0,
    pointerEvents: controlsVisible ? "auto" : "none",
  };

  return (
    <div className="modal-backdrop" onClick={handleClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={isFullscreen ? {
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          width: "100%",
          maxWidth: "unset",
          height: "100%",
          borderRadius: 0,
          zIndex: 200,
        } : undefined}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>
              {media.code ?? "Post Preview"}
            </span>
            {isCarousel && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                {carouselIndex + 1} / {carouselItems.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isCarousel && onNext && (
              <button
                onClick={() => { rotationMap.current[media.id] = rotation; onNext(); }}
                style={{ background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "5px", color: "var(--text-muted)", cursor: "pointer", padding: "3px 8px", fontSize: "11px" }}
                title="Skip entire carousel to next post"
              >
                Skip ⏭
              </button>
            )}
            <button
              onClick={handleFullscreen}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", lineHeight: 0 }}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
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
              onClick={handleClose}
              style={{ background: "none", border: "none", color: "var(--text)", fontSize: "20px", cursor: "pointer", padding: "4px" }}
              aria-label="Close Preview"
            >
              &times;
            </button>
          </div>
        </div>

        {/* View Body */}
        <div
          className="modal-body"
          onMouseMove={isVideo ? resetControlsTimer : undefined}
          onMouseEnter={() => setNavHovered(true)}
          onMouseLeave={() => { setNavHovered(false); }}
        >
          {/* Navigation Arrows */}
          {(carouselIndex > 0 || onPrev) && (
            <button
              onClick={handlePrevClick}
              style={{
                position: "absolute", left: "8px", zIndex: 10,
                backgroundColor: "rgba(0,0,0,0.6)", border: "none",
                borderRadius: "50%", width: "36px", height: "36px",
                color: "white", cursor: "pointer", fontSize: "18px",
                opacity: navHovered ? 1 : 0,
                transition: "opacity 0.2s ease",
              }}
              aria-label="Previous"
            >&#10094;</button>
          )}
          {(carouselIndex < carouselItems.length - 1 || onNext) && (
            <button
              onClick={handleNextClick}
              style={{
                position: "absolute", right: "8px", zIndex: 10,
                backgroundColor: "rgba(0,0,0,0.6)", border: "none",
                borderRadius: "50%", width: "36px", height: "36px",
                color: "white", cursor: "pointer", fontSize: "18px",
                opacity: navHovered ? 1 : 0,
                transition: "opacity 0.2s ease",
              }}
              aria-label="Next"
            >&#10095;</button>
          )}

          {/* Media */}
          {isVideo ? (
            <video
              ref={videoRef}
              src={
                "video_versions" in activeItem && Array.isArray((activeItem as { video_versions: { url: string }[] }).video_versions)
                  ? (activeItem as { video_versions: { url: string }[] }).video_versions[0].url
                  : undefined
              }
              loop={localAutoplay}
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={togglePlay}
              style={{
                maxWidth: "100%", maxHeight: "100%", outline: "none", cursor: "pointer",
                transform: computeVideoTransform(),
                transition: "transform 0.2s ease",
              }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto" }}>
              <img
                src={"image_versions2" in activeItem ? activeItem.image_versions2.candidates[0].url : undefined}
                alt="Post Preview"
                style={{
                  maxWidth: "100%", maxHeight: "100%",
                  transform: `rotate(${rotation}deg) scale(${zoom})`,
                  transition: "transform 0.2s ease",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
        </div>

        {/* Video Control Bar */}
        {isVideo && videoRef.current && (
          <div
            style={{
              ...controlBarStyle,
              padding: "8px 12px",
              backgroundColor: "rgba(0,0,0,0.85)",
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
            onMouseEnter={() => { setControlsVisible(true); if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); }}
            onMouseLeave={() => resetControlsTimer()}
          >
            {/* Seek Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "white", minWidth: "32px" }}>{formatTime(currentTime)}</span>
              <input
                type="range" min="0" max={duration || 100} step="0.1" value={currentTime}
                onChange={handleSeekChange}
                style={{ flex: 1, cursor: "pointer", accentColor: "var(--primary)" }}
              />
              <span style={{ fontSize: "11px", color: "white", minWidth: "32px", textAlign: "right" }}>{formatTime(duration)}</span>
            </div>

            {/* Control row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {/* Left: play/mute/volume */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button onClick={togglePlay} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "13px", minWidth: "36px" }}>
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <button onClick={toggleMute} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "13px" }}>
                  {isMuted || volume === 0 ? "🔇" : volume < 0.4 ? "🔈" : "🔊"}
                </button>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{ width: "56px", accentColor: "var(--primary)" }}
                />
              </div>

              {/* Right: rotation, speed, autoplay */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  onClick={handleRotateCCW}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px", color: "white", cursor: "pointer", padding: "2px 5px", fontSize: "12px" }}
                  title="Rotate left (CCW)"
                >↺</button>
                {rotation !== 0 && (
                  <button
                    onClick={handleRotateReset}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer", padding: "2px 5px", fontSize: "10px" }}
                    title="Reset rotation"
                  >{rotation}°</button>
                )}
                <button
                  onClick={handleRotateCW}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px", color: "white", cursor: "pointer", padding: "2px 5px", fontSize: "12px" }}
                  title="Rotate right (CW)"
                >↻</button>
                <select
                  value={speed} onChange={handleSpeedChange}
                  style={{ backgroundColor: "transparent", color: "white", border: "1px solid var(--border)", borderRadius: "4px", padding: "2px 4px", fontSize: "11px", cursor: "pointer" }}
                >
                  <option value="0.5" style={{ color: "black" }}>0.5×</option>
                  <option value="1.0" style={{ color: "black" }}>1×</option>
                  <option value="1.5" style={{ color: "black" }}>1.5×</option>
                  <option value="2.0" style={{ color: "black" }}>2×</option>
                </select>
                <button
                  onClick={toggleAutoplay}
                  style={{
                    background: localAutoplay ? "var(--primary)" : "transparent",
                    border: "1px solid var(--border)", borderRadius: "4px",
                    color: "white", cursor: "pointer", padding: "2px 6px", fontSize: "10px",
                  }}
                  title={localAutoplay ? "Autoplay ON — click to disable" : "Autoplay OFF — click to enable"}
                >
                  {localAutoplay ? "Auto ▶" : "Auto ■"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image controls */}
        {!isVideo && (
          <div style={{ padding: "6px 12px", backgroundColor: "rgba(0,0,0,0.8)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center", gap: "8px" }}>
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleZoomOut}>−</button>
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleZoomReset}>{Math.round(zoom * 100)}%</button>
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleZoomIn}>+</button>
            <div style={{ width: "1px", background: "var(--border)", margin: "0 2px" }} />
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleRotateCCW} title="Rotate left">↺</button>
            {rotation !== 0 && (
              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleRotateReset}>{rotation}°</button>
            )}
            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleRotateCW} title="Rotate right">↻</button>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <Button variant="secondary" onClick={handleClose}>Back</Button>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button onClick={() => DownloaderService.downloadItem(media)}>Download</Button>
            {onUnsave && (
              <Button variant="danger" onClick={() => { onUnsave(); handleClose(); }}>Unsave</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
