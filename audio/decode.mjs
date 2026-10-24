import { parseBuffer } from '../vendor/metadata/index.js';

// decodeAudioData resamples to its context's rate. Read native metadata FIRST,
// then decode in an OfflineAudioContext at that exact rate, never at device rate.
export async function decodeOriginal(url, signal, report = () => {}) {
  report({ percent: 0, phase: '음원 불러오기' });
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('음원을 불러오지 못했어요.');
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const metadata = await parseBuffer(new Uint8Array(bytes), undefined, { skipCovers: true, skipPostHeaders: true, duration: true });
  const sampleRate = metadata.format.sampleRate, channels = metadata.format.numberOfChannels;
  if (!sampleRate || !channels || channels > 2) throw new Error('원본 샘플레이트가 확인되는 모노·스테레오 파일을 사용해주세요.');
  if (metadata.format.duration && metadata.format.duration * sampleRate * channels * 4 > 256 * 1024 ** 2) throw new Error('음원이 너무 길어요. 더 짧은 파일을 사용해주세요.');
  signal?.throwIfAborted(); report({ percent: 2, phase: '원본 디코딩' });
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const context = new OfflineContext(channels, 1, sampleRate);
  const buffer = await context.decodeAudioData(bytes);
  signal?.throwIfAborted();
  if (buffer.sampleRate !== sampleRate) throw new Error('원본 샘플레이트를 보존하지 못했어요.');
  if (buffer.length * buffer.numberOfChannels * 4 > 256 * 1024 ** 2) throw new Error('음원의 처리 메모리 한도를 초과했어요.');
  return { hash, buffer, sampleRate, frames: buffer.length };
}
