import { useEffect, useRef, useState } from "react";

type LazyVideoProps = {
  src: string;
  poster?: string;
  className?: string;
  ariaLabel: string;
};

export default function LazyVideo({ src, poster, className, ariaLabel }: LazyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!("IntersectionObserver" in window)) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isNearViewport) {
      videoRef.current?.load();
    }
  }, [isNearViewport]);

  return (
    <video
      ref={videoRef}
      className={className}
      controls
      preload={isNearViewport ? "metadata" : "none"}
      poster={poster}
      playsInline
      aria-label={ariaLabel}
    >
      {isNearViewport && <source src={src} type="video/mp4" />}
      Ваш браузер не поддерживает воспроизведение видео.
    </video>
  );
}