import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordClip } from './record-video';

class FakeRecorder {
  static last: FakeRecorder;
  static emit = true;
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    readonly stream: unknown,
    readonly options: { mimeType: string; videoBitsPerSecond: number },
  ) {
    this.mimeType = options.mimeType;
    FakeRecorder.last = this;
  }
  start = vi.fn();
  stop = vi.fn(() => {
    if (FakeRecorder.emit) this.ondataavailable?.({ data: new Blob(['abc'], { type: this.mimeType }) });
    this.onstop?.();
  });
}

describe('recordClip', () => {
  beforeEach(() => {
    FakeRecorder.emit = true;
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', FakeRecorder);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('2秒たったら止めて、撮れた動画を返す', async () => {
    const p = recordClip({} as MediaStream, 'video/mp4;codecs=avc1');
    expect(FakeRecorder.last.start).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeRecorder.last.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const blob = await p;
    expect(FakeRecorder.last.stop).toHaveBeenCalledOnce();
    expect(blob.size).toBe(3);
    expect(FakeRecorder.last.options.videoBitsPerSecond).toBe(2_500_000);
  });

  it('何も撮れなかったときは例外にする', async () => {
    FakeRecorder.emit = false;
    const p = recordClip({} as MediaStream, 'video/webm');
    const assertion = expect(p).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(2000);
    await assertion;
  });
});
