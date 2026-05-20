"use strict";

const DOM = {
  timerContainer: document.getElementById("timerContainer"),
  playerCard:     document.querySelector(".player-card"),
  songTitle:      document.getElementById("songTitle"),
  songArtist:     document.getElementById("songArtist"),
  audio:          document.getElementById("audioPlayer"),
  
  progressBar:    document.getElementById("progressBar"),
  progressFill:   document.getElementById("progressFill"),
  timeCurrent:    document.getElementById("timeCurrent"),
  timeTotal:      document.getElementById("timeTotal"),
  
  btnPlay:        document.getElementById("btnPlay"),
  btnPrev:        document.getElementById("btnPrev"),
  btnNext:        document.getElementById("btnNext"),
  btnHeart:       document.getElementById("btnHeart"),
  btnPoetry:      document.getElementById("btnPoetry"),
  btnTimer:       document.getElementById("btnTimer"),
  timerModal:     document.getElementById("timerModal"),
  timerModalBackdrop: document.getElementById("timerModalBackdrop"),
  btnTimerClose:  document.getElementById("btnTimerClose"),
  btnTimerCancel: document.getElementById("btnTimerCancel"),
  btnTimerSet:    document.getElementById("btnTimerSet"),
  drumHours:      document.getElementById("drumHours"),
  drumMinutes:    document.getElementById("drumMinutes"),
  timerCountdown: document.getElementById("timerCountdown"),
  
  volumeBar:      document.getElementById("volumeBar"),
  categoryNav:    document.getElementById("categoryNav"),
  songList:       document.getElementById("songList"),
  playlistEmpty:  document.getElementById("playlistEmpty"),
  
  sliderTrack:    document.getElementById("coverSliderTrack"),
  coverDots:      document.getElementById("coverDots"),
  poetryModal:    document.getElementById("poetryModal"),
  closeModal:     document.querySelector(".close-modal"),
  
  get coverImgs() { return Array.from({ length: 13 }, (_, i) => document.getElementById(`coverImg${i}`)); },
  get dots() { return Array.from(document.querySelectorAll(".dot")); },
};

const STATE = {
  activeCategoryId: null,
  currentSongIndex: 0,
  isPlaying: false,
  isSeeking: false,
  currentDotIndex: 0,
  sleepTimerId: null,
  countdownIntervalId: null,
  sleepEndTime: null,
};

function init() {
  renderCategoryTabs();
  if (MUSIC_DATA.length > 0) selectCategory(MUSIC_DATA[0].id);
  DOM.audio.volume = parseFloat(DOM.volumeBar.value);
  syncVolumeBarStyle();
  attachEventListeners();
}

function renderCategoryTabs() {
  DOM.categoryNav.innerHTML = "";
  MUSIC_DATA.forEach((category) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.dataset.category = category.id;
    btn.textContent = category.label;
    btn.addEventListener("click", () => selectCategory(category.id));
    DOM.categoryNav.appendChild(btn);
  });
}

function selectCategory(categoryId) {
  const category = getCategoryById(categoryId);
  if (!category) return;
  STATE.activeCategoryId = categoryId;
  STATE.currentSongIndex = 0;
  
  DOM.categoryNav.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === categoryId);
  });
  
  loadCoverImages(category.covers);
  renderSongList(category);
  loadSong(categoryId, 0, false);
}

function renderSongList(category) {
  DOM.songList.innerHTML = "";
  if (!category.songs || category.songs.length === 0) {
    DOM.playlistEmpty.style.display = "block";
    return;
  }
  DOM.playlistEmpty.style.display = "none";
  
  category.songs.forEach((song, index) => {
    const li = document.createElement("li");
    li.className = "song-item";
    li.dataset.songIndex = index;
    li.innerHTML = `
      <div class="song-item__num"><span class="song-item__num-text">${index + 1}</span><span class="eq-bars"><span></span><span></span><span></span></span></div>
      <div class="song-item__info"><span class="song-item__title">${escapeHTML(song.title)}</span><span class="song-item__artist">${escapeHTML(song.artist)}</span></div>
      <div class="song-item__duration">${song.duration || "--:--"}</div>
    `;
    li.addEventListener("click", () => loadSong(category.id, index, true));
    DOM.songList.appendChild(li);
  });
}

function highlightActiveSongItem(index, isPlaying) {
  DOM.songList.querySelectorAll(".song-item").forEach((li) => {
    const liIndex = parseInt(li.dataset.songIndex, 10);
    li.classList.toggle("active", liIndex === index);
    li.classList.toggle("playing", liIndex === index && isPlaying);
  });
}

