/**
 * 3D HD texture library: built-in textures plus textures uploaded by administrators,
 * stored in this browser's IndexedDB (shared by every user signed in on this device).
 */
import type { HdTexture } from './types';
import type { UserProfile } from '../types/auth';
import { builtInTextures } from './builtinTextures';
import { hasLockedRollAccess } from '../utils/sheetPresets';
import { newId } from './hdImage';

const DB_NAME = 'hd3d-textures';
const STORE = 'textures';
const TILE = 512;

/** Administrators manage the library: admin / shop-owner accounts and authorized emails. */
export function canManageTextures(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'shop_owner' || hasLockedRollAccess(user);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function uploadedTextures(): Promise<HdTexture[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as HdTexture[]).map((t) => ({ ...t, tile: new Uint8Array(t.tile) })));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function loadTextureLibrary(): Promise<HdTexture[]> {
  return [...builtInTextures(), ...(await uploadedTextures())];
}

/**
 * Converts an uploaded image into a square, tiling height map (luminance; light = raised).
 * The image is centre-cropped to a square and resampled to 512 × 512.
 */
export async function textureFromImage(file: File): Promise<{ tile: Uint8Array; size: number }> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, TILE, TILE);
  bmp.close();
  const d = ctx.getImageData(0, 0, TILE, TILE).data;
  const tile = new Uint8Array(TILE * TILE);
  for (let i = 0; i < tile.length; i++) {
    const a = d[i * 4 + 3] / 255;
    tile[i] = Math.round((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a);
  }
  return { tile, size: TILE };
}

export async function addUploadedTexture(file: File, name: string, category: string, user: UserProfile): Promise<HdTexture> {
  if (!canManageTextures(user)) throw new Error('Only administrators can add textures.');
  const { tile, size } = await textureFromImage(file);
  const tex: HdTexture = { id: newId('tex'), name: name.trim() || file.name.replace(/\.[^.]+$/, ''), category: category.trim() || 'Custom', size, tile, builtIn: false, createdBy: user.email };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(tex);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return tex;
}

export async function deleteUploadedTexture(id: string, user: UserProfile): Promise<void> {
  if (!canManageTextures(user)) throw new Error('Only administrators can delete textures.');
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Small shaded preview of a texture height map (for the library grid). */
export function textureThumbnail(tex: HdTexture, px = 96): string {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(px, px);
  const s = tex.size;
  const at = (x: number, y: number) => tex.tile[(((y % s) + s) % s) * s + (((x % s) + s) % s)];
  const k = s / px;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const sx = Math.floor(x * k), sy = Math.floor(y * k);
      const h = at(sx, sy);
      const shade = (at(sx - 2, sy - 2) - at(sx + 2, sy + 2)) * 0.9; // light from top-left
      const v = Math.max(0, Math.min(255, 90 + h * 0.45 + shade));
      const o = (y * px + x) * 4;
      img.data[o] = v; img.data[o + 1] = v * 0.97; img.data[o + 2] = v * 0.92; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
