"use client";

import { HTMLProps, useEffect, useRef, useState } from "react";
import { WeiboIcon } from "@/components/icons/weibo";
import { YoutubeIcon } from "@/components/icons/youtube";
import { XiguaIcon } from "@/components/icons/xigua";
import { BilibiliIcon } from "@/components/icons/bilibili";

type VideoProps = {
  bvid?: string;
  ytid?: string;
  wbid?: string;
  xgid?: string;
  iframeClassname?: string;
};

export default function Video({
  bvid,
  ytid,
  wbid,
  xgid,
  iframeClassname,
  ...rest
}: VideoProps & HTMLProps<HTMLDivElement>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPip, setIsPip] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const dragStartInfo = useRef<{
    startX: number;
    startY: number;
    initialPipX: number;
    initialPipY: number;
  } | null>(null);

  const platforms = [
    {
      id: "bvid",
      name: "Bilibili",
      src: (id: string) =>
        `https://player.bilibili.com/player.html?bvid=${id}&high_quality=1&autoplay=false`,
      icon: BilibiliIcon,
      color: "#00A1D6",
    },
    {
      id: "ytid",
      name: "Youtube",
      src: (id: string) => `https://www.youtube.com/embed/${id}?autoplay=0`,
      icon: YoutubeIcon,
      color: "#ff0000",
    },
    {
      id: "wbid",
      name: "Weibo",
      src: (id: string) => `https://weibo.com/tv/show/${id}`,
      icon: WeiboIcon,
      color: "#E6162D",
    },
    {
      id: "xgid",
      name: "Xigua",
      src: (id: string) => `https://www.ixigua.com/iframe/${id}?autoplay=0`,
      icon: XiguaIcon,
      color: "#fe2c55",
    },
  ];

  const availablePlatforms = platforms.filter((p) => {
    if (p.id === "bvid") return !!bvid;
    if (p.id === "ytid") return !!ytid;
    if (p.id === "wbid") return !!wbid;
    if (p.id === "xgid") return !!xgid;
    return false;
  });

  const [activePlatform, setActivePlatform] = useState(availablePlatforms[0]?.id);

  useEffect(() => {
    if (availablePlatforms.length > 0 && !availablePlatforms.find((p) => p.id === activePlatform)) {
      setActivePlatform(availablePlatforms[0].id);
    }
  }, [bvid, ytid, wbid, xgid]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isAboveViewport = entry.boundingClientRect.y < 0;
        setIsPip(!entry.isIntersecting && isAboveViewport);
      },
      {
        threshold: 0,
      },
    );

    observer.observe(container);

    return () => {
      if (container) {
        observer.unobserve(container);
      }
    };
  }, []);

  const prevIsPip = useRef(isPip);
  useEffect(() => {
    if (!prevIsPip.current && isPip) {
      setPipPosition({ x: 0, y: 0 });
    }
    prevIsPip.current = isPip;
  }, [isPip]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");

    const handleMediaQueryChange = (e: MediaQueryListEvent) => {
      setIsNarrowScreen(e.matches);
    };

    setIsNarrowScreen(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleMediaQueryChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
    };
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartInfo.current) return;

      e.preventDefault();

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartInfo.current.startX;
      const deltaY = clientY - dragStartInfo.current.startY;

      let newX = dragStartInfo.current.initialPipX + deltaX;
      let newY = dragStartInfo.current.initialPipY + deltaY;

      const pipWidth = isNarrowScreen ? 240 : 320;
      const pipHeight = isNarrowScreen ? 135 : 180;
      const margin = isNarrowScreen ? 16 : 24;
      const edgePadding = 16;

      const minX = edgePadding - (window.innerWidth - pipWidth - margin);
      const maxX = margin - edgePadding;
      const minY = edgePadding - (window.innerHeight - pipHeight - margin);
      const maxY = margin - edgePadding;

      newX = Math.max(minX, Math.min(newX, maxX));
      newY = Math.max(minY, Math.min(newY, maxY));

      setPipPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, isNarrowScreen]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPip) return;
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartInfo.current = {
      startX: clientX,
      startY: clientY,
      initialPipX: pipPosition.x,
      initialPipY: pipPosition.y,
    };
  };

  const handleClosePip = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsPip(false);
  };

  const currentPlatform = platforms.find((p) => p.id === activePlatform);
  let src = "";
  if (currentPlatform) {
    let id;
    if (currentPlatform.id === "bvid") id = bvid;
    if (currentPlatform.id === "ytid") id = ytid;
    if (currentPlatform.id === "wbid") id = wbid;
    if (currentPlatform.id === "xgid") id = xgid;
    if (id) {
      src = currentPlatform.src(id);
    }
  }

  if (!src) {
    return null;
  }

  const baseStyles: React.CSSProperties = {
    borderRadius: "0.5rem",
    overflow: "hidden",
    backgroundColor: "#000",
  };

  const pipStyles: React.CSSProperties = {
    ...baseStyles,
    position: "fixed",
    bottom: isNarrowScreen ? "16px" : "24px",
    right: isNarrowScreen ? "16px" : "24px",
    width: isNarrowScreen ? "240px" : "320px",
    height: isNarrowScreen ? "135px" : "180px",
    zIndex: 50,
    boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    border: "1px solid rgba(0,0,0,0.1)",
    transform: `translate(${pipPosition.x}px, ${pipPosition.y}px)`,
  };

  const originalStyles: React.CSSProperties = {
    ...baseStyles,
    position: "absolute",
    width: "100%",
    height: "100%",
    left: 0,
    top: 0,
  };

  const showTabs = availablePlatforms.length > 1 && !isPip;

  return (
    <div ref={containerRef} style={{ position: "relative", padding: "30% 45%" }} {...rest}>
      <div style={isPip ? pipStyles : originalStyles}>
        {isPip && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "32px",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "0 8px",
              cursor: isDragging ? "grabbing" : "grab",
              zIndex: 60,
            }}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <button
              onClick={handleClosePip}
              style={{
                background: "rgba(0, 0, 0, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                cursor: "pointer",
                fontSize: "12px",
                padding: 0,
              }}
              title="Close PiP"
            >
              ✕
            </button>
          </div>
        )}
        <iframe
          className={iframeClassname}
          style={{
            width: "100%",
            height: "100%",
            pointerEvents: isDragging ? "none" : "auto",
            border: "none",
          }}
          src={src}
          frameBorder="no"
          scrolling="no"
          allowFullScreen={true}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
      {showTabs && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            zIndex: 10,
            display: "flex",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            borderRadius: "0.5rem",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            overflow: "hidden",
          }}
        >
          {availablePlatforms.map((p, index) => {
            const Icon = p.icon;
            const isActive = activePlatform === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                style={{
                  backgroundColor: isActive ? p.color + "40" : "transparent",
                  border: "none",
                  borderRight:
                    index < availablePlatforms.length - 1
                      ? "1px solid rgba(255, 255, 255, 0.2)"
                      : "none",
                  borderBottom: `3px solid ${isActive ? p.color : "transparent"}`,
                  padding: "6px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  color: "white",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <Icon color={p.color} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
