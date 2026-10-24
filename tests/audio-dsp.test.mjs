import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderer, renderPitch, finalize } from '../audio/render.mjs';
import { BufferCache } from '../audio/cache.mjs';

const api=await createRenderer(await readFile('vendor/rubberband/rubberband.wasm'));
function frequency(channel,sampleRate){
 let count=0;const start=Math.floor(sampleRate*.5),end=Math.floor(sampleRate*2.5);
 for(let i=start+1;i<end;i++)if(channel[i-1]<=0&&channel[i]>0)count++;
 return count*sampleRate/(end-start);
}
for(const sampleRate of [44100,48000])for(const semitones of [-3,3,6]){
 test(`${sampleRate} Hz / ${semitones} semitones: pitch, stereo, native rate, duration, headroom`,()=>{
  const tone=Float32Array.from({length:sampleRate*3},(_,i)=>1.2*Math.sin(2*Math.PI*440*i/sampleRate));
  const result=renderPitch(api,{channels:[tone,tone.slice()],sampleRate,semitones});
  assert.equal(result.sampleRate,sampleRate);
  assert.equal(result.metrics.engineFrames,tone.length);assert.equal(result.metrics.lengthErrorMs,0);
  assert.ok(Math.abs(frequency(result.channels[0],sampleRate)-440*2**(semitones/12))<1);
  assert.ok(result.metrics.peakDbfs<=-1);
  for(let i=0;i<tone.length;i++)assert.ok(Math.abs(result.channels[0][i]-result.channels[1][i])<1e-6);
 });
}
test('zero key keeps samples intact except global headroom and 5 ms edge fades',()=>{
 const tone=new Float32Array(44100).fill(.5);
 const result=renderPitch(api,{channels:[tone],sampleRate:44100,semitones:0});
 assert.equal(result.channels[0][2000],.5);assert.equal(result.channels[0][0],0);assert.equal(result.channels[0].at(-1),0);
});
test('finite sample protection and hard range check',()=>{
 assert.throws(()=>finalize([new Float32Array([NaN,0])],44100));
 assert.throws(()=>renderPitch(api,{channels:[new Float32Array(1000)],sampleRate:44100,semitones:7}),RangeError);
});
test('LRU cache bounds bytes, reuses buffers, and evicts least-recently-used',()=>{
 const cache=new BufferCache(24);
 const record=id=>({buffer:{length:2,numberOfChannels:2,id},metrics:{}});
 cache.set('a',record('a'));assert.equal(cache.get('a').buffer.id,'a');
 cache.set('b',record('b'));assert.equal(cache.get('a'),undefined);assert.equal(cache.bytes,16);
 cache.set('b',record('b2'));assert.equal(cache.bytes,16);assert.equal(cache.get('b').buffer.id,'b2');
});
