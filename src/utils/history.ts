import { ArtworkAsset, SheetSettings, PackedPlacement } from '../types';

export interface HistoryState {
  assets: ArtworkAsset[];
  settings: SheetSettings;
  manualPlacements?: Record<string, { xMm: number; yMm: number; rotated: boolean }>;
}

export class HistoryManager {
  private past: HistoryState[] = [];
  private future: HistoryState[] = [];
  private maxDepth: number = 30;

  constructor(initialState?: HistoryState) {
    if (initialState) {
      this.past.push(JSON.parse(JSON.stringify(initialState)));
    }
  }

  public pushState(state: HistoryState) {
    this.past.push(JSON.parse(JSON.stringify(state)));
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.future = [];
  }

  public canUndo(): boolean {
    return this.past.length > 1;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public undo(): HistoryState | null {
    if (!this.canUndo()) return null;
    const current = this.past.pop()!;
    this.future.push(current);
    const previous = this.past[this.past.length - 1];
    return JSON.parse(JSON.stringify(previous));
  }

  public redo(): HistoryState | null {
    if (!this.canRedo()) return null;
    const next = this.future.pop()!;
    this.past.push(next);
    return JSON.parse(JSON.stringify(next));
  }
}

