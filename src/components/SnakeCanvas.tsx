import { useEffect, useRef, useCallback, useState } from 'react';
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
}

const SEG_SPACING = 6;
const BASE_SEGMENTS = 8;
const SEGMENTS_PER_EGG = 3;

const SnakeCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakesRef = useRef<Snake[]>([]);
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: window.innerWidth, h: window.innerHeight });
  const { members, lastEatEvent } = useMessContext();
  const prevEventRef = useRef<number | null>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Resize handler
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h };
      setSize({ w, h });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const cx = () => sizeRef.current.w / 2;
  const cy = () => sizeRef.current.h / 2;

  // Initialize / sync snakes with members
  useEffect(() => {
    const existing = snakesRef.current;
    const newSnakes: Snake[] = members.map((m, i) => {
      const prev = existing.find(s => s.memberId === m.id);
      const angle = (i / members.length) * Math.PI * 2;
      const spawnR = Math.min(sizeRef.current.w, sizeRef.current.h) * 0.35;
      const sx = cx() + Math.cos(angle) * spawnR;
      const sy = cy() + Math.sin(angle) * spawnR;
      const segCount = BASE_SEGMENTS + m.eggsEaten * SEGMENTS_PER_EGG;

      if (prev) {
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
        speed: 2 + Math.random(),
        state: 'idle' as const,
        idleAngle: Math.random() * Math.PI * 2,
        idleSpeed: 0.01 + Math.random() * 0.015,
        baseLength: segCount,
      };
    });
    snakesRef.current = newSnakes;
  }, [members]);

  // Handle eat events
  useEffect(() => {
    if (!lastEatEvent || lastEatEvent.timestamp === prevEventRef.current) return;
    prevEventRef.current = lastEatEvent.timestamp;

    const snake = snakesRef.current.find(s => s.memberId === lastEatEvent.memberId);
    if (!snake) return;

    const row = Math.floor(lastEatEvent.eggIndex / 5);
    const col = lastEatEvent.eggIndex % 5;
    const trayW = 260;
    const trayH = 300;
    const eggX = cx() - trayW / 2 + 20 + col * (trayW / 5);
    const eggY = cy() - trayH / 2 + 20 + row * (trayH / 6);

    snake.targetX = eggX;
    snake.targetY = eggY;
    snake.state = 'hunting';
    snake.speed = 5;
  }, [lastEatEvent]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = sizeRef.current.w;
    const H = sizeRef.current.h;
    const CX = W / 2;
    const CY = H / 2;

    ctx.clearRect(0, 0, W, H);

    for (const snake of snakesRef.current) {
      const head = snake.segments[0];
      if (!head) continue;

      const dx = snake.targetX - head.x;
      const dy = snake.targetY - head.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (snake.state === 'idle') {
        snake.idleAngle += snake.idleSpeed;
        const memberIdx = snakesRef.current.indexOf(snake);
        const baseAngle = (memberIdx / snakesRef.current.length) * Math.PI * 2;
        const wanderR = 60 + Math.sin(snake.idleAngle * 0.7) * 40;
        const orbitR = Math.min(W, H) * 0.3;
        snake.targetX = CX + Math.cos(baseAngle + snake.idleAngle * 0.3) * orbitR + Math.cos(snake.idleAngle) * wanderR;
        snake.targetY = CY + Math.sin(baseAngle + snake.idleAngle * 0.3) * orbitR + Math.sin(snake.idleAngle * 1.3) * wanderR * 0.6;
        snake.speed = 1.5;
      }

      if (snake.state === 'hunting' && dist < 8) {
        const memberIdx = snakesRef.current.indexOf(snake);
        const baseAngle = (memberIdx / snakesRef.current.length) * Math.PI * 2;
        const orbitR = Math.min(W, H) * 0.3;
        snake.targetX = CX + Math.cos(baseAngle) * orbitR;
        snake.targetY = CY + Math.sin(baseAngle) * orbitR;
        snake.state = 'returning';
        snake.speed = 3;
      }

      if (snake.state === 'returning' && dist < 15) {
        snake.state = 'idle';
        snake.speed = 1.5;
      }

      if (dist > 1) {
        head.x += (dx / dist) * snake.speed;
        head.y += (dy / dist) * snake.speed;
      }

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

      // Draw body
      const segCount = snake.segments.length;
      for (let i = segCount - 1; i >= 1; i--) {
        const seg = snake.segments[i];
        const t = 1 - i / segCount;
        const radius = 2.5 + t * 4;
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
      ctx.arc(head.x, head.y, 7, 0, Math.PI * 2);
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
        const ex = head.x + eyeOffX * 2 + perpX * side * 3.5;
        const ey = head.y + eyeOffY * 2 + perpY * side * 3.5;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + eyeOffX * 0.8, ey + eyeOffY * 0.8, 1, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
      }

      // Tongue (when hunting)
      if (snake.state === 'hunting') {
        const tongueLen = 8 + Math.sin(Date.now() * 0.02) * 3;
        ctx.beginPath();
        ctx.moveTo(head.x + eyeOffX * 7, head.y + eyeOffY * 7);
        const tx = head.x + eyeOffX * (7 + tongueLen);
        const ty = head.y + eyeOffY * (7 + tongueLen);
        ctx.lineTo(tx, ty);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + perpX * 3 + eyeOffX * 3, ty + perpY * 3 + eyeOffY * 3);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - perpX * 3 + eyeOffX * 3, ty - perpY * 3 + eyeOffY * 3);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 1.2;
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
      width={size.w}
      height={size.h}
      className="w-full h-full pointer-events-none"
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
