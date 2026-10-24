# 나에게 그대만이 (Inst.)

사용자가 제공한 `(-3) 탑현_나에게 그대만이 (Inst.).mp3`에서 남자 원키로 복원했습니다.

- 엔진: Rubber Band 3.3.0 WASM, R3 Finer, Offline, PitchHighQuality, ChannelsTogether
- 피치: +3반음, timeRatio=1
- 레이트: 원본 44.1kHz, 스테레오
- 원본/렌더 출력: 8,413,056프레임 (190.772244898초), 오차 0
- 피크: 전체 곡 정규화로 −1.1dBFS 제한 후 320kbps MP3 인코딩
- 실제 출력 로그: `reports/master-restoration.json`

기존 `asetrate + atempo` 변환을 재사용하지 않고 첨부 원본에서 다시 처리했습니다. 복원에 쓴 코드는 `scripts/restore-master.mjs`입니다. 이후 키 변경 시에는 디코딩한 이 원키 파일에서 각 키를 독립 렌더링하며 다른 키의 결과를 다시 변환하지 않습니다.

`only-you-cover.svg`는 mono용 벡터 커버입니다.
