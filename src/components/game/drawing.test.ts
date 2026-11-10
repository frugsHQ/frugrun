import { describe, it, expect, vi } from 'vitest';
import { decodeGameImages, makeCompositedLayers, loadGameImages } from './drawing';

describe('Scene asset failures', () => {
  it('awaits every asset, retries once, and names failed assets without blocking readiness', async () => {
    const images = loadGameImages();
    const assets = [images.bg, images.ground, images.spikes, images.totem, images.coin, ...images.run, images.jump, images.fall];
    const unique = [...new Set(assets)];
    const decoders = unique.map(image => {
      const decode = vi.fn().mockRejectedValue(new Error('offline'));
      Object.defineProperty(image, 'decode', { value: decode });
      Object.defineProperty(image, 'complete', { value: true }); // jsdom never fires load/error
      return decode;
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    await decodeGameImages(images);
    // Passing frame appears twice in the cycle, so each reference gets its retry.
    expect(decoders[0]).toHaveBeenCalledTimes(2);
    expect(decoders[1]).toHaveBeenCalledTimes(2);
    expect(decoders.every(decode => decode.mock.calls.length >= 2)).toBe(true);
    expect(images.bg.src).toContain('retry=1');
    expect(errors.mock.calls.some(call => String(call[0]).includes('jungle-bg-frog'))).toBe(true);
    errors.mockRestore();
  });
  it('creates nonzero fallback backing strips that cover the entire stage', () => {
    const context = { scale: vi.fn(), setTransform: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }) };
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const layers = makeCompositedLayers(loadGameImages(), 1000, 600, 1, 2100);
    expect(layers).toHaveLength(4);
    for (const layer of layers) {
      expect(layer.canvas.width).toBeGreaterThanOrEqual(layer.period + 2100);
      expect(layer.canvas.height).toBeGreaterThan(0);
    }
    expect(context.fillRect).toHaveBeenCalled();
    spy.mockRestore();
  });
});