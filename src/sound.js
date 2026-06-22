// Programmatic sound effects via the Web Audio API — no audio files needed.
// One shared instance is used by the Display screen (the TV) to play the
// countdown ticks, category lock, win/lose jingles and timer warning.

class SoundEngine {
  constructor() {
    this.ac = null;
    this.muted = false;
  }

  // Must be called from a user gesture (click) to unlock audio on mobile.
  ensure() {
    if (this.ac) {
      if (this.ac.state === 'suspended') this.ac.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ac = new Ctx();
    } catch (e) {
      /* audio not available */
    }
  }

  setMuted(m) {
    this.muted = m;
  }

  get on() {
    return !this.muted && !!this.ac;
  }

  // A single short tone.
  beep(freq, dur = 0.05, type = 'triangle', vol = 0.18) {
    if (!this.on) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Slot-machine tick while the category shuffles. `i` rises => pitch rises.
  spinTick(i) {
    this.beep(420 + i * 12, 0.04, 'triangle', 0.12);
  }

  // Countdown tick. Pitch rises as the remaining value gets closer to target.
  countTick(remainingFromTarget) {
    this.beep(640 + remainingFromTarget * 1.5, 0.045, 'triangle', 0.14);
  }

  // Satisfying mechanical "click/thud" when the category locks in.
  lock() {
    this.beep(180, 0.18, 'square', 0.22);
    setTimeout(() => this.beep(120, 0.22, 'square', 0.18), 40);
  }

  // Triumphant ascending jingle (Pointless / winner).
  jingleWin() {
    if (!this.on) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.beep(f, 0.22, 'triangle', 0.2), i * 110)
    );
  }

  // Descending, deflating jingle (wrong answer / elimination).
  jingleLose() {
    if (!this.on) return;
    [330, 247, 175, 120].forEach((f, i) =>
      setTimeout(() => this.beep(f, 0.26, 'sawtooth', 0.16), i * 130)
    );
  }

  // Subtle warning beep for the last seconds of the timer.
  timerWarn() {
    this.beep(880, 0.08, 'sine', 0.14);
  }
}

const sound = new SoundEngine();
export default sound;
