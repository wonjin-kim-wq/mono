import { createRenderer, renderPitch } from './render.mjs';

self.onmessage = async ({ data }) => {
  try {
    const response = await fetch('/vendor/rubberband/rubberband.wasm');
    if (!response.ok) throw new Error('음정 엔진을 내려받지 못했어요.');
    const api = await createRenderer(await response.arrayBuffer());
    let last = 0;
    const result = renderPitch(api, data, progress => {
      if (performance.now() - last >= 60 || progress.percent === 100) {
        self.postMessage({ type: 'progress', ...progress }); last = performance.now();
      }
    });
    self.postMessage({ type: 'complete', ...result }, result.channels.map(c => c.buffer));
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || '오디오를 처리하지 못했어요.' });
  }
};
