import { spawnSync } from 'node:child_process';
import { parseFile } from 'music-metadata';
import { writeFile } from 'node:fs/promises';

export const ffmpeg = process.env.MONO_FFMPEG || 'ffmpeg';
export async function decodeFile(file) {
  const metadata = await parseFile(file, { skipCovers: true });
  const sampleRate = metadata.format.sampleRate, count = metadata.format.numberOfChannels;
  const command = spawnSync(ffmpeg, ['-v','error','-i',file,'-map','0:a:0','-ac',String(count),'-ar',String(sampleRate),'-f','f32le','-'], { maxBuffer: 512 * 1024 ** 2 });
  if (command.status !== 0) throw new Error(command.error?.message || command.stderr?.toString() || 'FFmpeg failed');
  const bytes = command.stdout;
  const samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const channels = Array.from({ length: count }, () => new Float32Array(samples.length / count));
  for (let i = 0; i < channels[0].length; i++) for (let c = 0; c < count; c++) channels[c][i] = samples[i * count + c];
  return { channels, sampleRate };
}
export async function writeWav(file, channels, sampleRate) {
  const count = channels.length, frames = channels[0].length;
  const bytes = Buffer.alloc(44 + frames * count * 4);
  bytes.write('RIFF',0); bytes.writeUInt32LE(bytes.length-8,4); bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(3,20); bytes.writeUInt16LE(count,22);
  bytes.writeUInt32LE(sampleRate,24); bytes.writeUInt32LE(sampleRate*count*4,28);
  bytes.writeUInt16LE(count*4,32); bytes.writeUInt16LE(32,34); bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
  for(let i=0;i<frames;i++)for(let c=0;c<count;c++)bytes.writeFloatLE(channels[c][i],44+(i*count+c)*4);
  await writeFile(file,bytes);
}
