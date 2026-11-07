/** Optional original synthesized effects. No audio files, microphone or autoplay. */
export class SkyAudio {
  private context: AudioContext | null = null;
  enabled = true;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {}
  }
  play(event: string) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    try {
      const c = this.context,
        o = c.createOscillator(),
        g = c.createGain();
      o.type = event === "hurt" ? "sawtooth" : "triangle";
      const f =
        event === "gem"
          ? 880
          : event === "jump"
            ? 330
            : event === "hurt"
              ? 130
              : event === "clear"
                ? 660
                : 520;
      o.frequency.setValueAtTime(f, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        event === "hurt" ? 65 : f * 1.6,
        c.currentTime + 0.12,
      );
      g.gain.setValueAtTime(0.055, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
      o.connect(g);
      g.connect(c.destination);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      o.start();
      o.stop(c.currentTime + 0.2);
    } catch {}
  }
  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
