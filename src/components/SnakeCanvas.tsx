import { useEffect, useRef, useCallback } from 'react';
import { useMessContext } from '@/context/MessContext';

interface SnakeSegment {
  x: number;
  y: number;
}

interface Snake {
  memberId: string;
  color: string;
  pattern: 'striped' | 'dotted';
  segments: SnakeSegment[];
  targetX: number;
  targetY: number;
  speed: number;
  state: 'idle' | 'hunting' | 'returning';
  idleAngle: number;
  idleSpeed: number;
  baseLength: number;
  targetEggIndex?: number;
}

const CANVAS_W = 1200;
const CANVAS_H = 2400;
const TRAY_CX = CANVAS_W / 2;
const TRAY_CY = CANVAS_H / 2;
const SEG_SPACING = 14;
const BASE_SEGMENTS = 20;
const SEGMENTS_PER_EGG = 5;

// Must match EggTray layout: p-3 (12px), cells 34x34, gap-1.5 (6px)
const TRAY_PADDING = 12;
const CELL_SIZE = 34;
const CELL_GAP = 6;
const CELL_STEP = CELL_SIZE + CELL_GAP; // 40
const CELL_CENTER_OFFSET = CELL_SIZE / 2; // 17
const FIRST_CELL_OFFSET = TRAY_PADDING + CELL_CENTER_OFFSET; // 29

interface SnakeCanvasProps {
  trayContainerRef: React.RefObject<HTMLDivElement | null>;
}