function loadSong(categoryId, songIndex, autoPlay = false) {
  const category = getCategoryById(categoryId);
  const song = category?.songs[songIndex];
  if (!song) return;
  
  STATE.activeCategoryId = categoryId;
  STATE.currentSongIndex = songIndex;
  
  DOM.audio.src = song.src;
  DOM.audio.load();
  DOM.songTitle.textContent = song.title;
  DOM.songArtist.textContent = song.artist;
  
  DOM.progressBar.value = 0;
  DOM.timeCurrent.textContent = "0:00";
  DOM.timeTotal.textContent = song.duration || "0:00";
  setProgressFill(0);
  highlightActiveSongItem(songIndex, autoPlay);
  
  if (autoPlay) playAudio();
  else setPlayingState(false);
}

function playAudio() {
  DOM.audio.play().then(() => setPlayingState(true)).catch(err => setPlayingState(false));
}

function pauseAudio() {
  DOM.audio.pause();
  setPlayingState(false);
}

function togglePlayPause() {
  if (STATE.isPlaying) pauseAudio();
  else {
    if (!DOM.audio.src || DOM.audio.src === window.location.href) {
      if (MUSIC_DATA[0]?.songs.length > 0) loadSong(MUSIC_DATA[0].id, 0, true);
    } else playAudio();
  }
}

function setPlayingState(playing) {
  STATE.isPlaying = playing;
  DOM.playerCard.classList.toggle("is-playing", playing);
  DOM.btnPlay.setAttribute("aria-pressed", String(playing));
  highlightActiveSongItem(STATE.currentSongIndex, playing);
}

function playNext() {
  const category = getCategoryById(STATE.activeCategoryId);
  if (!category) return;
  const total = category.songs.length;
  let nextIndex = STATE.currentSongIndex + 1;
  
  if (nextIndex >= total) {
    const currentCatIndex = MUSIC_DATA.findIndex(c => c.id === STATE.activeCategoryId);
    const nextCatIndex = currentCatIndex + 1;
    if (nextCatIndex < MUSIC_DATA.length) {
      selectCategory(MUSIC_DATA[nextCatIndex].id);
      playAudio(); 
    } else {
      selectCategory(MUSIC_DATA[0].id);
      playAudio();
    }
    return;
  }
  loadSong(STATE.activeCategoryId, nextIndex, true);
}

function playPrev() {
  if (DOM.audio.currentTime > 3) {
    DOM.audio.currentTime = 0;
    return;
  }
  const category = getCategoryById(STATE.activeCategoryId);
  if (!category) return;
  let prevIndex = STATE.currentSongIndex - 1;
  if (prevIndex < 0) prevIndex = category.songs.length - 1;
  loadSong(STATE.activeCategoryId, prevIndex, true);
}

function onTimeUpdate() {
  if (STATE.isSeeking) return;
  const current = DOM.audio.currentTime;
  const duration = DOM.audio.duration || 0;
  if (!isFinite(duration) || duration === 0) return;
  const pct = (current / duration) * 100;
  DOM.progressBar.value = pct;
  DOM.timeCurrent.textContent = formatTime(current);
  setProgressFill(pct);
}

function onDurationChange() {
  const duration = DOM.audio.duration;
  if (!isFinite(duration)) return;
  DOM.timeTotal.textContent = formatTime(duration);
  DOM.progressBar.max = 100;
}

function setProgressFill(pct) {
  DOM.progressFill.style.setProperty("--progress", `${pct}%`);
  DOM.progressFill.parentElement.style.setProperty("--progress", `${pct}%`);
}

function onSeekStart() { STATE.isSeeking = true; }
function onSeekInput() {
  const pct = parseFloat(DOM.progressBar.value);
  const duration = DOM.audio.duration || 0;
  setProgressFill(pct);
  if (isFinite(duration) && duration > 0) DOM.timeCurrent.textContent = formatTime((pct / 100) * duration);
}
function onSeekEnd() {
  const pct = parseFloat(DOM.progressBar.value);
  const duration = DOM.audio.duration || 0;
  if (isFinite(duration) && duration > 0) DOM.audio.currentTime = (pct / 100) * duration;
  STATE.isSeeking = false;
}

function onVolumeChange() {
  DOM.audio.volume = parseFloat(DOM.volumeBar.value);
  syncVolumeBarStyle();
}

function syncVolumeBarStyle() {
  const pct = parseFloat(DOM.volumeBar.value) * 100;
  DOM.volumeBar.style.setProperty("--volume-pct", `${pct}%`);
}

