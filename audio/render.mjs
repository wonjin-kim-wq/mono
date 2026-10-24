import { RubberBandInterface, RubberBandOption as O } from '../vendor/rubberband/index.js';

export const ENGINE_VERSION = 'rubberband-3.3.0-r3-offline-v1';
export const BLOCK_FRAMES = 16384;
export const CEILING_DBFS = -1.1;
export const MIN_KEY = -6;
export const MAX_KEY = 6;
const CEILING = 10 ** (CEILING_DBFS / 20);

export async function createRenderer(wasm) {
  const module = wasm instanceof WebAssembly.Module ? wasm : await WebAssembly.compile(wasm);
  return RubberBandInterface.initialize(module);
}

export function validateInput(channels, sampleRate, semitones) {
  if (!Number.isInteger(semitones) || semitones < MIN_KEY || semitones > MAX_KEY) throw new RangeError('지원 범위는 원본 기준 −6~+6반음입니다.');
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('원본 샘플레이트를 확인할 수 없어요.');
  if (!channels.length || channels.length > 2 || !channels[0].length || channels.some(c => c.length !== channels[0].length)) throw new Error('모노 또는 스테레오 음원만 지원해요.');
  if (channels.length * channels[0].length * 4 > 256 * 1024 ** 2) throw new Error('음원이 너무 길어요. 더 짧은 파일로 나눠 올려주세요.');
}

function peakOf(channels) {
  let peak = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) {
    if (!Number.isFinite(channel[i])) throw new Error('음원 처리 중 유효하지 않은 샘플을 발견했어요.');
    peak = Math.max(peak, Math.abs(channel[i]));
  }
  return peak;
}

// One constant gain for the whole song preserves dynamics and stereo balance.
// It only attenuates; unlike per-block limiting it cannot pump at boundaries.
export function finalize(channels, sampleRate) {
  const rawPeak = peakOf(channels);
  const gain = rawPeak > CEILING ? CEILING / rawPeak : 1;
  const fadeFrames = Math.min(Math.round(sampleRate * .005), Math.floor(channels[0].length / 2));
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const edgeGain = fadeFrames ? Math.min(1, i / fadeFrames, (channel.length - 1 - i) / fadeFrames) : 1;
      channel[i] *= gain * edgeGain;
    }
  }
  const outputPeak = peakOf(channels);
  return { rawPeak, outputPeak, peakDbfs: outputPeak ? 20 * Math.log10(outputPeak) : null, gainDb: 20 * Math.log10(gain) };
}

// In offline mode Rubber Band itself carries its multi-resolution overlapping
// windows and phase history through EVERY process call. Never reset a state
// between blocks and never independently concatenate pitch-shifted fragments.
export function renderPitch(api, { channels, sampleRate, semitones }, onProgress = () => {}) {
  validateInput(channels, sampleRate, semitones);
  const started = performance.now(), frames = channels[0].length;
  const output = semitones === 0 ? channels.map(c => c.slice()) : channels.map(() => new Float32Array(frames + BLOCK_FRAMES * 8));
  let written = semitones === 0 ? frames : 0;
  let state = 0, pointers = 0;
  const planes = [];
  const report = (percent, phase) => onProgress({ percent: Math.min(99, Math.round(percent)), phase });
  try {
    if (semitones !== 0) {
      const options = O.RubberBandOptionProcessOffline | O.RubberBandOptionEngineFiner |
        O.RubberBandOptionPitchHighQuality | O.RubberBandOptionChannelsTogether |
        O.RubberBandOptionThreadingNever | O.RubberBandOptionWindowStandard;
      state = api.rubberband_new(sampleRate, channels.length, options, 1, 2 ** (semitones / 12));
      if (!state) throw new Error('고품질 음정 엔진을 준비하지 못했어요.');
      api.rubberband_set_expected_input_duration(state, frames);
      api.rubberband_set_max_process_size(state, BLOCK_FRAMES);
      pointers = api.malloc(channels.length * 4);
      for (let c = 0; c < channels.length; c++) {
        const pointer = api.malloc(BLOCK_FRAMES * 4);
        if (!pointer) throw new Error('오디오 처리 메모리가 부족해요.');
        planes.push(pointer); api.memWritePtr(pointers + c * 4, pointer);
      }
      const feed = (position, count) => {
        for (let c = 0; c < channels.length; c++) api.memWrite(planes[c], channels[c].subarray(position, position + count));
      };
      for (let position = 0; position < frames; position += BLOCK_FRAMES) {
        const count = Math.min(BLOCK_FRAMES, frames - position);
        feed(position, count);
        api.rubberband_study(state, pointers, count, position + count === frames ? 1 : 0);
        report(25 * (position + count) / frames, '분석');
      }
      const drain = () => {
        let available;
        while ((available = api.rubberband_available(state)) > 0) {
          const count = api.rubberband_retrieve(state, pointers, Math.min(BLOCK_FRAMES, available));
          if (!count) throw new Error('오디오 출력이 중단되었어요.');
          if (written + count > output[0].length) throw new Error('음원 길이가 예상 범위를 벗어났어요.');
          for (let c = 0; c < channels.length; c++) output[c].set(api.memReadF32(planes[c], count), written);
          written += count;
        }
      };
      for (let position = 0; position < frames; position += BLOCK_FRAMES) {
        const count = Math.min(BLOCK_FRAMES, frames - position);
        feed(position, count);
        api.rubberband_process(state, pointers, count, position + count === frames ? 1 : 0);
        drain(); report(25 + 68 * (position + count) / frames, '렌더링');
      }
      drain();
      // Offline mode compensates latency itself. Do not trim a guessed delay
      // or pad an underrun with silence; fail if the engine violates sync.
      if (Math.abs(written - frames) > 1) throw new Error(`음원 길이 검증 실패 (${written - frames}프레임). 다시 시도해주세요.`);
    }
    const result = output.map(c => c.subarray(0, frames));
    report(95, '피크 검사');
    const levels = finalize(result, sampleRate);
    const metrics = {
      engine: ENGINE_VERSION, semitones, sampleRate, channels: channels.length,
      inputFrames: frames, engineFrames: written, outputFrames: frames,
      durationSeconds: frames / sampleRate, lengthErrorMs: 0,
      engineLengthErrorMs: (written - frames) / sampleRate * 1000,
      processingMs: Math.round(performance.now() - started), ...levels,
    };
    onProgress({ percent: 100, phase: '완료' });
    return { channels: result, sampleRate, metrics };
  } finally {
    for (const pointer of planes) api.free(pointer);
    if (pointers) api.free(pointers);
    if (state) api.rubberband_delete(state);
  }
}
