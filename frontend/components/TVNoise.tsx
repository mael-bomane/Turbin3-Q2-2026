import { useEffect, useRef } from "react";

type TvNoiseProps = {
  width?: number;
  height?: number;
  fps?: number;
  opacity?: number;
  className?: string;
};

export default function TvNoise({
  width = 160,
  height = 90,
  fps = 15,
  opacity = 0.18,
  className,
}: TvNoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const image = ctx.createImageData(width, height);
    const data = image.data;

    const frameMs = 1000 / fps;
    let last = 0;
    let rafId = 0;

    const render = (now: number) => {
      if (now - last >= frameMs) {
        last = now;

        for (let i = 0; i < data.length; i += 4) {
          const v = (Math.random() * 256) | 0;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = 255;
        }

        ctx.putImageData(image, 0, 0);
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [width, height, fps]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        imageRendering: "pixelated",
        pointerEvents: "none",
        opacity,
      }}
    />
  );
}