function loadCoverImages(coversArray) {
  const imgs = DOM.coverImgs;
  const total = coversArray.length;
  imgs.forEach((img, i) => {
    if (!img) return;
    img.src = coversArray[i % total] || "";
  });
  setActiveDot(0);
}

function setActiveDot(index) {
  STATE.currentDotIndex = index;
  DOM.dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
  DOM.sliderTrack.querySelectorAll(".cover-slide").forEach((slide, i) => slide.classList.toggle("active", i === index));
}

(function setupDotSync() {
  const rootStyles = getComputedStyle(document.documentElement);
  const totalSecs = parseFloat(rootStyles.getPropertyValue("--slider-duration")) || 40;
  const slideCount = parseInt(rootStyles.getPropertyValue("--slide-count"), 10) || 10;
  const perSlideSecs = totalSecs / slideCount;
  let dotTimer = null;
  
  window.startDotTimer = function() {
    stopDotTimer();
    dotTimer = setInterval(() => setActiveDot((STATE.currentDotIndex + 1) % slideCount), perSlideSecs * 1000);
  };
  window.stopDotTimer = function() {
    if (dotTimer !== null) { clearInterval(dotTimer); dotTimer = null; }
  };
})();

function onDotClick(index) {
  setActiveDot(index);
  const rootStyles = getComputedStyle(document.documentElement);
  const totalSecs = parseFloat(rootStyles.getPropertyValue("--slider-duration")) || 40;
  const slideCount = parseInt(rootStyles.getPropertyValue("--slide-count"), 10) || 10;
  DOM.sliderTrack.style.animationDelay = `${-(index * (totalSecs / slideCount))}s`;
}
/* ── SLEEP TIMER — DRUM PICKER ─────────────────────────────── */

const DRUM_ITEM_H = 48; // px — must match CSS .timer-drum__item height

/** Build the scrollable drum with number items + top/bottom padding. */
function buildDrum(drumEl, count) {
  drumEl.innerHTML = '';

  const topPad = document.createElement('div');
  topPad.className = 'timer-drum__pad';
  drumEl.appendChild(topPad);

  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'timer-drum__item';
    item.textContent = String(i).padStart(2, '0');
    drumEl.appendChild(item);
  }

  const botPad = document.createElement('div');
  botPad.className = 'timer-drum__pad';
  drumEl.appendChild(botPad);
}

/** Read selected index from a drum's current scroll position. */
function getDrumValue(drumEl) {
  return Math.round(drumEl.scrollTop / DRUM_ITEM_H);
}

/** Update the "Mulai Timer / Matikan Timer" button label while user scrolls. */
function updateSetBtnLabel() {
  if (!DOM.btnTimerSet) return;
  const h = getDrumValue(DOM.drumHours);
  const m = getDrumValue(DOM.drumMinutes);
  if (h === 0 && m === 0) {
    DOM.btnTimerSet.textContent = '⏹ Matikan Timer';
    DOM.btnTimerSet.classList.add('is-off');
  } else {
    DOM.btnTimerSet.textContent = '✨ Mulai Timer';
    DOM.btnTimerSet.classList.remove('is-off');
  }
}

/** Open the drum-picker modal. */
function openTimerModal() {
  buildDrum(DOM.drumHours, 24);
  buildDrum(DOM.drumMinutes, 60);

  DOM.timerModal.classList.add('open');
  DOM.timerModal.setAttribute('aria-hidden', 'false');

  // Determine initial values
  let initH = 0, initM = 30;
  if (STATE.sleepEndTime) {
    const remMs   = Math.max(0, STATE.sleepEndTime - Date.now());
    const remMins = Math.ceil(remMs / 60000);
    initH = Math.floor(remMins / 60);
    initM = remMins % 60;
  }

  // Set scroll positions after the modal is rendered
  requestAnimationFrame(() => requestAnimationFrame(() => {
    DOM.drumHours.scrollTop   = initH * DRUM_ITEM_H;
    DOM.drumMinutes.scrollTop = initM * DRUM_ITEM_H;
    updateSetBtnLabel();
  }));
}

/** Close the modal without changing the timer. */
function closeTimerModal() {
  DOM.timerModal.classList.remove('open');
  DOM.timerModal.setAttribute('aria-hidden', 'true');
}

/** Clear ALL timer state (timeout + countdown interval). */
function clearAllTimerState() {
  if (STATE.sleepTimerId)       { clearTimeout(STATE.sleepTimerId);         STATE.sleepTimerId       = null; }
  if (STATE.countdownIntervalId){ clearInterval(STATE.countdownIntervalId); STATE.countdownIntervalId = null; }
  STATE.sleepEndTime = null;
}

