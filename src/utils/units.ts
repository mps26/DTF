import { Unit, DpiStatus } from '../types';

export const MM_PER_INCH = 25.4;

export function unitToMm(value: number, unit: Unit): number {
  switch (unit) {
    case 'inch':
      return value * MM_PER_INCH;
    case 'cm':
      return value * 10;
    case 'meter':
      return value * 1000;
    case 'mm':
    default:
      return value;
  }
}

export function mmToUnit(mm: number, unit: Unit): number {
  switch (unit) {
    case 'inch':
      return mm / MM_PER_INCH;
    case 'cm':
      return mm / 10;
    case 'meter':
      return mm / 1000;
    case 'mm':
    default:
      return mm;
  }
}

export function formatUnit(value: number, unit: Unit, decimals: number = 2): string {
  const factor = Math.pow(10, decimals);
  return (Math.round(value * factor) / factor).toFixed(decimals);
}

export function calculateEffectiveDpi(pixels: number, physicalMm: number): number {
  if (physicalMm <= 0) return 0;
  const inches = physicalMm / MM_PER_INCH;
  return Math.round(pixels / inches);
}

export function getDpiStatus(dpi: number): DpiStatus {
  if (dpi >= 300) return 'green';
  if (dpi >= 150) return 'amber';
  return 'red';
}

export function getDpiBadgeLabel(dpi: number): string {
  return `${dpi} DPI`;
}

