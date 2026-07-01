import { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  data: number[];
  color?: string;
  height?: number;
  minBarHeight?: number;
}

export default function WaveformCanvas({
  data,
  color = '#22c55e',
  height = 72,
  minBarHeight = 3,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.offsetWidth;
    canvas.width = displayW * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, displayW, height);

    const barCount = data.length;
    const gap = 3;
    const barWidth = Math.max(2, (displayW - gap * (barCount - 1)) / barCount);

    ctx.fillStyle = color;
    data.forEach((val, i) => {
      const barH = Math.max(minBarHeight, val * height);
      const x = i * (barWidth + gap);
      const y = (height - barH) / 2;
      const radius = Math.min(barWidth / 2, 3);
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, radius);
      ctx.fill();
    });
  }, [data, color, height, minBarHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    />
  );
}
