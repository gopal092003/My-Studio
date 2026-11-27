"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number; vx: number; vy: number };

export function BackgroundNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let points: Point[] = [];
    let width = 0;
    let height = 0;
    let frameId = 0;

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const count = width < 640 ? 65 : width < 1024 ? 100 : 145;
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const point of points) {
        if (!motionPreference.matches) {
          point.x += point.vx;
          point.y += point.vy;
          if (point.x < 0 || point.x > width) point.vx *= -1;
          if (point.y < 0 || point.y > height) point.vy *= -1;
        }
      }

      const maxDistance = width < 640 ? 90 : 135;
      const maxDistanceSquared = maxDistance * maxDistance;
      context.beginPath();
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        for (let j = i + 1; j < points.length; j += 1) {
          const other = points[j];
          const dx = point.x - other.x;
          const dy = point.y - other.y;
          if (dx * dx + dy * dy < maxDistanceSquared) {
            context.moveTo(point.x, point.y);
            context.lineTo(other.x, other.y);
          }
        }
      }

      const theme = getComputedStyle(document.documentElement);
      context.strokeStyle = theme.getPropertyValue("--network-line").trim() || "rgba(244, 82, 42, 0.08)";
      context.lineWidth = 1;
      context.stroke();

      for (const point of points) {
        context.beginPath();
        context.arc(point.x, point.y, 1.6, 0, Math.PI * 2);
        context.fillStyle = theme.getPropertyValue("--network-node").trim() || "rgba(244, 82, 42, 0.38)";
        context.fill();
      }

      if (!motionPreference.matches) frameId = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || motionPreference.matches) return;
      const offsetX = (event.clientX / width - 0.5) * 5;
      const offsetY = (event.clientY / height - 0.5) * 5;
      canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    };
    const onResize = () => {
      window.cancelAnimationFrame(frameId);
      resize();
      draw();
    };
    const onMotionPreferenceChange = () => {
      window.cancelAnimationFrame(frameId);
      draw();
    };
    const onThemeChange = () => {
      window.cancelAnimationFrame(frameId);
      draw();
    };
    const themeObserver = new MutationObserver(onThemeChange);

    resize();
    draw();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    motionPreference.addEventListener("change", onMotionPreferenceChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      motionPreference.removeEventListener("change", onMotionPreferenceChange);
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="network-background" />;
}
