import { PrintType, SheetSettings } from '../types';
import { UserProfile } from '../types/auth';

export interface RollPreset {
  id: string;
  printType: PrintType;
  label: string;
  shortLabel: string;
  widthIn: number;
  minLengthIn: number;
  maxLengthIn: number;
  defaultLengthIn: number;
  isFixedLength: boolean;
  isLocked: boolean;
  description: string;
}

export const DTF_PRESETS: RollPreset[] = [
  {
    id: 'dtf-22x100',
    printType: 'dtf',
    label: '22" × 100"',
    shortLabel: '22 × 100',
    widthIn: 22,
    minLengthIn: 1,
    maxLengthIn: 100,
    defaultLengthIn: 24,
    isFixedLength: false,
    isLocked: false,
    description: 'Standard DTF roll, 22" wide'
  },
  {
    id: 'dtf-22.5x100',
    printType: 'dtf',
    label: '22.5" × 100"',
    shortLabel: '22.5 × 100',
    widthIn: 22.5,
    minLengthIn: 1,
    maxLengthIn: 100,
    defaultLengthIn: 24,
    isFixedLength: false,
    isLocked: true,
    description: 'Pro DTF roll, 22.5" wide (Authorized Email Only)'
  }
];

export const UVDTF_PRESETS: RollPreset[] = [
  {
    id: 'uvdtf-a4',
    printType: 'uvdtf',
    label: 'A4 — 11" × 8"',
    shortLabel: 'A4 (11 × 8)',
    widthIn: 11,
    minLengthIn: 8,
    maxLengthIn: 8,
    defaultLengthIn: 8,
    isFixedLength: true,
    isLocked: false,
    description: 'A4 UVDTF sheet (11" × 8")'
  },
  {
    id: 'uvdtf-a3',
    printType: 'uvdtf',
    label: 'A3 — 11" × 17"',
    shortLabel: 'A3 (11 × 17)',
    widthIn: 11,
    minLengthIn: 17,
    maxLengthIn: 17,
    defaultLengthIn: 17,
    isFixedLength: true,
    isLocked: false,
    description: 'A3 UVDTF sheet (11" × 17")'
  },
  {
    id: 'uvdtf-meter',
    printType: 'uvdtf',
    label: 'Meter — 22" × 39"',
    shortLabel: 'Meter (22 × 39)',
    widthIn: 22,
    minLengthIn: 39,
    maxLengthIn: 39,
    defaultLengthIn: 39,
    isFixedLength: true,
    isLocked: false,
    description: '1 Meter UVDTF sheet (22" × 39")'
  },
  {
    id: 'uvdtf-23x100',
    printType: 'uvdtf',
    label: '23" × 100"',
    shortLabel: '23 × 100',
    widthIn: 23,
    minLengthIn: 1,
    maxLengthIn: 100,
    defaultLengthIn: 24,
    isFixedLength: false,
    isLocked: true,
    description: 'Team UVDTF roll, 23" wide (Authorized Email Only)'
  }
];

export const ALL_ROLL_PRESETS: RollPreset[] = [...DTF_PRESETS, ...UVDTF_PRESETS];

const STORAGE_KEY_AUTHORIZED_EMAILS = 'dtf_authorized_pro_roll_emails';

export const DEFAULT_AUTHORIZED_EMAILS: string[] = [
  'ninad@dtflayout.com',
  'admin@dtflayout.com',
  'team@dtflayout.com'
];

export function getAuthorizedRollEmails(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTHORIZED_EMAILS);
    if (!raw) {
      return DEFAULT_AUTHORIZED_EMAILS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
    }
  } catch {
    // ignore storage parse errors
  }
  return DEFAULT_AUTHORIZED_EMAILS;
}

export function setAuthorizedRollEmails(emails: string[]): void {
  const normalized = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  );
  localStorage.setItem(STORAGE_KEY_AUTHORIZED_EMAILS, JSON.stringify(normalized));
}

export function hasLockedRollAccess(user: UserProfile | null | undefined): boolean {
  if (!user || !user.email) return false;
  const email = user.email.trim().toLowerCase();
  const allowed = getAuthorizedRollEmails();
  return allowed.includes(email);
}

export function getPresetsForPrintType(printType: PrintType): RollPreset[] {
  return printType === 'uvdtf' ? UVDTF_PRESETS : DTF_PRESETS;
}

export function findPresetById(presetId: string): RollPreset | undefined {
  return ALL_ROLL_PRESETS.find((p) => p.id === presetId);
}

export function getSettingsUpdatesForPreset(preset: RollPreset): Partial<SheetSettings> {
  return {
    printType: preset.printType,
    filmWidthPreset: preset.id,
    filmWidth: preset.widthIn,
    filmWidthMm: preset.widthIn * 25.4,
    lengthMode: preset.isFixedLength ? 'fixed' : 'auto',
    fixedLength: preset.defaultLengthIn,
    fixedLengthMm: preset.defaultLengthIn * 25.4
  };
}

