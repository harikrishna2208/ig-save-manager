import React, { useState, useEffect, useRef } from "react";

interface GridProps<T> {
  items: T[];
  columns: number;
  rowHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  onReachEnd?: () => void;
}

export function Grid<T>({
  items,
  columns,
  rowHeight,
  containerHeight,
  renderItem,
  onReachEnd,
}: GridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate items layout dimensions
  const totalRows = Math.ceil(items.length / columns);
  const totalHeight = totalRows * rowHeight;

  // Visible rows range calculations with buffering
  const visibleRowsCount = Math.ceil(containerHeight / rowHeight);
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const endRow = Math.min(totalRows, startRow + visibleRowsCount + 4);

  const startIndex = startRow * columns;
  const endIndex = Math.min(items.length, endRow * columns);

  const visibleItems = items.slice(startIndex, endIndex);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    // Infinite scroll check: trigger fetching when reaching bottom 10%
    if (onReachEnd) {
      const threshold = target.scrollHeight - target.clientHeight - 80;
      if (target.scrollTop >= threshold) {
        onReachEnd();
      }
    }
  };

  // Reset scroll offset on items load / reset
  useEffect(() => {
    if (scrollTop > totalHeight) {
      setScrollTop(0);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  }, [items.length]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: `${containerHeight}px`,
        overflowY: "auto",
        overflowX: "hidden",
        width: "100%",
        position: "relative",
      }}
    >
      <div style={{ height: `${totalHeight}px`, width: "100%", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: `${startRow * rowHeight}px`,
            left: 0,
            right: 0,
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: "8px",
            padding: "4px",
          }}
        >
          {visibleItems.map((item, index) => renderItem(item, startIndex + index))}
        </div>
      </div>
    </div>
  );
}
