// The media element remains the playback clock. SoundTouch changes pitch only;
// playbackRate stays at 1 so seeking, duration and tempo remain unchanged.
export class PitchEngine {
  constructor(audio) {
    this.audio = audio;
    this.context = null;
    this.node = null;
    this.source = null;
    this.initializing = null;
    this.semitones = 0;
  }

  async initialize() {
    if (this.node) {
      await this.context.resume();
      return;
    }
    if (this.initializing) return this.initializing;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('이 브라우저에서는 키 조절을 지원하지 않아요. 최신 Safari 또는 Chrome을 사용해주세요.');
    this.context ||= new Context();
    // Resume within the button gesture, before loading the worklet module.
    const resumed = this.context.resume();
    this.initializing = (async () => {
      await resumed;
      if (!this.context.audioWorklet) throw new Error('키 조절에는 HTTPS 또는 localhost 접속이 필요해요.');
      const { SoundTouchNode } = await import('/vendor/soundtouch/SoundTouchNode.js');
      await SoundTouchNode.register(this.context, '/vendor/soundtouch/soundtouch-processor.js');
      this.node = new SoundTouchNode({ context: this.context });
      this.node.connect(this.context.destination);
      this.source = this.context.createMediaElementSource(this.audio);
      this.source.connect(this.node);
      this.audio.preservesPitch = false;
      this.audio.playbackRate = 1;
      this.node.playbackRate.value = 1;
      this.node.pitchSemitones.value = this.semitones;
      this.node.addEventListener('processorerror', () => {
        this.audio.pause();
        this.audio.dispatchEvent(new CustomEvent('pitcherror'));
      });
    })().finally(() => { this.initializing = null; });
    return this.initializing;
  }

  async setPitch(semitones) {
    if (!Number.isInteger(semitones) || semitones < -10 || semitones > 10) {
      throw new RangeError('지원하는 키 범위를 벗어났어요.');
    }
    await this.initialize();
    this.semitones = semitones;
    this.node.pitchSemitones.setValueAtTime(semitones, this.context.currentTime);
  }

  // Flush buffered samples when seeking or changing tracks, so the previous
  // position cannot bleed into the start of the next passage.
  reset() {
    if (!this.node) return;
    const NodeClass = this.node.constructor;
    this.source.disconnect();
    this.node.disconnect();
    this.node.port.close();
    this.node = new NodeClass({ context: this.context });
    this.node.pitchSemitones.value = this.semitones;
    this.source.connect(this.node);
    this.node.connect(this.context.destination);
    this.node.addEventListener('processorerror', () => {
      this.audio.pause();
      this.audio.dispatchEvent(new CustomEvent('pitcherror'));
    });
  }
}
