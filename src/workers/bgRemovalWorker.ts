/// <reference lib="webworker" />
/**
 * Runs the AI background-removal model off the UI thread.
 * Input: an image URL (data: URL). Output: the subject matte (0–255, one byte per
 * pixel, original resolution).
 *
 *  - Graphics card able to run it (WebGPU, >16 storage buffers per shader):
 *    BiRefNet-lite (MIT) — highest quality, any object.
 *  - Otherwise, or if a GPU run fails: ORMBG (Apache-2.0, ISNet architecture),
 *    8-bit quantised (~44 MB) on the CPU. BiRefNet-lite cannot run on the CPU in
 *    a browser: its 1024×1024 Swin backbone exceeds WebAssembly's memory limit.
 */
import { pipeline, env } from '@huggingface/transformers';

const GPU_MODEL = 'onnx-community/BiRefNet_lite-ONNX';
const CPU_MODEL = 'onnx-community/ormbg-ONNX';
const MIN_STORAGE_BUFFERS = 17; // BiRefNet's WebGPU shaders need > 16 per stage

type Device = 'webgpu' | 'wasm';
type Segmenter = (input: string) => Promise<{ data: Uint8ClampedArray | Uint8Array; width: number; height: number; channels: number }>;

export type WorkerRequest = { id: number; url: string };
export type WorkerResponse =
  | { id: number; type: 'progress'; stage: 'loading'; percent: number | null; totalMb?: number }
  | { id: number; type: 'progress'; stage: 'processing' }
  | { id: number; type: 'done'; matte: Uint8Array; width: number; height: number; device: Device }
  | { id: number; type: 'error'; phase: 'load' | 'run'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
env.allowLocalModels = false;
env.useBrowserCache = true;

let current: { promise: Promise<Segmenter>; device: Device } | null = null;
let forceCpu = false;
let activeId = 0;

async function pickDevice(): Promise<{ device: Device; dtype: 'fp16' | 'fp32' | 'q8'; model: string }> {
  if (!forceCpu) {
    try {
      const gpu = (self.navigator as unknown as {
        gpu?: { requestAdapter: () => Promise<{ features: Set<string>; limits: Record<string, number> } | null> };
      }).gpu;
      const adapter = gpu ? await gpu.requestAdapter() : null;
      if (adapter && (adapter.limits?.maxStorageBuffersPerShaderStage ?? 0) >= MIN_STORAGE_BUFFERS) {
        return { device: 'webgpu', dtype: adapter.features.has('shader-f16') ? 'fp16' : 'fp32', model: GPU_MODEL };
      }
    } catch {
      // CPU
    }
  }
  return { device: 'wasm', dtype: 'q8', model: CPU_MODEL };
}

function progress_callback(info: { status: string; progress?: number; total?: number }) {
  if (info.status === 'progress_total') {
    ctx.postMessage({
      id: activeId,
      type: 'progress',
      stage: 'loading',
      percent: typeof info.progress === 'number' ? Math.round(info.progress) : null,
      totalMb: info.total ? Math.round(info.total / 1e6) : undefined
    } satisfies WorkerResponse);
  }
}

async function getSegmenter(): Promise<{ seg: Segmenter; device: Device }> {
  if (!current) {
    const { device, dtype, model } = await pickDevice();
    const promise = (pipeline('background-removal', model, { device, dtype, progress_callback } as never) as unknown as Promise<Segmenter>)
      .catch(async (err) => {
        if (device === 'webgpu') {
          // GPU could not even load the model: use the CPU instead.
          forceCpu = true;
          current = null;
          const r = await getSegmenter();
          return r.seg;
        }
        current = null;
        throw err;
      });
    current = { promise, device };
  }
  const seg = await current.promise;
  return { seg, device: forceCpu ? 'wasm' : current?.device ?? 'wasm' };
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, url } = e.data;
  activeId = id;
  let segInfo: { seg: Segmenter; device: Device };
  try {
    segInfo = await getSegmenter();
  } catch (err) {
    ctx.postMessage({ id, type: 'error', phase: 'load', message: String(err) } satisfies WorkerResponse);
    return;
  }
  ctx.postMessage({ id, type: 'progress', stage: 'processing' } satisfies WorkerResponse);
  let result: Awaited<ReturnType<Segmenter>>;
  try {
    result = await segInfo.seg(url);
  } catch (err) {
    if (segInfo.device !== 'webgpu') {
      ctx.postMessage({ id, type: 'error', phase: 'run', message: String(err) } satisfies WorkerResponse);
      return;
    }
    // This graphics driver cannot run the model: retry once on the CPU.
    forceCpu = true;
    current = null;
    try {
      segInfo = await getSegmenter();
      ctx.postMessage({ id, type: 'progress', stage: 'processing' } satisfies WorkerResponse);
      result = await segInfo.seg(url);
    } catch (err2) {
      ctx.postMessage({ id, type: 'error', phase: 'run', message: String(err2) } satisfies WorkerResponse);
      return;
    }
  }
  const { width, height, data, channels } = result;
  const matte = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) matte[i] = channels === 4 ? data[i * 4 + 3] : data[i];
  ctx.postMessage({ id, type: 'done', matte, width, height, device: segInfo.device } satisfies WorkerResponse, [matte.buffer]);
};
