import { PitchEngine } from './pitch.js';
const paths={compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',upload:'<path d="M12 15V3m-4 4 4-4 4 4M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',message:'<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V7a4 4 0 0 1 4-4h6a8 8 0 0 1 8 8Z"/><path d="M7 9h9M7 13h6"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',music:'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',headphones:'<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="3" y="12" width="4" height="9" rx="2"/><rect x="17" y="12" width="4" height="9" rx="2"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',play:'<path d="m8 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',prev:'<path d="M6 5v14m12-14L8 12l10 7Z"/>',next:'<path d="M18 5v14M6 5l10 7-10 7Z"/>',shuffle:'<path d="M3 6h3c4 0 6 12 10 12h5m-4-4 4 4-4 4M3 18h3c1 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/>',repeat:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',volume:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>'};
const icon=(name)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.music}</svg>`;
function hydrate(){document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);el.removeAttribute('data-icon')})}
const photo=(id,w=600)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
const songs=[{
 id:'only-you',title:'나에게 그대만이 (Inst.)',artist:'탑현',genre:'발라드',
 mood:'보컬 연습',duration:'3:10',image:'/media/only-you-cover.svg',
 tag:'남자 원키 · INSTRUMENTAL',src:'/media/only-you-original.mp3',originalGender:'male',
 description:'제공된 −3키 반주를 +3반음 올려 남자 원키로 복원했습니다.'
}];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
let likes=read('mono-likes',[]),posts=read('mono-posts',[]),uploads=[],page='discover',genre='전체',query='',current=null,shuffling=false;
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const audio=new PitchEngine(); audio.volume=.65;
const pitchEngine=audio;
let renderProgress={percent:100,phase:'대기',busy:false};
let keyState={voice:'male',offset:0}, keyRevision=0, keyBusy=false;
const trackKeys=new Map();
const allSongs=()=>[...uploads,...songs];
const persist=()=>{localStorage.setItem('mono-likes',JSON.stringify(likes));localStorage.setItem('mono-posts',JSON.stringify(posts));updateCounts()};
const toast=message=>{$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3400)};
let db; const ready=new Promise((resolve,reject)=>{const req=indexedDB.open('mono-library',1);req.onupgradeneeded=()=>req.result.createObjectStore('tracks',{keyPath:'id'});req.onsuccess=()=>{db=req.result;const read=db.transaction('tracks').objectStore('tracks').getAll();read.onsuccess=()=>{uploads=read.result.map(s=>({...s,src:URL.createObjectURL(s.file)}));updateCounts();resolve()};read.onerror=reject};req.onerror=reject});
function updateCounts(){likes=likes.filter(id=>!/^s[1-8]$/.test(id));$('#likeCount').textContent=likes.length;$('#uploadCount').textContent=uploads.length}
function heading(eyebrow,title,description,action=''){return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`}
function card(s){return `<article class="album-card"><div class="album-art" tabindex="0" role="button" aria-label="${esc(s.title)} 재생" data-play="${s.id}"><img src="${s.image}" alt="${esc(s.title)} 커버" loading="lazy"><span class="album-tag">${s.tag||'YOUR ORIGINAL'}</span><span class="art-play">${icon('play')}</span></div><div class="album-info"><div><h3>${esc(s.title)}</h3><p>${esc(s.artist)}</p></div><button class="icon-button ${likes.includes(s.id)?'is-liked':''}" data-like="${s.id}" aria-label="${esc(s.title)} 좋아요" aria-pressed="${likes.includes(s.id)}">${icon('heart')}</button></div><div class="album-bottom"><span>${esc(s.genre)}</span><i></i><span>${esc(s.mood||'나만의 음악')}</span>${page==='myuploads'?`<button class="text-button" style="margin-left:auto;font-size:8px" data-delete-track="${s.id}" aria-label="${esc(s.title)} 삭제">삭제</button>`:''}</div></article>`}
function track(s,i){return `<div class="track-row"><span class="track-number">${String(i+1).padStart(2,'0')}</span><img src="${s.image}" alt=""><button class="track-name" data-play="${s.id}"><strong>${esc(s.title)}</strong><span>${esc(s.artist)}</span></button><span class="track-duration">${s.duration}</span><button class="icon-button ${likes.includes(s.id)?'is-liked':''}" data-like="${s.id}" aria-label="${esc(s.title)} 좋아요">${icon('heart')}</button><button class="icon-button" data-play="${s.id}" aria-label="${esc(s.title)} 재생">${icon('play')}</button></div>`}
function empty(title,detail,ico='music'){return `<div class="empty-state">${icon(ico)}<h3>${title}</h3><p>${detail}</p></div>`}
function render(){
 document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
 let content='';
 if(page==='discover'){
 const featured=songs[0];
 content=heading('YOUR VOICE. YOUR KEY.','당신의 목소리에 맞춰.','좋아하는 반주를, 가장 편안한 키로 불러보세요.','<div class="date-stamp"><i></i> 01 TRACK, ALL YOURS</div>')+
 `<section class="hero song-hero"><div class="hero-copy"><span class="hero-badge">${icon('music')} INSTRUMENTAL · 남자 원키</span><h2>나에게<br>그대만이.</h2><p>탑현 · Instrumental<br>오롯이 당신의 목소리로 완성하는 한 곡.</p><button class="primary-button" data-play="${featured.id}">${icon('play')} 반주 재생하기</button><span class="hero-length">03:10 · ORIGINAL KEY</span></div><img class="featured-cover" src="${featured.image}" alt="나에게 그대만이 반주 커버"><div class="hero-meta"><span>01</span><div><small>YOUR NEXT FAVORITE KEY</small>한 곡, 당신만의 수많은 가능성.</div></div></section>`+
 `<section class="practice-section"><div class="section-head"><div class="section-title"><h2>나에게 맞는 키 찾기</h2><span>속도는 그대로, 음정만 가볍게.</span></div><span class="practice-label">PRACTICE, YOUR WAY</span></div>${keyControls()}</section>`+
 `<section class="registered-section"><div class="section-head"><div class="section-title"><h2>등록된 음악</h2><span>1곡 · 남자 원키 반주</span></div><button class="text-button" data-page="search">음악 검색 ${icon('arrow')}</button></div><div class="tracks">${track(featured,0)}</div></section>`;
 }else if(page==='search'){
 const list=allSongs().filter(s=>`${s.title} ${s.artist} ${s.genre} ${s.mood}`.toLowerCase().includes(query.toLowerCase()));
 content=heading('FIND YOUR FREQUENCY','당신의 취향을 찾아서','곡, 아티스트, 장르로 원하는 음악을 발견하세요.')+`<input class="large-search" id="pageSearch" placeholder="곡명, 아티스트, 장르 검색" value="${esc(query)}" aria-label="곡명 아티스트 장르 검색"><div class="results-count">${query?`‘${esc(query)}’ 검색 결과`:'모든 음악'} <strong>${list.length}</strong>곡</div><div class="search-results">${list.map(card).join('')}</div>${list.length?'':empty('아직 찾는 음악이 없어요.','다른 곡명이나 아티스트, 장르로 검색해보세요.','search')}`;
 }else if(page==='likes'||page==='myuploads'){
 const list=page==='likes'?allSongs().filter(s=>likes.includes(s.id)):uploads;
 content=heading('YOUR PERSONAL COLLECTION',page==='likes'?'좋아하는 음악, 한곳에.':'당신이 들려준 음악',page==='likes'?'마음에 닿았던 음악들을 다시 만나보세요.':'직접 올린 음악을 언제든 다시 들어보세요.',page==='myuploads'?'<button class="primary-button" data-page="upload">+ 음악 업로드</button>':'')+(list.length?`<div class="search-results">${list.map(card).join('')}</div>`:empty(page==='likes'?'첫 번째 좋아요를 기다리고 있어요.':'아직 올린 음악이 없어요.',page==='likes'?'음악 옆 하트를 눌러 나만의 컬렉션을 만들어보세요.':'노래 업로드에서 당신의 음악을 들려주세요.',page==='likes'?'heart':'upload'));
 }else if(page==='upload'){
 content=heading('EVERY SOUND HAS A STORY','당신의 음악을 들려주세요.','방 안에서 시작된 작은 멜로디가, 누군가의 일상이 될 수 있어요.')+`<form id="uploadForm" class="surface"><div class="upload-zone" id="dropZone" role="button" tabindex="0" aria-label="오디오 파일 선택">${icon('upload')}<h3 id="fileTitle">음악 파일을 여기에 놓아주세요</h3><p id="fileDescription">또는 아래 버튼을 눌러 파일을 선택하세요.<br>MP3, WAV, M4A, OGG · 최대 50MB</p><button type="button" class="primary-button" id="selectFile">파일 선택하기</button><input type="file" id="audioFile" accept="audio/*,.mp3,.wav,.m4a,.ogg" hidden></div><div class="form-grid"><label class="field">곡 제목<input name="title" required maxlength="80" placeholder="음악의 제목을 알려주세요"></label><label class="field">아티스트<input name="artist" required maxlength="50" placeholder="당신의 아티스트 이름"></label><label class="field">장르<select name="genre"><option>발라드</option><option>인디</option><option>R&B</option><option>재즈</option><option>로파이</option><option>어쿠스틱</option><option>기타</option></select></label><label class="field">분위기<select name="mood"><option>차분한 아침</option><option>느긋한 오후</option><option>집중이 필요할 때</option><option>밤의 끝에서</option></select></label><label class="field">원본 음원 기준<select name="originalGender"><option value="male">남자 키</option><option value="female">여자 키</option></select></label><div class="upload-key-note">업로드한 원본 음원이 0키입니다.<br>남자·여자 프리셋과 원본 대비 ±6키를 조절할 수 있어요.</div><label class="field full">음악 이야기 (선택)<textarea name="description" placeholder="이 음악에 담긴 이야기가 있나요?" maxlength="1000"></textarea></label></div><div class="form-actions"><p>내가 만든 음악을 업로드해주세요.<br>파일은 이 브라우저에 저장됩니다.</p><button class="primary-button" type="submit">${icon('upload')} 음악 업로드</button></div></form>`;
 }else if(page==='board'){
 content=heading('WE’RE ALL EARS','무엇이든 이야기해주세요.','궁금한 점, 새로운 아이디어, 작은 불편함까지. mono가 귀 기울일게요.','<button class="primary-button" id="writePost">문의 작성 '+icon('message')+'</button>')+`<div class="surface"><div class="section-head"><div class="section-title"><h2>문의게시판</h2><span>총 ${posts.length}개의 문의</span></div><span class="eyebrow" style="font-size:8px">LET’S TALK</span></div><div class="board-list"><button class="board-row" id="faq"><span class="status-badge">이용 안내</span><div><strong>mono가 처음이신가요? 자주 묻는 질문</strong><small>mono team</small></div><span>2026.10.24</span><span>안내</span></button>${posts.map(p=>`<button class="board-row" data-post="${p.id}"><span class="status-badge" style="background:#efeee8;color:#90866c!important">저장됨</span><div><strong>${esc(p.title)}</strong><small>${esc(p.category)} · Music lover</small></div><span>${p.date}</span><span>내 문의</span></button>`).join('')}</div><div class="help-note">이 로컬 데모에서 작성한 문의는 현재 브라우저에 저장됩니다. 운영자에게 전송되지는 않습니다.</div></div>`;
 }
 $('#main').innerHTML=`<div class="fade-in">${content}</div>`;hydrate();syncKeyUI();if(page==='upload')bindUpload();if(page==='search')$('#pageSearch').addEventListener('input',e=>{const position=e.target.selectionStart;query=e.target.value;$('#globalSearch').value=query;render();$('#pageSearch').focus();$('#pageSearch').setSelectionRange(position,position)});
}
function navigate(next){page=next;if(next!=='search')query='';$('#globalSearch').value=query;render();window.scrollTo({top:0,behavior:'smooth'})}
function toggleLike(id){likes=likes.includes(id)?likes.filter(x=>x!==id):[...likes,id];persist();document.querySelectorAll(`[data-like="${id}"]`).forEach(b=>{b.classList.toggle('is-liked',likes.includes(id));b.setAttribute('aria-pressed',likes.includes(id))});if(current?.id===id)$('#playerLike').classList.toggle('is-liked',likes.includes(id));if(page==='likes')render()}
function voicePreset(voice) {
  return (voice==='female'?5:0) - (current?.originalGender==='female'?5:0);
}
function effectiveKey() { return keyState.offset; }
function signedKey(value) { return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'; }
function keyControls() {
  return `<div class="key-panel" aria-label="음정 조절 패널">
    <div class="key-panel-top"><div><span class="eyebrow">KEY CONTROL</span><h3 data-key-track>${esc(current?.title || songs[0].title)}</h3></div><div class="voice-toggle" role="group" aria-label="보컬 기준 선택"><button data-voice="male" aria-pressed="true">남자 키</button><button data-voice="female" aria-pressed="false">여자 키 <small>남자 +5</small></button></div></div>
    <div class="key-adjust"><div><span class="key-caption">원본 음원 기준</span><div class="key-readout"><button data-key-step="-1" class="key-circle" aria-label="음정 1키 내리기">−</button><div><output data-key-output aria-live="polite">0</output><span>KEY</span></div><button data-key-step="1" class="key-circle" aria-label="음정 1키 올리기">+</button></div><span class="key-result" data-key-effective>남자 원키 기준 0반음</span></div><div class="key-scale-area"><div class="key-scale-labels"><span>LOWER</span><span>반음 단위로 조절</span><span>HIGHER</span></div><div class="key-scale" role="group" aria-label="마이너스 6키부터 플러스 6키까지">${Array.from({length:13},(_,i)=>i-6).map(n=>`<button data-key-value="${n}" aria-label="${n===0?'기준 0키':signedKey(n)+'키'}" aria-pressed="${n===0}"><i></i><span>${signedKey(n)}</span></button>`).join('')}</div><div class="key-scale-bottom"><span data-key-summary>남자 · 원키</span><button class="text-button" data-key-reset>원본 키로 초기화 ↺</button></div></div></div>
    <div class="render-progress" data-render-progress hidden><div><span data-render-phase>고품질 렌더링</span><strong data-render-percent>0%</strong></div><progress max="100" value="0" data-render-bar aria-label="음원 렌더링 진행률"></progress><small>완료되면 같은 재생 위치에 적용돼요. 같은 키는 캐시에서 바로 불러옵니다.</small></div>
    <p class="key-quality-note">키 이동 폭이 클수록 음색 변화가 들릴 수 있어요.</p>
    <div class="key-panel-note"><span>${icon('headphones')} 템포 유지 · 원본 기준 ±6반음</span><span data-key-status role="status">원키로 준비됐어요.</span></div>
  </div>`;
}
function syncKeyUI() {
  const voice = keyState.offset===voicePreset('male')?'남자 키':keyState.offset===voicePreset('female')?'여자 키':'맞춤 키';
  document.querySelectorAll('[data-voice]').forEach(button => button.setAttribute('aria-pressed', String(keyState.offset===voicePreset(button.dataset.voice))));
  document.querySelectorAll('[data-key-output]').forEach(output => { output.textContent = signedKey(keyState.offset); });
  document.querySelectorAll('[data-key-summary]').forEach(el => { el.textContent = `${voice} · ${keyState.offset === 0 ? '원본' : '원본 '+signedKey(keyState.offset)+'키'}`; });
  document.querySelectorAll('[data-key-effective]').forEach(el => { el.textContent = `원본 ${current?.originalGender === 'female' ? '여자' : '남자'} 키 기준 ${signedKey(effectiveKey())}반음`; });
  document.querySelectorAll('[data-key-track]').forEach(el => { el.textContent = current?.title || songs[0].title; });
  document.querySelectorAll('[data-key-value]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.keyValue) === keyState.offset)));
  document.querySelectorAll('[data-key-step]').forEach(button => { button.disabled = Number(button.dataset.keyStep) < 0 ? keyState.offset <= -6 : keyState.offset >= 6; });
  document.querySelectorAll('[data-key-status]').forEach(el => {
    el.textContent = renderProgress.busy ? `${renderProgress.phase} ${renderProgress.percent}%` : keyBusy ? '키 준비 중…' : renderProgress.phase==='캐시 사용'?'캐시에서 즉시 준비됐어요.':`원본 ${signedKey(effectiveKey())}키 · 재생 준비 완료`;
  });
  document.querySelectorAll('[data-render-progress]').forEach(el=>{el.hidden=!renderProgress.busy});
  document.querySelectorAll('[data-render-phase]').forEach(el=>{el.textContent=renderProgress.phase});
  document.querySelectorAll('[data-render-percent]').forEach(el=>{el.textContent=`${renderProgress.percent}%`});
  document.querySelectorAll('[data-render-bar]').forEach(el=>{el.value=renderProgress.percent});
  document.querySelectorAll('[data-dock-render]').forEach(el=>{el.hidden=!renderProgress.busy;el.textContent=`${renderProgress.phase} ${renderProgress.percent}%`});
}
async function changeKey(next) {
  if (!current) selectSong(songs[0]);
  const offset=next.voice?voicePreset(next.voice):next.offset??keyState.offset;
  keyState = { voice: next.voice ?? keyState.voice, offset: Math.max(-6,Math.min(6,offset)) };
  const revision = ++keyRevision;
  keyBusy = true;
  syncKeyUI();
  try {
    await pitchEngine.initialize();
    if (revision !== keyRevision) return;
    await pitchEngine.setPitch(effectiveKey());
    if (revision !== keyRevision) return;
    trackKeys.set(current.id, { ...keyState });
  } catch (error) {
    if (revision !== keyRevision) return;
    keyState = { ...(trackKeys.get(current.id) || { voice: current.originalGender || 'male', offset: 0 }) };
    toast(error.message || '키를 조절하지 못했어요. 다시 시도해주세요.');
  } finally {
    if (revision === keyRevision) { keyBusy = false; syncKeyUI(); }
  }
}
document.addEventListener('click', event => {
  const voice = event.target.closest('[data-voice]');
  const step = event.target.closest('[data-key-step]');
  const key = event.target.closest('[data-key-value]');
  if (voice) changeKey({ voice: voice.dataset.voice });
  if (step) changeKey({ offset: keyState.offset + Number(step.dataset.keyStep) });
  if (key) changeKey({ offset: Number(key.dataset.keyValue) });
  if (event.target.closest('[data-key-reset]')) changeKey({ offset: 0 });
  if (event.target.closest('#openKeyPanel')) {
    showModal(`<div class="modal-heading"><h2>나에게 맞는 키 찾기</h2><button data-close aria-label="닫기">×</button></div>${keyControls()}`);
    syncKeyUI();
  }
});
audio.addEventListener('renderprogress', event => { renderProgress=event.detail; syncKeyUI(); });
audio.addEventListener('playpending',()=>{ $('#playPause').innerHTML=icon('pause');$('#playPause').setAttribute('aria-label','재생 취소'); });
function selectSong(s) {
  if(current?.id===s.id)return;
  keyRevision++;
  keyBusy=false;
  current=s;
  keyState={...(trackKeys.get(s.id)||{voice:s.originalGender||'male',offset:0})};
  audio.src=s.src;
  $('#playerCover').src=s.image;
  $('#playerTitle').textContent=s.title;
  $('#playerArtist').textContent=s.artist;
  $('#duration').textContent=s.duration;
  $('#playerLike').classList.toggle('is-liked',likes.includes(s.id));
  syncKeyUI();
}
async function playSong(id){
 const s=allSongs().find(s=>s.id===id);if(!s)return;
 if(current?.id===id){await togglePlay();return}
 selectSong(s);await startPlayback();
}
async function startPlayback(){
 try{await audio.play(effectiveKey())}
 catch(error){if(error.name!=='AbortError')toast(error.message||'오디오를 불러오지 못했어요. 다시 시도해주세요.')}
}
async function togglePlay(){
 if(!current)selectSong(songs[0]);
 if(audio.paused&&!audio.pendingPlay)await startPlayback();else audio.pause();
}
function skip(delta){
 const list=allSongs();
 if(list.length===1){audio.currentTime=0;startPlayback();return}
 const index=list.findIndex(s=>s.id===current?.id);
 const next=shuffling?Math.floor(Math.random()*list.length):(index+delta+list.length)%list.length;
 if(list[next].id===current?.id){audio.currentTime=0;startPlayback()}else playSong(list[next].id);
}
function formatTime(s){return Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00'}
audio.addEventListener('play',()=>{$('#playPause').innerHTML=icon('pause');$('#playPause').setAttribute('aria-label','일시정지')});audio.addEventListener('pause',()=>{$('#playPause').innerHTML=icon('play');$('#playPause').setAttribute('aria-label','재생')});audio.addEventListener('timeupdate',()=>{$('#elapsed').textContent=formatTime(audio.currentTime);$('#duration').textContent=formatTime(audio.duration);$('#progress').value=audio.duration?audio.currentTime/audio.duration*100:0});audio.addEventListener('ended',()=>{if(!audio.loop)skip(1)});
$('#playPause').onclick=togglePlay;$('#next').onclick=()=>skip(1);$('#prev').onclick=()=>skip(-1);$('#progress').oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*e.target.value/100};$('#volume').oninput=e=>audio.volume=Number(e.target.value);$('#repeat').onclick=e=>{audio.loop=!audio.loop;e.currentTarget.classList.toggle('active-control',audio.loop);e.currentTarget.setAttribute('aria-pressed',audio.loop);toast(audio.loop?'한 곡 반복을 켰어요.':'한 곡 반복을 껐어요.')};$('#shuffle').onclick=e=>{shuffling=!shuffling;e.currentTarget.classList.toggle('active-control',shuffling);e.currentTarget.setAttribute('aria-pressed',shuffling);toast(shuffling?'셔플 재생을 켰어요.':'셔플 재생을 껐어요.')};$('#playerLike').onclick=()=>{if(current)toggleLike(current.id);else toast('먼저 음악을 선택해주세요.')};$('#queue').onclick=()=>showModal(`<div class="modal-heading"><h2>재생목록</h2><button data-close aria-label="닫기">×</button></div>${allSongs().map(track).join('')}`);$('#notificationButton').onclick=()=>toast('새로운 알림이 없어요. 편안하게 음악을 즐겨보세요.');
let searchTimer;$('#globalSearch').oninput=e=>{query=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page='search';render()},180)};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();$('#globalSearch').focus()}if(e.key==='Enter'&&e.target.matches('[data-play]'))playSong(e.target.dataset.play)});
document.addEventListener('click',e=>{const nav=e.target.closest('[data-page]'),play=e.target.closest('[data-play]'),like=e.target.closest('[data-like]'),filter=e.target.closest('[data-genre]');const removeTrack=e.target.closest('[data-delete-track]');if(removeTrack)deleteTrack(removeTrack.dataset.deleteTrack);if(nav){e.preventDefault();navigate(nav.dataset.page)}if(play)playSong(play.dataset.play);if(like)toggleLike(like.dataset.like);if(filter){genre=filter.dataset.genre;render()}if(e.target.closest('#writePost'))writePost();if(e.target.closest('[data-close]'))$('#modal').close();const del=e.target.closest('[data-delete-post]');if(del){posts=posts.filter(p=>p.id!==del.dataset.deletePost);persist();$('#modal').close();render();toast('문의가 삭제되었어요.')} if(e.target.closest('#faq'))showModal('<div class="modal-heading"><h2>처음 오신 것을 환영해요.</h2><button data-close aria-label="닫기">×</button></div><div class="modal-body"><strong>음악을 어떻게 검색하나요?</strong>\n상단 검색창에서 제목, 아티스트 또는 장르를 입력하세요.\n\n<strong>어떤 음악을 업로드할 수 있나요?</strong>\n직접 만든 50MB 이하 MP3, WAV, M4A, OGG 파일을 업로드할 수 있어요. 음악과 좋아요는 현재 브라우저에 저장됩니다.\n\n<strong>남자·여자 키는 어떻게 다른가요?</strong>\n여자 키는 남자 키보다 5반음 높은 기준입니다. 버튼은 원본 음원 대비 −6~+6반음을 표시합니다. 남자·여자 버튼은 권장 키를 선택하는 프리셋이며 재생 속도는 유지됩니다. 업로드 시 원본이 남자 키인지 여자 키인지 선택해주세요.\n\n<strong>문의가 운영자에게 전달되나요?</strong>\n현재는 로컬 데모입니다. 문의는 이 브라우저에만 저장되며, 실제 전송이나 답변 기능은 연결되어 있지 않습니다.</div>');const post=e.target.closest('[data-post]');if(post){const p=posts.find(x=>x.id===post.dataset.post);showModal(`<div class="modal-heading"><h2>${esc(p.title)}</h2><button data-close aria-label="닫기">×</button></div><div class="eyebrow">${esc(p.category)} · ${p.date}</div><div class="modal-body">${esc(p.body)}</div><div class="answer">이 문의는 브라우저에 저장된 로컬 데모입니다. 운영자에게 전송되지 않았습니다.</div><div class="form-actions"><span></span><button class="text-button" data-delete-post="${p.id}">내 문의 삭제</button></div>`)}});
function showModal(html){$('#modalContent').innerHTML=html;$('#modal').showModal()}
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
function writePost(){showModal(`<div class="modal-heading"><h2>이야기를 남겨주세요.</h2><button data-close aria-label="닫기">×</button></div><form id="postForm"><div class="field"><label for="category">문의 유형</label><select name="category" id="category"><option>이용 문의</option><option>음악 업로드</option><option>오류 제보</option><option>아이디어 제안</option></select></div><div class="field" style="margin-top:18px"><label for="postTitle">제목</label><input id="postTitle" name="title" required maxlength="100" placeholder="어떤 이야기를 나누고 싶으신가요?"></div><div class="field" style="margin-top:18px"><label for="postBody">내용</label><textarea id="postBody" name="body" required maxlength="5000" placeholder="자유롭게 적어주세요."></textarea></div><div class="form-actions"><p>현재 브라우저에만 저장되는 데모입니다.</p><button class="primary-button" type="submit">문의 저장</button></div></form>`);$('#postForm').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);if(!data.get('title').trim()||!data.get('body').trim()){toast('제목과 내용을 입력해주세요.');return}posts.unshift({id:crypto.randomUUID(),title:data.get('title').trim(),body:data.get('body').trim(),category:data.get('category'),date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()).replaceAll('-','.')});persist();$('#modal').close();render();toast('문의가 이 브라우저에 저장되었어요.')}}
let selectedFile=null;
function bindUpload(){selectedFile=null;const zone=$('#dropZone'),input=$('#audioFile');zone.onclick=e=>{if(e.target!==input)input.click()};zone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};input.onchange=()=>chooseFile(input.files[0]);zone.ondragover=e=>{e.preventDefault();zone.classList.add('dragover')};zone.ondragleave=()=>zone.classList.remove('dragover');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragover');chooseFile(e.dataTransfer.files[0])};$('#uploadForm').onsubmit=async e=>{e.preventDefault();if(!selectedFile){toast('먼저 음악 파일을 선택해주세요.');return}const data=new FormData(e.target);if(!data.get('title').trim()||!data.get('artist').trim()){toast('제목과 아티스트를 입력해주세요.');return}const button=e.target.querySelector('[type=submit]');button.disabled=true;button.textContent='저장하는 중…';try{await ready;const src=URL.createObjectURL(selectedFile);const duration=await new Promise(resolve=>{const probe=new Audio();const timer=setTimeout(()=>{probe.src='';resolve('0:00')},4000);probe.onloadedmetadata=()=>{clearTimeout(timer);resolve(formatTime(probe.duration));probe.src=''};probe.onerror=()=>{clearTimeout(timer);resolve(null)};probe.src=src});if(duration===null){URL.revokeObjectURL(src);throw Error('decode')}const record={id:crypto.randomUUID(),title:data.get('title').trim(),artist:data.get('artist').trim(),originalGender:data.get('originalGender'),genre:data.get('genre'),mood:data.get('mood'),description:data.get('description'),image:photo('photo-1470252649378-9c29740c9fa8'),duration,tag:'YOUR ORIGINAL',file:selectedFile};await new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').add(record);tx.oncomplete=resolve;tx.onerror=reject});uploads.unshift({...record,src});updateCounts();navigate('myuploads');toast('당신의 음악이 라이브러리에 추가되었어요.')}catch(err){toast(err.message==='decode'?'재생할 수 없는 파일이에요. 다른 오디오 파일을 선택해주세요.':'저장 공간이 부족하거나 브라우저 저장소를 사용할 수 없어요.');button.disabled=false;button.innerHTML=icon('upload')+' 음악 업로드'}}}
function chooseFile(file){if(!file)return;if(!/\.(mp3|wav|m4a|ogg)$/i.test(file.name)){toast('MP3, WAV, M4A, OGG 파일을 선택해주세요.');return}if(file.size>50*1024*1024){toast('50MB 이하 파일을 선택해주세요.');return}selectedFile=file;$('#fileTitle').textContent=file.name;$('#fileDescription').textContent=`${(file.size/1024/1024).toFixed(2)} MB · 업로드 준비 완료`;$('[name=title]').value=file.name.replace(/\.[^.]+$/,'');$('#selectFile').textContent='다른 파일 선택'}
selectSong(songs[0]);hydrate();render();updateCounts();ready.then(()=>{if(page==='myuploads'||page==='likes'||page==='search')render()}).catch(()=>toast('브라우저 저장소를 사용할 수 없어 업로드가 제한됩니다.'));

async function deleteTrack(id) {
 try {
  await ready;
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('tracks','readwrite');
   tx.objectStore('tracks').delete(id);tx.oncomplete=resolve;tx.onerror=reject;
  });
  const song=uploads.find(s=>s.id===id);
  if(current?.id===id){
   audio.pause();selectSong(songs[0]);
   $('#progress').value=0;$('#elapsed').textContent='0:00';
  }
  if(song)URL.revokeObjectURL(song.src);
  uploads=uploads.filter(s=>s.id!==id);likes=likes.filter(x=>x!==id);
  trackKeys.delete(id);persist();render();toast('업로드한 음악이 삭제되었어요.');
 } catch { toast('파일을 삭제하지 못했어요. 다시 시도해주세요.'); }
}
