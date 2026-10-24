import test from 'node:test';
import assert from 'node:assert/strict';
import { PitchEngine } from '../pitch.js';

class Param { value=1;setTargetAtTime(){}setValueAtTime(){}linearRampToValueAtTime(){}cancelAndHoldAtTime(){} }
class Context {
  sampleRate=48000;currentTime=0;destination={};
  resume(){return Promise.resolve()}
  createGain(){return {gain:new Param(),connect(){},disconnect(){}}}
  createBufferSource(){return {playbackRate:new Param(),connect(){},disconnect(){},start(){},stop(){},onended:null}}
}
class Buffer {
  constructor({numberOfChannels,length,sampleRate}){this.numberOfChannels=numberOfChannels;this.length=length;this.sampleRate=sampleRate;this.data=Array.from({length:numberOfChannels},()=>new Float32Array(length))}
  copyToChannel(data,c){this.data[c].set(data)}
}
let workers=0,terminations=0;
class Worker {
  constructor(){workers++}
  postMessage(data){this.timer=setTimeout(()=>this.onmessage?.({data:{type:'complete',channels:data.channels,sampleRate:data.sampleRate,metrics:{semitones:data.semitones,processingMs:1}}}),15)}
  terminate(){terminations++;clearTimeout(this.timer)}
}
globalThis.window={AudioContext:Context};globalThis.AudioBuffer=Buffer;globalThis.Worker=Worker;
const tick=()=>new Promise(resolve=>setTimeout(resolve,1));
function engine(){
 const player=new PitchEngine();player.src='test-track';
 player.original=async()=>{const original={hash:'test-hash',sampleRate:44100,frames:4410,buffer:{numberOfChannels:1,getChannelData:()=>new Float32Array(4410)}};player._original=original;return original;};
 return player;
}
test('rapid key changes cancel old workers, keep newest same-key request, and preserve play intent',async()=>{
 const player=engine();
 const playing=player.play(0);await tick();await tick();
 const a=player.setPitch(3).catch(error=>error.name);await tick();
 const b=player.setPitch(4).catch(error=>error.name);await tick();
 const c=player.setPitch(3);
 await Promise.all([playing,c]);
 assert.equal(await a,'AbortError');assert.equal(await b,'AbortError');
 assert.equal(player.semitones,3);assert.equal(player.paused,false);assert.equal(player.pendingPlay,false);
 assert.equal(player._pending,null);
 player.currentTime=.025;
 const count=workers;
 await player.setPitch(0);await player.setPitch(3);
 assert.equal(workers,count+1,'returning to cached +3 does not create a worker');
 assert.ok(Math.abs(player.currentTime-.025)<1e-9,'render swaps preserve playback offset');
 assert.ok(terminations>=4);player.pause();
});
test('changing the track rejects old render results and stops pending autoplay',async()=>{
 const player=engine();const old=player.play(3);await tick();await tick();
 player.src='new-track';await old;
 assert.equal(player.currentSrc,'new-track');assert.equal(player._buffer,null);
 assert.equal(player.paused,true);assert.equal(player.pendingPlay,false);
});