const SnakeCanvas = ({ trayContainerRef }: SnakeCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakesRef = useRef<Snake[]>([]);
  const animRef = useRef<number>(0);
  const { members, lastEatEvent, confirmEgg } = useMessContext();
  const prevEventRef = useRef<number | null>(null);

  // Initialize / sync snakes with members
  useEffect(() => {
    const existing = snakesRef.current;
    const newSnakes: Snake[] = members.map((m, i) => {
      const prev = existing.find(s => s.memberId === m.id);
      const angle = (i / members.length) * Math.PI * 2;
      const spawnR = 160;
      const sx = TRAY_CX + Math.cos(angle) * spawnR;
      const sy = TRAY_CY + Math.sin(angle) * spawnR;
      const segCount = BASE_SEGMENTS + m.eggsEaten * SEGMENTS_PER_EGG;

      if (prev) {
        // Update color/pattern, adjust segment count
        while (prev.segments.length < segCount) {
          const last = prev.segments[prev.segments.length - 1];
          prev.segments.push({ x: last.x, y: last.y });
        }
        prev.segments = prev.segments.slice(0, segCount);
        prev.color = m.color;
        prev.pattern = m.pattern;
        prev.baseLength = segCount;
        return prev;
      }

      const segments: SnakeSegment[] = Array.from({ length: segCount }, (_, j) => ({
        x: sx - j * 2,
        y: sy,
      }));

      return {
        memberId: m.id,
        color: m.color,
        pattern: m.pattern,
        segments,
        targetX: sx,
        targetY: sy,
        speed: 3.5 + Math.random() * 2,
        state: 'idle' as const,
        idleAngle: Math.random() * Math.PI * 2,
        idleSpeed: 0.015 + Math.random() * 0.02,
        baseLength: segCount,
      };
    });
    snakesRef.current = newSnakes;
  }, [members]);

  // Handle eat events - send snake to tray (use actual DOM positions for accurate targeting)
  useEffect(() => {
    if (!lastEatEvent || lastEatEvent.timestamp === prevEventRef.current) return;
    prevEventRef.current = lastEatEvent.timestamp;

    const snake = snakesRef.current.find(s => s.memberId === lastEatEvent.memberId);
    if (!snake) return;

    const row = Math.floor(lastEatEvent.eggIndex / 5);
    const col = lastEatEvent.eggIndex % 5;

    const applyTarget = (eggX: number, eggY: number) => {
      snake.targetX = eggX;
      snake.targetY = eggY;
      snake.state = 'hunting';
      snake.speed = 18;
      snake.targetEggIndex = lastEatEvent.eggIndex;
    };

    const computeFromDOM = () => {
      const canvas = canvasRef.current;
      const trayEl = trayContainerRef.current;
      if (!canvas || !trayEl) return false;

      // Egg center in tray-container coords (matches EggTray: p-3, 34px cells, gap-1.5)
      const eggLocalX = FIRST_CELL_OFFSET + col * CELL_STEP;
      const eggLocalY = FIRST_CELL_OFFSET + row * CELL_STEP;

      const trayRect = trayEl.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      // Viewport position of egg center
      const viewportX = trayRect.left + eggLocalX;
      const viewportY = trayRect.top + eggLocalY;

      // Convert to canvas pixel coordinates (canvas may be scaled/stretched)
      const scaleX = CANVAS_W / canvasRect.width;
      const scaleY = CANVAS_H / canvasRect.height;
      const eggX = (viewportX - canvasRect.left) * scaleX;
      const eggY = (viewportY - canvasRect.top) * scaleY;

      applyTarget(eggX, eggY);
      return true;
    };

    // Defer to next frame so DOM has finished layout
    const rafId = requestAnimationFrame(() => {
      if (!computeFromDOM()) {
        // Fallback if refs not ready yet (e.g. initial hydration)
        const fallbackTrayW = 200;
        const fallbackTrayH = 240;
        applyTarget(
          TRAY_CX - fallbackTrayW / 2 + FIRST_CELL_OFFSET + col * CELL_STEP,
          TRAY_CY - fallbackTrayH / 2 + FIRST_CELL_OFFSET + row * CELL_STEP
        );
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [lastEatEvent]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    for (const snake of snakesRef.current) {
      const head = snake.segments[0];
      if (!head) continue;

      // Movement logic
      const dx = snake.targetX - head.x;
      const dy = snake.targetY - head.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (snake.state === 'idle') {
        // Smooth wandering over larger full-screen area
        snake.idleAngle += snake.idleSpeed;
        const memberIdx = snakesRef.current.indexOf(snake);
        
        const orbitR = 300 + Math.sin(snake.idleAngle * 0.3) * 250;
        const wanderR = 150 + Math.sin(snake.idleAngle * 0.7) * 100;
        
        // Dynamic base angle to drift around the whole screen
        const baseAngle = (memberIdx / snakesRef.current.length) * Math.PI * 2 + snake.idleAngle * 0.15;
        
        snake.targetX = TRAY_CX + Math.cos(baseAngle) * orbitR + Math.cos(snake.idleAngle * 1.1) * wanderR;
        snake.targetY = TRAY_CY + Math.sin(baseAngle) * orbitR * 1.3 + Math.sin(snake.idleAngle * 1.4) * wanderR;
        snake.speed = 3.5;
      }

      if (snake.state === 'hunting' && dist < 15) {
        if (snake.targetEggIndex !== undefined) {
          confirmEgg(snake.targetEggIndex);
          snake.targetEggIndex = undefined;
        }

        // Reached egg, return to screen perimeter
        const memberIdx = snakesRef.current.indexOf(snake);
        const baseAngle = (memberIdx / snakesRef.current.length) * Math.PI * 2;
        snake.targetX = TRAY_CX + Math.cos(baseAngle) * 500;
        snake.targetY = TRAY_CY + Math.sin(baseAngle) * 600;
        snake.state = 'returning';
        snake.speed = 6;
      }

      if (snake.state === 'returning' && dist < 30) {
        snake.state = 'idle';
        snake.speed = 3.5;
      }

      // Move head toward target
      if (dist > 1) {
        head.x += (dx / dist) * snake.speed;
        head.y += (dy / dist) * snake.speed;
      }

      // Follow segments
      for (let i = 1; i < snake.segments.length; i++) {
        const prev = snake.segments[i - 1];
        const seg = snake.segments[i];
        const sdx = prev.x - seg.x;
        const sdy = prev.y - seg.y;
        const sd = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sd > SEG_SPACING) {
          seg.x += (sdx / sd) * (sd - SEG_SPACING);
          seg.y += (sdy / sd) * (sd - SEG_SPACING);
        }
      }

      // Draw snake
      const segCount = snake.segments.length;
      
      // Body
      for (let i = segCount - 1; i >= 1; i--) {
        const seg = snake.segments[i];
        const t = 1 - i / segCount;
        const radius = 6 + t * 9;
        
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
        
        if (snake.pattern === 'dotted' && i % 3 === 0) {
          ctx.fillStyle = lightenColor(snake.color, 40);
        } else if (snake.pattern === 'striped' && i % 4 < 2) {
          ctx.fillStyle = lightenColor(snake.color, 25);
        } else {
          ctx.fillStyle = snake.color;
        }
        ctx.fill();
      }

      // Head
      ctx.beginPath();
      ctx.arc(head.x, head.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = snake.color;
      ctx.fill();

      // Eyes
      const nextSeg = snake.segments[1] || head;
      const eyeAngle = Math.atan2(head.y - nextSeg.y, head.x - nextSeg.x);
      const eyeOffX = Math.cos(eyeAngle);
      const eyeOffY = Math.sin(eyeAngle);
      const perpX = -eyeOffY;
      const perpY = eyeOffX;

      for (const side of [-1, 1]) {
        const ex = head.x + eyeOffX * 5 + perpX * side * 8;
        const ey = head.y + eyeOffY * 5 + perpY * side * 8;
        ctx.beginPath();
        ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + eyeOffX * 1.5, ey + eyeOffY * 1.5, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
      }

      // Tongue (when hunting)
      if (snake.state === 'hunting') {
        const tongueLen = 12 + Math.sin(Date.now() * 0.02) * 5;
        ctx.beginPath();
        ctx.moveTo(head.x + eyeOffX * 16, head.y + eyeOffY * 16);
        const tx = head.x + eyeOffX * (16 + tongueLen);
        const ty = head.y + eyeOffY * (16 + tongueLen);
        ctx.lineTo(tx, ty);
        // Fork
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + perpX * 4 + eyeOffX * 4, ty + perpY * 4 + eyeOffY * 4);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - perpX * 4 + eyeOffX * 4, ty - perpY * 4 + eyeOffY * 4);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{ imageRendering: 'auto' }}
    />
  );
};

function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
}

export default SnakeCanvas;
