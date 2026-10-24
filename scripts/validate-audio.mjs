import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRenderer, renderPitch, BLOCK_FRAMES } from '../audio/render.mjs';
import { decodeFile, writeWav } from './audio-utils.mjs';
import assert from 'node:assert/strict';

const input = await decodeFile(process.argv[2] || 'media/only-you-original.mp3');
const frames=input.channels[0].length,duration=frames/input.sampleRate;
assert.ok(duration>=180,'Long-track validation requires at least three minutes.');
const api=await createRenderer(await readFile('vendor/rubberband/rubberband.wasm'));
function segment(output,start,end){
 let energy=0,diffEnergy=0,count=0,peak=0,dropoutWindows=0;
 const window=Math.floor(input.sampleRate*.05);
 for(let pos=start;pos<end;pos+=window){
  const stop=Math.min(end,pos+window);let sourceEnergy=0,outputEnergy=0;
  for(let c=0;c<output.length;c++)for(let i=pos;i<stop;i++){
   const x=output[c][i];energy+=x*x;outputEnergy+=x*x;sourceEnergy+=input.channels[c][i]**2;
   peak=Math.max(peak,Math.abs(x));if(i>start)diffEnergy+=(x-output[c][i-1])**2;count++;
  }
  const n=(stop-pos)*output.length;
  if(Math.sqrt(sourceEnergy/n)>.01&&Math.sqrt(outputEnergy/n)<1e-5)dropoutWindows++;
 }
 return { rms:Math.sqrt(energy/count),peakDbfs:peak?20*Math.log10(peak):null,derivativeRms:Math.sqrt(diffEnergy/count),activeInputSilentOutput50msWindows:dropoutWindows };
}
function seamQuality(channels){
 const ordinary=[],seams=[];
 for(const channel of channels)for(let i=1;i<channel.length;i++){
  const jump=Math.abs(channel[i]-channel[i-1]);
  if(i%BLOCK_FRAMES===0)seams.push(jump);
  else if(i%127===0)ordinary.push(jump);
 }
 ordinary.sort((a,b)=>a-b);seams.sort((a,b)=>a-b);
 const percentile=(x,p)=>x[Math.floor((x.length-1)*p)]||0;
 return {blockFrames:BLOCK_FRAMES,seamP99Jump:percentile(seams,.99),ordinaryP99Jump:percentile(ordinary,.99),maxSeamJump:seams.at(-1)};
}
const results=[];
await mkdir('/tmp/mono-audio-validation',{recursive:true});
for(const semitones of [3,-3,6]){
 console.log(`Rendering ${duration.toFixed(3)}s: ${semitones} semitones…`);
 const rendered=renderPitch(api,{...input,semitones});
 const beginning=segment(rendered.channels,0,Math.floor(input.sampleRate*30));
 const ending=segment(rendered.channels,frames-Math.floor(input.sampleRate*30),frames);
 const whole=segment(rendered.channels,0,frames),seams=seamQuality(rendered.channels);
 assert.equal(rendered.channels[0].length,frames);
 assert.ok(rendered.metrics.peakDbfs<=-1,'sample peak below −1 dBFS');
 assert.equal(whole.activeInputSilentOutput50msWindows,0,'no silent gaps in active music');
 assert.ok(seams.seamP99Jump<Math.max(.03,seams.ordinaryP99Jump*2.5),'no anomalous block-boundary jumps');
 const row={...rendered.metrics,beginning,ending,whole,seams};results.push(row);
 await writeWav(`/tmp/mono-audio-validation/key-${semitones}.wav`,rendered.channels,input.sampleRate);
 console.log(JSON.stringify(row));
}
const report={testedAt:new Date().toISOString(),source:'only-you-original.mp3',method:'Full-track R3 offline render; same engine module and options as browser worker',
 limits:'Automated checks measure continuity, levels, length and boundary behavior; they do not establish subjective perceptual equivalence of different song sections.',results};
await mkdir('reports',{recursive:true});
await writeFile('reports/audio-validation.json',JSON.stringify(report,null,2)+'\n');
