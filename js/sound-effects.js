/* Scene audio follows the same scroll positions as the artwork. */
window.StorySoundEffects = class StorySoundEffects {
  constructor({ music, enabled }) {
    this.music = music;
    this.enabled = enabled;
    this.state = null;
    this.lastY = window.scrollY;
    this.movingUntil = 0;
    this.tracks = {};
    const clips = {
      footsteps: ['footsteps', true, 0.70],
      chatter: ['chatter-jp', true, 0.40],
      traffic: ['traffic', true, 0.50],
      ding: ['ding', false, 0.50],
      curtain: ['curtain', false, 0.65],
      clock: ['clock', true, 0.25]
    };
    Object.entries(clips).forEach(([name, [file, loop, volume]]) => {
      const audio = document.createElement('audio');
      audio.src = `assets/audio/sfx/${file}.mp3`;
      audio.loop = loop;
      audio.preload = 'auto';
      audio.dataset.storySfx = name;
      audio.hidden = true;
      document.body.append(audio);
      this.tracks[name] = { audio, volume, wanted: false, fade: 0 };
      audio.addEventListener('ended', () => {
        this.tracks[name].wanted = false;
        this.duckMusic();
      });
    });
    document.addEventListener('visibilitychange', () => this.refresh());
    window.addEventListener('pagehide', () => this.stopAll());
  }

  fade(track, target, reset = false) {
    cancelAnimationFrame(track.fade);
    const from = track.audio.volume;
    const start = performance.now();
    const step = now => {
      const p = Math.max(0, Math.min(1, (now - start) / 180));
      track.audio.volume = from + (target - from) * p;
      if (p < 1) track.fade = requestAnimationFrame(step);
      else if (reset && !track.wanted) {
        track.audio.pause();
        track.audio.currentTime = 0;
      }
    };
    track.fade = requestAnimationFrame(step);
  }

  play(name, restart = false) {
    const track = this.tracks[name];
    if (track.wanted && !restart) return;
    track.wanted = true;
    cancelAnimationFrame(track.fade);
    if (restart) track.audio.currentTime = 0;
    track.audio.volume = 0;
    track.audio.play().then(() => {
      if (track.wanted && this.allowed()) this.fade(track, track.volume);
      else this.stop(name, true);
    }).catch(() => {
      track.wanted = false;
      this.duckMusic();
    });
  }

  stop(name, immediate = false) {
    const track = this.tracks[name];
    track.wanted = false;
    if (immediate) {
      cancelAnimationFrame(track.fade);
      track.audio.pause();
      track.audio.currentTime = 0;
      track.audio.volume = 0;
    } else if (!track.audio.paused) this.fade(track, 0, true);
  }

  allowed() { return this.enabled() && !document.hidden; }

  stopAll() {
    Object.keys(this.tracks).forEach(name => this.stop(name, true));
    this.duckMusic();
  }

  duckMusic() {
    const busy = Object.values(this.tracks).some(track => track.wanted);
    const target = busy ? 0.09 : 0.20;
    if (this.musicTarget === target) return;
    this.musicTarget = target;
    cancelAnimationFrame(this.musicFade);
    const from = this.music.volume, start = performance.now();
    const step = now => {
      const p = Math.max(0, Math.min(1, (now - start) / 220));
      this.music.volume = from + (target - from) * p;
      if (p < 1) this.musicFade = requestAnimationFrame(step);
    };
    this.musicFade = requestAnimationFrame(step);
  }

  update(scene, progress, y) {
    const previous = this.state;
    if (Math.abs(y - this.lastY) > 0.5) {
      this.movingUntil = performance.now() + 350;
      clearTimeout(this.motionTimer);
      this.motionTimer = setTimeout(() => this.refresh(), 360);
    }
    this.lastY = y;
    this.state = { scene, progress };
    if (scene !== 'morning') {
      this.stop('ding');
      this.stop('curtain');
    }
    if (this.allowed() && previous?.scene === 'morning' && scene === 'morning') {
      const crossed = threshold => previous.progress < threshold && progress >= threshold;
      if (crossed(0.62)) this.play('ding', true);
      if (crossed(0.66)) this.play('curtain', true);
    }
    // Pulling back to the open window also stops a closing sound still in progress.
    if (scene === 'morning' && previous?.scene === scene && progress < previous.progress) {
      this.stop('curtain');
      if (progress < 0.55) this.stop('ding');
    }
    this.refresh();
  }

  refresh() {
    if (!this.allowed()) { this.stopAll(); return; }
    if (!this.state) return;
    const { scene, progress } = this.state;
    const desired = {
      footsteps: scene === 'starts' && progress >= 0.08 && progress < 0.78 && performance.now() < this.movingUntil,
      chatter: scene === 'workers',
      traffic: scene === 'morning' && progress < 0.30,
      clock: scene === 'clocks'
    };
    Object.entries(desired).forEach(([name, wanted]) => {
      if (wanted) this.play(name);
      else if (this.tracks[name].wanted) this.stop(name);
    });
    this.duckMusic();
  }
};