/** Refresh the countdown badge every second while timer is active. */
function tickCountdown() {
  if (!STATE.sleepEndTime) return;
  const remMs   = Math.max(0, STATE.sleepEndTime - Date.now());
  const totalS  = Math.ceil(remMs / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  DOM.timerCountdown.textContent = h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

/** Apply the chosen hours/minutes and start the sleep timer. */
function confirmSetTimer() {
  const h = getDrumValue(DOM.drumHours);
  const m = getDrumValue(DOM.drumMinutes);
  const totalMs = (h * 60 + m) * 60 * 1000;

  clearAllTimerState();

  if (totalMs <= 0) {
    // User set 0:00 — just cancel any running timer
    DOM.timerContainer.classList.remove('active');
    DOM.timerCountdown.textContent = '';
    closeTimerModal();
    return;
  }

  STATE.sleepEndTime = Date.now() + totalMs;
  DOM.timerContainer.classList.add('active');

  // Start the live countdown badge
  tickCountdown();
  STATE.countdownIntervalId = setInterval(tickCountdown, 1000);

  // Schedule the actual stop
  STATE.sleepTimerId = setTimeout(() => {
    pauseAudio();
    clearAllTimerState();
    DOM.timerContainer.classList.remove('active');
    DOM.timerCountdown.textContent = '';
  }, totalMs);

  closeTimerModal();
}

/** Cancel the active timer (called via backdrop / cancel btn when timer is on). */
function cancelAndCloseModal() {
  // "Batal" just closes — it does NOT stop an active timer.
  closeTimerModal();
}
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function escapeHTML(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function attachEventListeners() {
  DOM.btnPlay.addEventListener("click", togglePlayPause);
  DOM.btnNext.addEventListener("click", playNext);
  DOM.btnPrev.addEventListener("click", playPrev);

  // Sleep timer — drum picker
  if (DOM.btnTimer)         DOM.btnTimer.addEventListener('click', openTimerModal);
  if (DOM.timerModalBackdrop) DOM.timerModalBackdrop.addEventListener('click', cancelAndCloseModal);
  if (DOM.btnTimerClose)    DOM.btnTimerClose.addEventListener('click', cancelAndCloseModal);
  if (DOM.btnTimerCancel)   DOM.btnTimerCancel.addEventListener('click', cancelAndCloseModal);
  if (DOM.btnTimerSet)      DOM.btnTimerSet.addEventListener('click', confirmSetTimer);

  // Update button label as user scrolls the drums
  if (DOM.drumHours)   DOM.drumHours.addEventListener('scroll',   updateSetBtnLabel, { passive: true });
  if (DOM.drumMinutes) DOM.drumMinutes.addEventListener('scroll', updateSetBtnLabel, { passive: true });
  
  if (DOM.btnHeart) {
    DOM.btnHeart.addEventListener("click", () => {
      DOM.btnHeart.classList.toggle("active");
    });
  }
  
  if (DOM.btnPoetry) {
    DOM.btnPoetry.addEventListener("click", () => {
      if (DOM.poetryModal) DOM.poetryModal.style.display = "flex";
    });
  }
  
  if (DOM.closeModal) {
    DOM.closeModal.addEventListener("click", () => {
      if (DOM.poetryModal) DOM.poetryModal.style.display = "none";
    });
  }

  DOM.audio.addEventListener("timeupdate", onTimeUpdate);
  DOM.audio.addEventListener("durationchange", onDurationChange);
  DOM.audio.addEventListener("loadedmetadata", onDurationChange);
  DOM.audio.addEventListener("ended", playNext);
  DOM.audio.addEventListener("playing", () => { setPlayingState(true); startDotTimer(); });
  DOM.audio.addEventListener("pause", () => { setPlayingState(false); stopDotTimer(); });

  DOM.progressBar.addEventListener("mousedown", onSeekStart);
  DOM.progressBar.addEventListener("touchstart", onSeekStart, { passive: true });
  DOM.progressBar.addEventListener("input", onSeekInput);
  DOM.progressBar.addEventListener("mouseup", onSeekEnd);
  DOM.progressBar.addEventListener("touchend", onSeekEnd);
  DOM.progressBar.addEventListener("change", onSeekEnd);

  DOM.volumeBar.addEventListener("input", onVolumeChange);
  DOM.dots.forEach((dot, index) => dot.addEventListener("click", () => onDotClick(index)));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
