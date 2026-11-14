import React, { useRef, useEffect } from 'react';
import { Unit } from '../types';
import { MM_PER_INCH } from '../utils/units';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number; // in pixels
  scale: number; // pixels per physical mm
  unit: Unit;
  offset?: number; // pan offset in pixels
}

export const Ruler: React.FC<RulerProps> = ({
  orientation,
  length,
  scale,
  unit,
  offset = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const thickness = 20;

    if (orientation === 'horizontal') {
      canvas.width = length;
      canvas.height = thickness;
    } else {
      canvas.width = thickness;
      canvas.height = length;
    }

    // Industrial ruler background
    ctx.fillStyle = '#1e2230';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#475569';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Step calculations based on unit
    // scale is pixels per mm
    let stepPhysical = 10; // default 10mm
    let majorStep = 50; // major tick every 50mm

    if (unit === 'inch') {
      stepPhysical = MM_PER_INCH / 4; // quarter inch
      majorStep = MM_PER_INCH; // 1 inch
    } else if (unit === 'cm') {
      stepPhysical = 10;
      majorStep = 50;
    }

    const stepPx = stepPhysical * scale;
    const majorStepPx = majorStep * scale;

    if (stepPx < 4) return; // avoid overdrawing if too small

    if (orientation === 'horizontal') {
      // Bottom border line
      ctx.beginPath();
      ctx.moveTo(0, thickness - 0.5);
      ctx.lineTo(length, thickness - 0.5);
      ctx.stroke();

      const startMm = -offset / scale;
      const count = Math.ceil(length / stepPx) + 2;

      for (let i = 0; i <= count; i++) {
        const x = i * stepPx + (offset % stepPx);
        if (x < 0 || x > length) continue;

        const physicalPos = (x - offset) / scale;
        const isMajor = Math.abs(physicalPos % majorStep) < (stepPhysical / 2);

        ctx.beginPath();
        if (isMajor) {
          ctx.moveTo(x + 0.5, 6);
          ctx.lineTo(x + 0.5, thickness);
          ctx.stroke();

          // Label
          let label = '';
          if (unit === 'inch') {
            label = `${Math.round(physicalPos / MM_PER_INCH)}"`;
          } else if (unit === 'cm') {
            label = `${Math.round(physicalPos / 10)}`;
          } else {
            label = `${Math.round(physicalPos)}`;
          }
          ctx.fillText(label, x + 2, 2);
        } else {
          ctx.moveTo(x + 0.5, 13);
          ctx.lineTo(x + 0.5, thickness);
          ctx.stroke();
        }
      }
    } else {
      // Right border line
      ctx.beginPath();
      ctx.moveTo(thickness - 0.5, 0);
      ctx.lineTo(thickness - 0.5, length);
      ctx.stroke();

      const count = Math.ceil(length / stepPx) + 2;

      for (let i = 0; i <= count; i++) {
        const y = i * stepPx + (offset % stepPx);
        if (y < 0 || y > length) continue;

        const physicalPos = (y - offset) / scale;
        const isMajor = Math.abs(physicalPos % majorStep) < (stepPhysical / 2);

        ctx.beginPath();
        if (isMajor) {
          ctx.moveTo(6, y + 0.5);
          ctx.lineTo(thickness, y + 0.5);
          ctx.stroke();

          // Label
          let label = '';
          if (unit === 'inch') {
            label = `${Math.round(physicalPos / MM_PER_INCH)}"`;
          } else {
            label = `${Math.round(physicalPos)}`;
          }
          ctx.save();
          ctx.translate(2, y + 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.moveTo(13, y + 0.5);
          ctx.lineTo(thickness, y + 0.5);
          ctx.stroke();
        }
      }
    }
  }, [orientation, length, scale, unit, offset]);

  return <canvas ref={canvasRef} className="block select-none pointer-events-none" />;
};

