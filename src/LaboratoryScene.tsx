import { useEffect, useRef } from "react";
import { createLaboratoryRenderer } from "./laboratory-renderer";
import "./laboratory-scene.css";

interface Props {
  className: string;
  variant: "menu" | "core";
  enabled: boolean;
}

export default function LaboratoryScene({ className, variant, enabled }: Props) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const scene = sceneRef.current!;
    const image = imageRef.current!;
    const canvas = canvasRef.current!;
    const scope = scene.parentElement!;
    const resetCamera = () => {
      scene.style.setProperty("--lab-pan-x", "0px");
      scene.style.setProperty("--lab-pan-y", "0px");
      scene.style.setProperty("--lab-pitch", "0deg");
      scene.style.setProperty("--lab-yaw", "0deg");
    };

    scene.dataset.animated = "false";
    resetCamera();
    if (!enabled) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let renderer: ReturnType<typeof createLaboratoryRenderer> = null;
    let frame: number | null = null;
    let visible = true;
    let active = false;
    let disposed = false;
    let failed = false;
    let contextLost = false;
    let previousFrame = 0;
    let elapsed = 0;
    const target = { x: 0, y: 0 };
    const camera = { x: 0, y: 0 };

    const resetPointer = () => {
      target.x = 0;
      target.y = 0;
    };

    const measure = () => {
      if (!renderer) return;
      const style = getComputedStyle(scene);
      const value = (name: string, fallback: number) => {
        const parsed = parseFloat(style.getPropertyValue(name));
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      // 使用场景本身的尺寸；手机中枢下方的节点列表不属于图片裁切区域。
      renderer.resize(
        scene.clientWidth,
        scene.clientHeight,
        Math.min(window.devicePixelRatio || 1, finePointer.matches ? 1.5 : 1),
        {
          x: value("--lab-position-x", 50) / 100,
          y: value("--lab-position-y", 50) / 100,
          offsetX: value("--lab-offset-x", 0),
          offsetY: value("--lab-offset-y", 0),
        },
      );
      renderer.render(elapsed);
    };

    const tick = (now: number) => {
      if (!active || disposed) return;
      const delta = previousFrame ? now - previousFrame : 1000 / 30;
      // 电影氛围层以30帧绘制，避免高刷新率屏幕放大图像处理开销。
      if (delta >= 1000 / 30 - 1) {
        const step = Math.min(delta / 1000, 0.1);
        previousFrame = now;
        elapsed += step;
        const easing = 1 - Math.exp(-step * 6);
        camera.x += (target.x - camera.x) * easing;
        camera.y += (target.y - camera.y) * easing;
        const depth = variant === "menu" ? 1 : 0.6;
        scene.style.setProperty(
          "--lab-pan-x",
          `${(camera.x * 7 * depth).toFixed(3)}px`,
        );
        scene.style.setProperty(
          "--lab-pan-y",
          `${(camera.y * 5 * depth).toFixed(3)}px`,
        );
        scene.style.setProperty(
          "--lab-pitch",
          `${(-camera.y * 0.6 * depth).toFixed(3)}deg`,
        );
        scene.style.setProperty(
          "--lab-yaw",
          `${(camera.x * 0.9 * depth).toFixed(3)}deg`,
        );
        renderer?.render(elapsed);
      }
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      if (disposed) return;
      if (
        !renderer &&
        !failed &&
        !contextLost &&
        !reducedMotion.matches &&
        image.complete &&
        image.naturalWidth
      ) {
        renderer = createLaboratoryRenderer(
          canvas,
          image,
          variant === "menu" ? 1 : 0.65,
        );
        failed = !renderer;
        measure();
      }
      const next =
        !!renderer && !reducedMotion.matches && visible && !document.hidden;
      if (active === next) return;
      active = next;
      scene.dataset.animated = String(active);
      if (active) {
        previousFrame = 0;
        frame = requestAnimationFrame(tick);
      } else {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        resetPointer();
        camera.x = 0;
        camera.y = 0;
        resetCamera();
      }
    };

    const move = (event: PointerEvent) => {
      if (!active || !finePointer.matches || event.pointerType !== "mouse") {
        return;
      }
      const bounds = scene.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        resetPointer();
        return;
      }
      target.x = Math.max(
        -1,
        Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
      );
      target.y = Math.max(
        -1,
        Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
      );
    };
    const pointerPreference = () => {
      resetPointer();
      measure();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      renderer?.dispose();
      renderer = null;
      sync();
    };
    const restored = () => {
      contextLost = false;
      failed = false;
      sync();
    };

    const resize = new ResizeObserver(measure);
    resize.observe(scene);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    intersection.observe(scene);
    image.addEventListener("load", sync);
    scope.addEventListener("pointermove", move, { passive: true });
    scope.addEventListener("pointerleave", resetPointer);
    window.addEventListener("blur", resetPointer);
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    finePointer.addEventListener("change", pointerPreference);
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    sync();

    return () => {
      disposed = true;
      active = false;
      if (frame !== null) cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      image.removeEventListener("load", sync);
      scope.removeEventListener("pointermove", move);
      scope.removeEventListener("pointerleave", resetPointer);
      window.removeEventListener("blur", resetPointer);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
      finePointer.removeEventListener("change", pointerPreference);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      renderer?.dispose();
      scene.dataset.animated = "false";
      resetCamera();
    };
  }, [enabled, variant]);

  return (
    <div
      ref={sceneRef}
      className={`laboratory-scene ${className}`}
      aria-hidden="true"
    >
      <div className="laboratory-camera">
        <img
          ref={imageRef}
          className="laboratory-photo"
          src={`${import.meta.env.BASE_URL}assets/research-core-v3.png`}
          alt=""
          draggable={false}
        />
        <canvas ref={canvasRef} className="laboratory-energy" />
      </div>
      <div className="laboratory-shade" />
    </div>
  );
}
