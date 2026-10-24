# mono

블랙·화이트 중심의 반주 연습 웹앱입니다. 둘러보기에는 탑현의 **나에게 그대만이 (Inst.)** 한 곡만 제공합니다.

## 실행

```sh
npm ci
npm run dev
```

http://localhost:3000 에서 확인합니다.

## 고품질 키 변경

- Rubber Band 3.3.0 WASM의 **R3 Finer / PitchHighQuality / ChannelsTogether** 사용.
- 원본 메타데이터에서 샘플레이트를 읽고 같은 레이트로 디코딩합니다.
- Worker에서 전체 곡을 분석하고 렌더링한 뒤 완성된 AudioBuffer를 재생합니다. 실시간 DSP를 사용하지 않습니다.
- 16,384프레임 입력 블록 사이에 엔진 상태와 내부 오버랩을 유지합니다.
- 템포는 1배속, 출력 길이는 원본과 동일합니다. 피크는 전체 곡 게인으로 −1.1dBFS 이하로 제한합니다.
- 재생 중 키를 바꾸면 기존 소리를 유지하고, 완료 시 같은 위치에 18ms 페이드로 전환합니다.
- 렌더링 진행률, 최신 요청 취소, 메모리 160MiB 및 IndexedDB 384MiB LRU 캐시를 제공합니다. 메모리 캐시된 키는 즉시 전환합니다. 오래된 키는 용량 한도에 따라 제거될 수 있습니다.

버튼은 **원본 파일 대비 −6~+6반음**을 표시합니다. 남자·여자 버튼은 프리셋으로 유지하며, 여자 키는 남자보다 +5반음 기준입니다. 프리셋을 포함한 총 이동량은 ±6 이내입니다. 초기화는 업로드한 원본의 0키로 돌아갑니다. 업로드 시 원본이 남자/여자 기준인지 선택합니다.

등록 음원은 제공된 −3 파일을 Rubber Band R3 오프라인 +3으로 복원한 남자 원키입니다. 추가 업로드는 현재 브라우저 IndexedDB에, 좋아요·문의는 localStorage에 저장되며 서버 공유·운영자 전송은 하지 않습니다.

## 검증

```sh
npm test
npm run build
# 장시간 실제 음원 검증에는 로컬 FFmpeg가 필요합니다.
MONO_FFMPEG=/path/to/ffmpeg npm run validate:audio
```

- [수정 전 7개 항목 진단 및 설계](docs/dsp-diagnosis.md)
- [3분 10초 MR의 +3 / −3 / +6 전체 곡 검증 로그](reports/audio-validation.json)
- [제공 음원의 남자 원키 복원 로그](reports/master-restoration.json)

자동 검증은 피크·길이·50ms 이상 무음 끊김·블록 경계 및 처음/끝 30초의 신호를 검사합니다. 주관적인 청감 동일성을 보장하는 검사는 아닙니다. 키 이동 폭이 클수록 음색 변화가 들릴 수 있으며 UI에도 안내합니다.

브라우저 개발자 도구의 `[mono:audio-render]` JSON 로그에는 피크, 출력 길이, 처리 시간, 원본/재생 샘플레이트, 캐시 여부와 준비 시간이 남습니다. 예를 들어 원본 44.1kHz/장치 48kHz 환경에서도 DSP는 44.1kHz로 처리하고 최종 재생 시에만 브라우저가 장치 레이트로 변환합니다.

## 배포

Vercel은 `npm run build`로 만든 `dist/`를 배포합니다. GitHub `main` 푸시에 연결되어 있습니다.

- 사이트: https://mono-six-hazel.vercel.app
- `audio/render.mjs`, `audio/worker.mjs`: 전체 곡 DSP
- `audio/decode.mjs`, `audio/cache.mjs`: 원본 레이트 디코딩과 캐시
- `pitch.js`: 완료 버퍼 재생·취소·탐색·페이드
- `prepare-audio.mjs`, `build.mjs`: WASM·라이선스·앱 파일 준비

Rubber Band 및 의존성 출처·라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요.
