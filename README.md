# mono

블랙·화이트 중심의 반주 연습 웹앱입니다. 둘러보기에는 탑현의 **나에게 그대만이 (Inst.)** 한 곡만 제공합니다.

## 실행

```sh
npm ci
npm run dev
```

http://localhost:3000 에서 확인합니다. SoundTouch의 브라우저 모듈은 실행 전 자동으로 준비됩니다.

## 반주와 키 조절

- 제공된 −3키 MP3를 +3반음 올린 `media/only-you-original.mp3`가 남자 원키(0)입니다.
- 남자 키는 원키, 여자 키는 남자 원키보다 +5반음 높은 기준입니다.
- 각 기준에서 −5~+5반음을 조절할 수 있습니다. 여자 기준 +5는 남자 원키보다 +10반음입니다.
- 재생 속도는 1배속으로 유지하고 SoundTouch AudioWorklet에서 음정만 변경합니다.
- 현재 곡과 설정은 둘러보기 패널, 하단 컨트롤, 키 조절 팝업에서 동기화됩니다.
- 새 파일을 올릴 때 원본 남자/여자 키를 선택합니다. 업로드한 파일에도 같은 키 조절을 적용합니다.
- 곡을 바꾸면 해당 곡의 세션 내 설정으로 복원합니다. 초기화는 선택한 남자/여자 기준의 0키로 돌아갑니다.

이 반주 파일과 커버는 사이트에 포함되어 모든 방문자에게 제공됩니다. 사용자가 웹앱에서 추가한 파일은 IndexedDB에, 좋아요·문의는 localStorage에 저장됩니다. 추가 업로드와 문의는 현재 브라우저에만 보관되며 서버 동기화나 운영자 전송은 지원하지 않습니다.

## 검증

```sh
npm test
npm run build
```

오디오 테스트는 실제 배포되는 Worklet에 440Hz 신호를 입력하여 −10, −5, 0, +5, +10반음의 출력 주파수와 유효 신호를 검사합니다. ±10은 원본 여자/남자 기준을 전환할 때 가능한 최대 이동량을 포함합니다. 앱은 HTTPS 또는 localhost와 AudioWorklet을 지원하는 최신 브라우저에서 동작합니다.

## 배포

Vercel은 `npm run build`로 생성한 `dist/`를 배포합니다. GitHub `main` 브랜치 푸시는 프로덕션 자동 배포로 연결됩니다.

- 사이트: https://mono-six-hazel.vercel.app
- `build.mjs`: 앱, 음원, 커버, SoundTouch 모듈 복사
- `vercel.json`: 정적 빌드 및 응답 헤더 설정
- `server.mjs`: 로컬 서버와 오디오 Range 요청 지원

음정 처리는 [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS)의 MPL-2.0 모듈을 사용하며 배포 파일에 라이선스를 포함합니다. 폰트는 Google Fonts, 추가 업로드의 기본 커버는 Unsplash에서 불러옵니다.
