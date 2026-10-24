import { decodeOriginal } from './audio/decode.mjs';
import { BufferCache, readDisk, writeDisk } from './audio/cache.mjs';
import { ENGINE_VERSION, MIN_KEY, MAX_KEY } from './audio/render.mjs';

const abortError = () => new DOMException('새 요청으로 취소되었습니다.', 'AbortError');
const FADE_SECONDS = .018;

// Playback facade: all DSP finishes in a Worker BEFORE AudioBuffer playback.
// No MediaElementSource, Worklet, live pitch algorithm or per-quantum allocation.
export class PitchEngine extends EventTarget {
  constructor() {
    super();
    this.context = null; this.gain = null;
    this.cache = new BufferCache(); this.semitones = 0;
    this._src = ''; this._sourceVersion = 0; this._renderVersion = 0;
    this._original = null; this._loadPromise = null; this._buffer = null;
    this._paused = true; this._offset = 0; this._startedAt = 0;
    this._volume = .65; this._loop = false; this._node = null;
    this._task = null; this._pending = null; this._timer = null;
    this._playVersion = 0; this.pendingPlay = false;
    this.metrics = null;
  }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  progress(detail) { this.emit('renderprogress', detail); }
  get src() { return this._src; }
  set src(value) {
    if (value === this._src) return;
    this.pause(); this._controller?.abort(); this.cancelRender();
    this._sourceVersion++; this._src = value;
    this._original = null; this._loadPromise = null; this._buffer = null;
    this._offset = 0; this.semitones = 0; this.metrics = null;
    this.progress({ percent: 100, phase: '대기', busy: false });
  }
  get currentSrc() { return this._src; }
  get duration() { return this._original ? this._original.frames / this._original.sampleRate : NaN; }
  get paused() { return this._paused; }
  get playbackRate() { return 1; }
  get currentTime() {
    if (this._paused || !this.context) return this._offset;
    const time = this._offset + Math.max(0, this.context.currentTime - this._startedAt);
    return this._loop ? time % this.duration : Math.min(time, this.duration);
  }
  set currentTime(time) {
    const offset = Math.max(0, Math.min(Number(time) || 0, Number.isFinite(this.duration) ? this.duration : 0));
    if (!this._paused && this._buffer) this.startBuffer(offset);
    else this._offset = offset;
    this.emit('timeupdate');
  }
  get volume() { return this._volume; }
  set volume(value) {
    this._volume = Math.max(0, Math.min(1, Number(value)));
    if (this.gain) this.gain.gain.setTargetAtTime(this._volume, this.context.currentTime, .01);
  }
  get loop() { return this._loop; }
  set loop(value) { this._loop = Boolean(value); if (this._node) this._node.source.loop = this._loop; }
  async initialize() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('최신 Safari 또는 Chrome에서 재생해주세요.');
      // Device rate is used ONLY for final playback. Decoding and all DSP stay
      // at the native source rate; the browser performs one final conversion.
      this.context = new Context();
      this.gain = this.context.createGain(); this.gain.gain.value = this._volume;
      this.gain.connect(this.context.destination);
    }
    await this.context.resume();
  }
  cancelRender() {
    this._renderVersion++;
    if (this._task) { this._task.worker.terminate(); this._task.reject(abortError()); this._task = null; }
    this._pending = null;
  }
  async original() {
    if (this._original) return this._original;
    if (this._loadPromise) return this._loadPromise;
    const version = this._sourceVersion;
    this._controller = new AbortController();
    const promise = decodeOriginal(this._src, this._controller.signal, p => this.progress({ ...p, busy: true }))
      .then(original => {
        if (version !== this._sourceVersion) throw abortError();
        this._original = original; this.emit('loadedmetadata'); this.emit('timeupdate');
        return original;
      }).catch(error => { if (version === this._sourceVersion) this._loadPromise = null; throw error; });
    this._loadPromise = promise; return promise;
  }
  setPitch(semitones) {
    if (!Number.isInteger(semitones) || semitones < MIN_KEY || semitones > MAX_KEY) return Promise.reject(new RangeError('원본 기준 −6~+6반음까지 조절할 수 있어요.'));
    const requestStarted=performance.now();
    const key = `${this._sourceVersion}:${semitones}`;
    if (this._pending?.key === key) return this._pending.promise;
    if (this._buffer && this.semitones === semitones && !this._pending) return Promise.resolve(this._buffer);
    this.cancelRender();
    const version = this._renderVersion, sourceVersion = this._sourceVersion;
    const valid = () => { if (version !== this._renderVersion || sourceVersion !== this._sourceVersion) throw abortError(); };
    this.progress({ percent: 0, phase: '준비', busy: true });
    const promise = (async () => {
      const original = await this.original(); valid();
      const cacheKey = `${ENGINE_VERSION}:${original.hash}:${original.sampleRate}:${semitones}`;
      let result = this.cache.get(cacheKey), cacheHit = result ? 'memory' : 'none';
      if (!result) {
        const stored = await readDisk(cacheKey); valid();
        if (stored) {
          result = { buffer: this.toAudioBuffer(stored.channels, stored.sampleRate), metrics: stored.metrics };
          cacheHit = 'disk';
        } else {
          const rendered = await this.runWorker(original, semitones); valid();
          result = { buffer: this.toAudioBuffer(rendered.channels, rendered.sampleRate), metrics: rendered.metrics };
          // Disk writes are best effort, after playback has received its result.
          void writeDisk({ key: cacheKey, sampleRate: rendered.sampleRate, channels: rendered.channels,
            metrics: rendered.metrics, bytes: rendered.channels.reduce((total,c)=>total+c.buffer.byteLength,0) });
        }
        this.cache.set(cacheKey, result);
      }
      valid();
      const offset = this.currentTime, playing = !this._paused;
      this._buffer = result.buffer; this.semitones = semitones;
      this.metrics = { ...result.metrics, cacheHit, cacheBytes:this.cache.bytes, preparationMs:Math.round(performance.now()-requestStarted), playbackSampleRate: this.context?.sampleRate };
      console.info('[mono:audio-render]', JSON.stringify(this.metrics));
      if (playing) this.startBuffer(offset);
      else this._offset = offset;
      this.progress({ percent: 100, phase: cacheHit === 'none' ? '렌더링 완료' : '캐시 사용', busy: false, cacheHit });
      this.emit('timeupdate'); this.emit('rendercomplete', this.metrics);
      return this._buffer;
    })().catch(error => {
      if (version === this._renderVersion) this.progress({ percent: 0, phase: error.name === 'AbortError' ? '취소' : '실패', busy: false });
      throw error;
    }).finally(() => { if (this._pending?.version === version) this._pending = null; });
    this._pending = { key, promise, version }; return promise;
  }
  runWorker(original, semitones) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./audio/worker.mjs', import.meta.url), { type: 'module' });
      this._task = { worker, reject };
      const finish = () => { worker.terminate(); if (this._task?.worker === worker) this._task = null; };
      worker.onmessage = ({ data }) => {
        if(this._task?.worker!==worker)return;
        if (data.type === 'progress') this.progress({ ...data, percent:Math.round(3+.97*data.percent), busy: data.percent < 100 });
        if (data.type === 'complete') { finish(); resolve(data); }
        if (data.type === 'error') { finish(); reject(new Error(data.message)); }
      };
      worker.onerror = () => { finish(); reject(new Error('오디오 처리 Worker를 실행하지 못했어요.')); };
      const channels = Array.from({ length: original.buffer.numberOfChannels }, (_, c) => original.buffer.getChannelData(c).slice());
      worker.postMessage({ channels, sampleRate: original.sampleRate, semitones }, channels.map(c => c.buffer));
    });
  }
  toAudioBuffer(channels, sampleRate) {
    const buffer = new AudioBuffer({ numberOfChannels: channels.length, length: channels[0].length, sampleRate });
    channels.forEach((channel, c) => buffer.copyToChannel(channel, c)); return buffer;
  }
  stopNode(node, now) {
    if (!node) return;
    node.source.onended = null;
    const gain = node.envelope.gain;
    // cancelAndHold avoids a discontinuity when a user seeks repeatedly.
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
    else { gain.cancelScheduledValues(now); gain.setValueAtTime(Math.min(1,Math.max(0,(now-node.createdAt)/FADE_SECONDS)), now); }
    gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    node.source.stop(now + FADE_SECONDS + .002);
    node.source.onended = () => { node.source.disconnect(); node.envelope.disconnect(); };
  }
  startBuffer(offset) {
    const now = this.context.currentTime, old = this._node;
    const source = this.context.createBufferSource(), envelope = this.context.createGain();
    source.buffer = this._buffer; source.playbackRate.value = 1; source.loop = this._loop;
    source.connect(envelope); envelope.connect(this.gain);
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
    this.stopNode(old, now);
    const start = Math.min(offset, Math.max(0, this.duration - 1 / this._buffer.sampleRate));
    source.start(now, start); this._node = { source, envelope, createdAt:now };
    this._offset = start; this._startedAt = now; this._paused = false;
    source.onended = () => {
      if (this._node?.source !== source || this._loop) return;
      source.disconnect(); envelope.disconnect(); this._node = null;
      this._offset = this.duration; this._paused = true; this.stopTimer();
      this.emit('timeupdate'); this.emit('pause'); this.emit('ended');
    };
    this.startTimer();
  }
  async play(semitones = this.semitones) {
    const version = ++this._playVersion;
    this.pendingPlay = true; this.emit('playpending');
    try {
      await this.initialize();
      let preparation=this.setPitch(semitones);
      while(true){
        try { await preparation;break; }
        catch(error){
          if(error.name==='AbortError'&&version===this._playVersion&&this._pending){preparation=this._pending.promise;continue;}
          if(error.name==='AbortError')return;
          throw error;
        }
      }
      if (version !== this._playVersion) return;
      this.pendingPlay = false;
      if (this._paused) this.startBuffer(this._offset >= this.duration ? 0 : this._offset);
      this.emit('play');
    } catch (error) {
      if (version === this._playVersion) { this.pendingPlay = false; this.emit('pause'); }
      throw error;
    }
  }
  pause() {
    this._playVersion++; this.pendingPlay = false;
    if (!this._paused) this._offset = this.currentTime;
    if (this.context) this.stopNode(this._node, this.context.currentTime);
    this._node = null; this._paused = true; this.stopTimer(); this.emit('pause');
  }
  startTimer() { this.stopTimer(); this._timer = setInterval(() => this.emit('timeupdate'), 150); }
  stopTimer() { clearInterval(this._timer); this._timer = null; }
}
