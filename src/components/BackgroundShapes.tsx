import { useEffect, useRef } from 'react';

type Shape = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  className: string;
};

export function BackgroundShapes() {
  const containerRef = useRef<HTMLDivElement>(null);
  const shapesRef = useRef<Shape[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Get current window dimensions, fallback if 0
    const width = Math.max(window.innerWidth, 400);
    const height = Math.max(window.innerHeight, 600);

    // Randomize initial position within bounds
    const getRandomPos = (radius: number, max: number) => {
      return radius + Math.random() * (max - radius * 2);
    };

    // Randomize speed between 0.4 and 0.8, with random direction
    const getRandomSpeed = () => {
      const speed = 0.4 + Math.random() * 0.4;
      return Math.random() > 0.5 ? speed : -speed;
    };

    shapesRef.current = [
      { id: '1', x: getRandomPos(75, width), y: getRandomPos(75, height), vx: getRandomSpeed(), vy: getRandomSpeed(), radius: 75, className: 'bg-shape shape-1-dynamic' },
      { id: '2', x: getRandomPos(65, width), y: getRandomPos(65, height), vx: getRandomSpeed(), vy: getRandomSpeed(), radius: 65, className: 'bg-shape shape-2-dynamic' },
      { id: '3', x: getRandomPos(60, width), y: getRandomPos(60, height), vx: getRandomSpeed(), vy: getRandomSpeed(), radius: 60, className: 'bg-shape shape-3-dynamic' },
      { id: '4', x: getRandomPos(50, width), y: getRandomPos(50, height), vx: getRandomSpeed(), vy: getRandomSpeed(), radius: 50, className: 'bg-shape shape-4-dynamic' },
      { id: '5', x: getRandomPos(70, width), y: getRandomPos(70, height), vx: getRandomSpeed(), vy: getRandomSpeed(), radius: 70, className: 'bg-shape shape-5-dynamic' },
      { id: '6', x: getRandomPos(55, width), y: getRandomPos(55, height), vx: getRandomSpeed(), vy: getRandomSpeed(), radius: 55, className: 'bg-shape shape-6-dynamic' },
    ];

    const update = () => {
      const container = containerRef.current;
      if (!container) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const shapes = shapesRef.current;

      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        s.x += s.vx;
        s.y += s.vy;

        // Wall bounces
        if (s.x - s.radius <= 0) {
          s.x = s.radius;
          s.vx = Math.abs(s.vx);
        } else if (s.x + s.radius >= w) {
          s.x = w - s.radius;
          s.vx = -Math.abs(s.vx);
        }

        if (s.y - s.radius <= 0) {
          s.y = s.radius;
          s.vy = Math.abs(s.vy);
        } else if (s.y + s.radius >= h) {
          s.y = h - s.radius;
          s.vy = -Math.abs(s.vy);
        }
      }

      // Shape-to-shape collisions
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const s1 = shapes[i];
          const s2 = shapes[j];
          const dx = s2.x - s1.x;
          const dy = s2.y - s1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = s1.radius + s2.radius;

          if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const v1x = s1.vx * cos + s1.vy * sin;
            const v1y = s1.vy * cos - s1.vx * sin;
            const v2x = s2.vx * cos + s2.vy * sin;
            const v2y = s2.vy * cos - s2.vx * sin;

            const vTotal = v1x - v2x;
            const v1xFinal = ((s1.radius - s2.radius) * v1x + 2 * s2.radius * v2x) / (s1.radius + s2.radius);
            const v2xFinal = vTotal + v1xFinal;

            s1.vx = v1xFinal * cos - v1y * sin;
            s1.vy = v1y * cos + v1xFinal * sin;
            s2.vx = v2xFinal * cos - v2y * sin;
            s2.vy = v2y * cos + v2xFinal * sin;
            
            // Separate them so they don't get stuck in each other
            const overlap = (minDistance - distance) / 2 + 0.5;
            s1.x -= overlap * cos;
            s1.y -= overlap * sin;
            s2.x += overlap * cos;
            s2.y += overlap * sin;
          }
        }
      }

      // Update DOM
      const domElements = container.children;
      for (let i = 0; i < shapes.length; i++) {
        if (domElements[i]) {
          const s = shapes[i];
          (domElements[i] as HTMLElement).style.transform = 'translate3d(' + (s.x - s.radius) + 'px, ' + (s.y - s.radius) + 'px, 0)';
        }
      }

      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'hidden', zIndex: -1 }}>
      <div className="bg-shape shape-1-dynamic" aria-hidden="true" />
      <div className="bg-shape shape-2-dynamic" aria-hidden="true" />
      <div className="bg-shape shape-3-dynamic" aria-hidden="true" />
      <div className="bg-shape shape-4-dynamic" aria-hidden="true" />
      <div className="bg-shape shape-5-dynamic" aria-hidden="true" />
      <div className="bg-shape shape-6-dynamic" aria-hidden="true" />
    </div>
  );
}
