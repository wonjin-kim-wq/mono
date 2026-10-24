import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const processorSource = readFileSync(new URL('../vendor/soundtouch/soundtouch-processor.js', import.meta.url), 'utf8');
const sampleRate = 44100;

function renderTone(semitones) {
  let Processor;
  const scope = {
    sampleRate,
    console,
    AudioWorkletProcessor: class { port = { postMessage() {}, onmessage: null }; },
    registerProcessor(name, type) { Processor = type; },
  };
  vm.runInNewContext(processorSource, scope);
  const processor = new Processor();
  const output = new Float32Array(Math.floor(sampleRate * 3 / 128) * 128);
  for (let start = 0; start < output.length; start += 128) {
    const input = Float32Array.from({ length: 128 }, (_, i) => .3 * Math.sin(2 * Math.PI * 440 * (start + i) / sampleRate));
    const left = new Float32Array(128), right = new Float32Array(128);
    assert.equal(processor.process([[input, input]], [[left, right]], {
      pitch: new Float32Array([1]),
      pitchSemitones: new Float32Array([semitones]),
      playbackRate: new Float32Array([1]),
    }), true);
    output.set(left, start);
  }
  const settled = output.subarray(sampleRate, sampleRate * 2.5);
  let crossings = 0, energy = 0;
  for (let i = 1; i < settled.length; i++) {
    assert.ok(Number.isFinite(settled[i]), 'output must contain finite samples');
    if (settled[i - 1] <= 0 && settled[i] > 0) crossings++;
    energy += settled[i] ** 2;
  }
  return { frequency: crossings * sampleRate / settled.length, rms: Math.sqrt(energy / settled.length) };
}

for (const semitones of [-10, -5, 0, 5, 10]) {
  test(`${semitones} semitones changes 440 Hz by the requested interval at a constant playback rate`, () => {
    const { frequency, rms } = renderTone(semitones);
    const expected = 440 * 2 ** (semitones / 12);
    assert.ok(Math.abs(frequency - expected) < 2, `${frequency.toFixed(2)} Hz, expected ${expected.toFixed(2)} Hz`);
    assert.ok(rms > .1 && rms < .4, `audible, bounded output: ${rms}`);
  });
}
