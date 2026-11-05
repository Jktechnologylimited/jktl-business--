import { chaseWave, type RunState } from "./runner";

/** Small synthesized effects: no downloads, microphone access or background loop. */
export class RunnerAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<OscillatorNode>();
  private enabled = true;
  private active = false;
  private step = -1;
  private beat = -1;
  private coins = 0;
  private wave = 0;
  private seed: number | null = null;
  private ended = false;

  /** Called only from Start, Resume or the sound button (browser user gesture). */
  unlock() {
    try {
      if (!this.context) {
        const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Audio) return;
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      this.active = true;
      this.setEnabled(this.enabled);
      void this.context.resume().catch(() => {});
    } catch { /* Audio support must never block gameplay. */ }
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master && this.context) this.master.gain.setValueAtTime(enabled && this.active ? 0.32 : 0, this.context.currentTime);
    if (!enabled) this.stopVoices();
  }
  pause() {
    this.active = false;
    if (this.master && this.context) this.master.gain.setValueAtTime(0, this.context.currentTime);
    this.stopVoices();
  }
  private stopVoices() {
    for (const voice of this.voices) { try { voice.stop(); } catch {} voice.disconnect(); }
    this.voices.clear();
  }
  private tone(from: number, to: number, duration: number, volume: number, type: OscillatorType = "sine", delay = 0) {
    if (!this.enabled || !this.active || !this.context || !this.master || this.context.state !== "running") return;
    const at = this.context.currentTime + delay;
    const voice = this.context.createOscillator(), gain = this.context.createGain();
    voice.type = type;
    voice.frequency.setValueAtTime(from, at);
    voice.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    voice.connect(gain); gain.connect(this.master);
    this.voices.add(voice);
    voice.onended = () => { this.voices.delete(voice); voice.disconnect(); gain.disconnect(); };
    voice.start(at); voice.stop(at + duration + 0.01);
  }
  action(action: "jump" | "slide") {
    if (action === "jump") this.tone(240, 620, 0.15, 0.18, "triangle");
    else this.tone(220, 50, 0.18, 0.14, "triangle");
  }
  update(run: RunState) {
    if (run.phase === "paused" || run.phase === "ready") return;
    if (run.seed !== this.seed) {
      this.seed = run.seed; this.step = -1; this.beat = -1; this.coins = 0; this.wave = 0; this.ended = false;
    }
    if (run.phase === "over") {
      if (!this.ended) { this.tone(150, 35, 0.45, 0.4, "triangle"); this.ended = true; }
      return;
    }
    const step = Math.floor(run.distance / 1.6), beat = Math.floor(run.seconds / 0.55), chase = chaseWave(run);
    if (step !== this.step) {
      if (run.jumpAge === null && run.slideLeft <= 0) this.tone(step % 2 ? 115 : 95, 42, 0.065, 0.2, "triangle");
      this.step = step;
    }
    if (chase.phase === "chasing" && beat !== this.beat) {
      this.tone(beat % 2 ? 185 : 130, 48, 0.16, 0.16);
      this.beat = beat;
    }
    if (chase.phase === "chasing" && chase.wave !== this.wave) {
      this.tone(260, 390, 0.18, 0.12, "triangle");
      this.wave = chase.wave;
    }
    if (run.coins > this.coins) {
      this.tone(880, 1100, 0.09, 0.13);
      this.tone(1320, 1500, 0.14, 0.1, "sine", 0.07);
    }
    this.coins = run.coins;
  }
  dispose() {
    this.pause();
    void this.context?.close().catch(() => {});
    this.context = null; this.master = null;
  }
}
