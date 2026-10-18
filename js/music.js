/* Fade between scene music without resetting either track's playback position.
   The volume property lets sound effects duck the whole music mix together. */
window.StoryMusic = class StoryMusic {
  constructor(original, night, onError) {
    this.tracks = [original, night];
    this.target = original;
    this.weights = [0, 0];
    this.level = 0.2;
    this.enabled = false;
    this.serial = 0;
    this.onError = onError;
    this.applyVolume();
  }

  get volume() { return this.level; }
  set volume(value) { this.level = value; this.applyVolume(); }
  get paused() { return this.tracks.every(track => track.paused); }

  applyVolume() {
    this.tracks.forEach((track, index) => {
      track.volume = Math.max(0, Math.min(1, this.level * this.weights[index]));
    });
  }

  select(scene) {
    const target = this.tracks[scene === 'low' ? 1 : 0];
    if (target === this.target) return;
    this.target = target;
    if (this.enabled) this.transition().catch(this.onError);
  }

  play() {
    this.enabled = true;
    return this.transition();
  }

  pause() {
    this.enabled = false;
    this.serial++;
    cancelAnimationFrame(this.frame);
    this.weights = [0, 0];
    this.applyVolume();
    this.tracks.forEach(track => track.pause());
  }

  async transition() {
    const serial = ++this.serial, target = this.target;
    cancelAnimationFrame(this.frame);
    try { await target.play(); }
    catch (error) {
      if (serial === this.serial && this.enabled) throw error;
      return;
    }
    if (!this.enabled || serial !== this.serial) {
      if (!this.enabled || (target !== this.target && this.weights[this.tracks.indexOf(target)] === 0)) target.pause();
      return;
    }
    const from = [...this.weights], start = performance.now();
    const step = now => {
      if (serial !== this.serial || !this.enabled) return;
      const p = Math.max(0, Math.min(1, (now - start) / 2000));
      const ease = p * p * (3 - 2 * p);
      this.weights = from.map((weight, index) => weight + (Number(this.tracks[index] === target) - weight) * ease);
      this.applyVolume();
      if (p < 1) this.frame = requestAnimationFrame(step);
      else this.tracks.forEach(track => { if (track !== target) track.pause(); });
    };
    this.frame = requestAnimationFrame(step);
  }
};
