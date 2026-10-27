export interface BoostParams { gain: number; limiter: { threshold: number; knee: number; ratio: number; attack: number; release: number } }

export const LIMITER = { threshold: -3, knee: 6, ratio: 12, attack: 3, release: 250 } as const;

/** attack/release are expressed in ms by the spec, stored as seconds here. */
export function boostParams(boost: number, unlocked: boolean): BoostParams {
  const cap = unlocked ? 5 : 3;
  const clamped = Math.min(Math.max(boost, 0), cap);
  return {
    gain: clamped,
    limiter: { threshold: -3, knee: 6, ratio: 12, attack: 0.003, release: 0.25 },
  };
}

export class VolumeBoost {
  private context: AudioContext;
  private media: HTMLMediaElement;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private connected = false;

  constructor(context: AudioContext, media: HTMLMediaElement) {
    this.context = context;
    this.media = media;
  }

  connect(): void {
    if (this.connected) return;
    this.source = this.context.createMediaElementSource(this.media);
    this.gain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = LIMITER.threshold;
    this.compressor.knee.value = LIMITER.knee;
    this.compressor.ratio.value = LIMITER.ratio;
    this.compressor.attack.value = LIMITER.attack;
    this.compressor.release.value = LIMITER.release;
    this.source.connect(this.gain);
    this.gain.connect(this.compressor);
    this.compressor.connect(this.context.destination);
    this.connected = true;
  }

  setBoost(boost: number, unlocked: boolean): void {
    if (!this.gain) this.connect();
    const params = boostParams(boost, unlocked);
    this.gain!.gain.setValueAtTime(params.gain, this.context.currentTime);
  }

  disconnect(): void {
    if (this.source) { this.source.disconnect(); this.source = null; }
    if (this.gain) { this.gain.disconnect(); this.gain = null; }
    if (this.compressor) { this.compressor.disconnect(); this.compressor = null; }
    this.connected = false;
  }
}
