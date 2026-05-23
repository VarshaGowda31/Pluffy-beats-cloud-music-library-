import { dataManager } from "./data.js?v=playlists_fixed";

// Auth State Check
/* 
   With Firebase, auth state is async. 
   We rely on dataManager's observer, but initially we might just wait or check.
   For now, we let the dashboard load, but if no user is found after a bit, redirect.
   However, simpler to just wrap in an async IIFE or check on auth state change.
*/
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { auth } from "./firebase.js?v=force10";
import { spotifyService } from "./spotify-embed.js";

function updateUIWithUser(user, retries = 3) {
  if (!user) return;
  const name = user.displayName || user.email.split('@')[0];
  console.log(`[UI] Updating for user: ${name}, Retries left: ${retries}`);

  // Side bar
  const sidebarName = document.getElementById("sidebarUserName") || document.querySelector(".user-profile .info h4");
  if (sidebarName) sidebarName.innerText = name;

  // Hero section - prioritizing the new unique ID
  const heroName = document.getElementById("appUserGreetingName") ||
    document.getElementById("heroUserName") ||
    document.querySelector(".hero-section h1 span");

  if (heroName) {
    heroName.innerText = name;
  } else if (retries > 0) {
    // Retry in 500ms if element not found (DOM might still be rendering)
    setTimeout(() => updateUIWithUser(user, retries - 1), 500);
  } else {
    console.error("[CRITICAL] Failed to find greeting element after multiple attempts!");
  }

  // Profile edit field
  const editNameInput = document.getElementById('editName');
  if (editNameInput) editNameInput.value = name;
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = "index.html";
  } else {
    currentUser = user;
    updateUIWithUser(user);
    // Fetch songs after user is known
    fetchSongs();
  }
});
let currentUser = null;

// DOM Elements
const songsDiv = document.getElementById("songs");
const profileSection = document.getElementById("profileSection");
const sectionTitle = document.getElementById("sectionTitle");
const audio = document.getElementById("audio");
// audio.crossOrigin = "anonymous"; // REMOVED: Causing playback failure if server lacks CORS
const playIcon = document.getElementById("playIcon");
const volumeSlider = document.querySelector('.volume-controls input');
const searchInput = document.getElementById("search");
const seekBar = document.getElementById("seekBar");
const currentTimeEl = document.getElementById("currentTime");
const durationTimeEl = document.getElementById("durationTime");

// Helper: Format Time (mm:ss)
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + " years ago";
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + " months ago";
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + " days ago";
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return interval + " hours ago";
  interval = Math.floor(seconds / 60);
  if (interval > 1) return interval + " mins ago";
  return Math.floor(seconds) + " seconds ago";
}

// Initial state
let allSongs = [];
let isSeeking = false;
let currentIndex = -1;
let isShuffle = false;
let repeatMode = 'none'; // 'none', 'one', 'all'

// --- Player Logic ---

function updateCurrentIndex(song) {
  currentIndex = allSongs.findIndex(s => s.id === song.id);
}

window.nextSong = () => {
  if (allSongs.length === 0) return;

  let nextIdx;
  if (isShuffle) {
    nextIdx = Math.floor(Math.random() * allSongs.length);
  } else {
    nextIdx = (currentIndex + 1) % allSongs.length;
  }
  play(allSongs[nextIdx]);
};

window.prevSong = () => {
  if (allSongs.length === 0) return;

  let prevIdx = (currentIndex - 1 + allSongs.length) % allSongs.length;
  play(allSongs[prevIdx]);
};

window.toggleShuffle = () => {
  isShuffle = !isShuffle;
  const btn = document.getElementById('shuffleBtn');
  btn.classList.toggle('active', isShuffle);
};

window.toggleRepeat = () => {
  const modes = ['none', 'all', 'one'];
  const currentIdx = modes.indexOf(repeatMode);
  repeatMode = modes[(currentIdx + 1) % modes.length];

  const btn = document.getElementById('repeatBtn');
  btn.classList.toggle('active', repeatMode !== 'none');

  // Visual indicator for 'one' vs 'all' could be added but let's keep it simple first
  btn.title = `Repeat: ${repeatMode}`;
};

function play(song) {
  if (!song) return;
  updateCurrentIndex(song);

  if (audio.src !== song.audioURL) {
    audio.src = song.audioURL;
  }
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      if (error.name === "AbortError") return;
      console.error("Playback failed:", error);
    });
  }

  dataManager.recordPlay(song.id);

  document.getElementById("nowPlayingTitle").innerText = song.title;
  document.getElementById("nowPlayingArtist").innerText = song.artist;

  const cover = document.querySelector(".playing-info .cover-art");
  cover.style.background = song.coverGradient || "var(--gradient-2)";
  cover.innerHTML = '<i class="fa-solid fa-music" style="color:white"></i>';
}

audio.onended = () => {
  if (repeatMode === 'one') {
    audio.play();
  } else if (repeatMode === 'all' || currentIndex < allSongs.length - 1) {
    nextSong();
  }
};

async function fetchSongs() {
  if (!localStorage.getItem("data_v2")) {
    localStorage.removeItem("pluffy_songs");
    localStorage.setItem("data_v2", "true");
    location.reload();
    return;
  }
  try {
    allSongs = await dataManager.getSongs();
    render(allSongs);
  } catch (e) {
    console.error(e);
    songsDiv.innerHTML = "<p style='color:white; text-align:center; padding: 20px;'>Error loading music.</p>";
  }
}

function showMain() {
  songsDiv.style.display = "grid";
  profileSection.style.display = "none";

  const spotifySection = document.getElementById('spotifySection');
  const heroSection = document.getElementById('heroSection');
  const libraryHeader = document.querySelector('.library-header');

  if (spotifySection) spotifySection.style.display = "none";
  if (heroSection) heroSection.style.display = "block";
  if (libraryHeader) libraryHeader.style.display = "flex";
}
let currentFilter = 'all';

window.filterMusic = (type) => {
  currentFilter = type;
  // Update UI state
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = {
    'all': 'filterAll',
    'mine': 'filterMine',
    'public': 'filterPublic'
  }[type];
  document.getElementById(activeBtn).classList.add('active');

  applyFilters();
};

function applyFilters() {
  const q = searchInput.value.toLowerCase();
  let baseSongs = allSongs;

  if (currentFilter === 'mine') {
    baseSongs = allSongs.filter(s => !s.isPublic && s.uploadedBy === currentUser?.uid);
  } else if (currentFilter === 'public') {
    baseSongs = allSongs.filter(s => s.isPublic);
  }

  const filtered = baseSongs.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q)
  );

  render(filtered, false);
}

window.searchSongs = () => {
  applyFilters();
};

function render(list, resetView = true) {
  if (resetView) showMain();
  if (currentUser) updateUIWithUser(currentUser);

  songsDiv.innerHTML = "";
  if (list.length === 0) {
    songsDiv.innerHTML = `<div style='color:var(--text-muted); grid-column: 1/-1; text-align:center; padding: 40px;'>
      <i class="fa-solid fa-folder-open" style="font-size: 48px; margin-bottom: 15px; display: block; opacity: 0.3;"></i>
      <p>No songs found in this category.</p>
    </div>`;
    return;
  }

  list.forEach(song => {
    const isLiked = currentUser.likedSongs && currentUser.likedSongs.includes(song.id);
    const isMine = !song.isPublic && song.uploadedBy === currentUser?.uid;
    const div = document.createElement("div");
    div.className = "song-card";
    div.style.position = "relative";
    div.innerHTML = `
      <div class="song-img-placeholder" style="background: ${song.coverGradient || '#333'}">
        <i class="fa-solid fa-music"></i>
        ${isMine ? `<div class="song-badge"><i class="fa-solid fa-cloud-arrow-up"></i> Uploaded</div>` : ''}
        
        <!-- Top Right Actions (Like/Add) -->
        <div class="card-actions-right">
           <button class="btn-like ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); likeSong('${song.id}', this)" title="Like">
             <i class="fa-solid fa-heart"></i>
           </button>
           <button class="btn-add-to-playlist" onclick="event.stopPropagation(); window.openAddToPlaylistModal('${song.id}')" title="Add to Playlist">
             <i class="fa-solid fa-plus"></i>
           </button>
        </div>

        <!-- Top Left Action (Delete - Visible Only for Owner) -->
        ${isMine ? `
           <button class="btn-delete-card" title="Delete Song" onclick="event.stopPropagation(); removeSong('${song.id}')">
             <i class="fa-solid fa-trash"></i>
           </button>
        ` : ''}
      </div>
      <div class="song-info">
        <h4>${song.title}</h4>
        <p>${song.artist}</p>
      </div>
    `;
    div.onclick = () => play(song);
    songsDiv.appendChild(div);
  });
}

window.togglePlay = async () => {
  if (!audio.src || audio.src === window.location.href) {
    if (allSongs.length > 0) play(allSongs[0]);
    else alert("No songs available.");
    return;
  }
  try {
    if (audio.paused) await audio.play();
    else audio.pause();
  } catch (e) {
    console.error("Playback error", e);
  }
};

audio.onplay = () => {
  playIcon.classList.remove("fa-circle-play");
  playIcon.classList.add("fa-circle-pause");
};
audio.onpause = () => {
  playIcon.classList.add("fa-circle-play");
  playIcon.classList.remove("fa-circle-pause");
};

// --- Seek Bar Logic ---
audio.addEventListener('timeupdate', () => {
  if (audio.duration && !isSeeking) {
    const progress = (audio.currentTime / audio.duration) * 100;
    seekBar.value = progress;
    currentTimeEl.innerText = formatTime(audio.currentTime);
  }
});

audio.addEventListener('loadedmetadata', () => {
  durationTimeEl.innerText = formatTime(audio.duration);
});

seekBar.addEventListener('mousedown', () => { isSeeking = true; });
seekBar.addEventListener('touchstart', () => { isSeeking = true; });

seekBar.addEventListener('input', () => {
  if (!Number.isFinite(audio.duration)) return;
  const seekTime = (seekBar.value / 100) * audio.duration;
  currentTimeEl.innerText = formatTime(seekTime);
});

seekBar.addEventListener('change', () => {
  if (!Number.isFinite(audio.duration)) {
    isSeeking = false;
    return;
  }
  const seekTo = (seekBar.value / 100) * audio.duration;
  if (Number.isFinite(seekTo)) {
    audio.currentTime = seekTo;
  }
  isSeeking = false;
});

window.likeSong = async (id, btnElement) => {
  try {
    await dataManager.toggleLike(id);
    if (btnElement) {
      btnElement.classList.toggle('liked');
    }
  } catch (e) {
    console.error(e);
    alert("Error liking song");
  }
};

// --- Upload Logic ---

window.uploadLocalFile = async () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "audio/mp3, audio/wav";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const title = prompt("Enter Song Title:", file.name.replace(/\.[^/.]+$/, ""));
    const artist = prompt("Enter Artist Name:", "Unknown Artist");

    // Show loading state
    songsDiv.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fa-solid fa-cloud-arrow-up fa-bounce fa-3x" style="color: var(--primary); margin-bottom: 20px;"></i>
                <h3 style="color: white;">Uploading "${title}"...</h3>
                <p style="color: var(--text-muted);">Saving to your private cloud</p>
            </div>
        `;

    try {
      await dataManager.uploadSong(file, title, artist);
      await fetchSongs(); // Refresh list
    } catch (error) {
      console.error("Upload failed", error);
      alert("Upload failed: " + error.message);
      fetchSongs(); // Restore UI
    }
  };
  input.click();
};

window.removeSong = async (songId) => {
  if (!confirm("Are you sure you want to delete this song from your cloud?")) return;

  try {
    await dataManager.deleteSong(songId);
    await fetchSongs();
  } catch (error) {
    alert("Deletion failed: " + error.message);
  }
};

// Navigation & Hero Updates
function updateHero(title, subtitle, viewClass) {
  const section = document.getElementById("heroSection");
  const h1 = document.getElementById("heroTitle");
  const p = document.getElementById("heroSubtitle");

  if (!section) return;

  // Clear existing hero classes
  section.className = "hero-section " + (viewClass || "hero-library");

  // Update content with a small fade effect if possible
  h1.innerHTML = title;
  p.innerText = subtitle;
}

window.loadLiked = async () => {
  sectionTitle.innerText = "Liked Songs";
  updateHero("Your Favorites ❤️", "Songs you've loved and saved.", "hero-liked");

  const likedSongs = await dataManager.getLikedSongs();
  render(likedSongs);

  document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
  document.querySelector('.sidebar li:nth-child(2)').classList.add('active');
  showMain();
};

window.loadLibrary = () => {
  sectionTitle.innerText = "Music Library";
  const name = currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : "...";
  updateHero(`Welcome Back, <span>${name}</span> 👋`, "Pick up where you left off.", "hero-library");

  render(allSongs);
  document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
  document.querySelector('.sidebar li:first-child').classList.add('active');
  showMain();
};

window.loadPlaylists = async () => {
  sectionTitle.innerText = "My Playlists";
  updateHero("Your Playlists 🎧", "Curate your own perfect sound.", "hero-playlists");

  showMain();

  try {
    const playlists = await dataManager.getPlaylists();
    renderPlaylistGrid(playlists);
  } catch (err) {
    console.error("Error loading playlists:", err);
    songsDiv.innerHTML = `<p style='color:var(--text-muted);'>Error loading playlists.</p>`;
  }

  document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
  document.querySelector('.sidebar li:nth-child(3)').classList.add('active');
};

function renderPlaylistGrid(playlists) {
  songsDiv.innerHTML = "";

  // Create New Playlist Card
  const createCard = document.createElement("div");
  createCard.className = "playlist-card";
  createCard.innerHTML = `
    <div class="playlist-icon" style="background: rgba(255,255,255,0.05); border: 2px dashed rgba(255,255,255,0.2); color: rgba(255,255,255,0.4); box-shadow: none;">
      <i class="fa-solid fa-plus"></i>
    </div>
    <h4>Create New</h4>
    <p>Build a new collection</p>
  `;
  createCard.onclick = () => openCreatePlaylistModal();
  songsDiv.appendChild(createCard);

  playlists.forEach(pl => {
    const div = document.createElement("div");
    div.className = "playlist-card";
    div.innerHTML = `
      <div class="playlist-icon">
        <i class="fa-solid fa-layer-group"></i>
      </div>
      <h4>${pl.name}</h4>
      <p>${pl.songs ? pl.songs.length : 0} Songs</p>
      <button class="btn-delete" title="Delete Playlist" onclick="event.stopPropagation(); removePlaylist('${pl.id}')" style="margin-top: 10px; padding: 5px 10px; font-size: 11px;">
        <i class="fa-solid fa-trash"></i> Delete
      </button>
    `;
    div.onclick = () => viewPlaylist(pl.id);
    songsDiv.appendChild(div);
  });
}

window.viewPlaylist = async (playlistId) => {
  try {
    const playlists = await dataManager.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;

    sectionTitle.innerText = `Playlist: ${pl.name}`;
    updateHero(`${pl.name} 📁`, `${pl.songs.length} songs in this collection.`, "hero-playlists");

    const plSongs = allSongs.filter(s => pl.songs.includes(s.id));
    render(plSongs, false); // Don't reset view/titles
  } catch (err) {
    console.error("Error viewing playlist:", err);
  }
};

window.removePlaylist = async (playlistId) => {
  if (!confirm("Delete this playlist? Songs won't be deleted.")) return;
  try {
    await dataManager.deletePlaylist(playlistId);
    loadPlaylists();
  } catch (err) {
    alert("Error deleting playlist: " + err.message);
  }
};

// Modals for Playlists
window.openCreatePlaylistModal = () => {
  document.getElementById('createPlaylistModal').classList.add('active');
  document.getElementById('playlistNameInput').focus();
};

window.closeCreatePlaylistModal = () => {
  document.getElementById('createPlaylistModal').classList.remove('active');
  document.getElementById('playlistNameInput').value = "";
};

window.confirmCreatePlaylist = async () => {
  const name = document.getElementById('playlistNameInput').value.trim();
  if (!name) return;

  try {
    await dataManager.createPlaylist(name);
    closeCreatePlaylistModal();
    loadPlaylists();
  } catch (err) {
    alert("Error creating playlist: " + err.message);
  }
};

let pendingSongId = null;
window.openAddToPlaylistModal = async (songId) => {
  pendingSongId = songId;
  const list = document.getElementById('playlistSelectionList');
  list.innerHTML = `<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;

  document.getElementById('addToPlaylistModal').classList.add('active');

  try {
    const playlists = await dataManager.getPlaylists();
    if (playlists.length === 0) {
      list.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px;">No playlists found. Create one first!</p>`;
    } else {
      list.innerHTML = playlists.map(pl => `
                <div class="playlist-option" onclick="confirmAddSongToPlaylist('${pl.id}')">
                    <i class="fa-solid fa-music"></i>
                    <span>${pl.name}</span>
                </div>
            `).join('');
    }
  } catch (err) {
    list.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px;">Error loading playlists.</p>`;
  }
};

window.closeAddToPlaylistModal = () => {
  document.getElementById('addToPlaylistModal').classList.remove('active');
  pendingSongId = null;
};

window.confirmAddSongToPlaylist = async (playlistId) => {
  if (!pendingSongId) return;
  try {
    await dataManager.addSongToPlaylist(playlistId, pendingSongId);
    closeAddToPlaylistModal();
    alert("Added to playlist!");
  } catch (err) {
    alert("Error adding to playlist: " + err.message);
  }
};

// --- Profile Section Logic ---


// Profile Loading
window.openSettings = () => {
  // We are reusing the settings button to open Profile View as requested
  loadProfile();
};

window.loadProfile = async () => {
  sectionTitle.innerText = "My Profile";
  songsDiv.style.display = "none";
  profileSection.style.display = "block";

  const spotifySection = document.getElementById('spotifySection');
  if (spotifySection) spotifySection.style.display = "none";

  document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
  document.querySelector('.sidebar li:last-child').classList.add('active'); // Settings/Profile

  // User Data
  const name = currentUser.displayName || currentUser.email.split('@')[0];
  document.getElementById('editName').value = name;

  updateHero("Account Settings ⚙️", "Manage your profile and listen history.", "hero-profile");
  // Render Daily Usage
  renderUsageHistory();

  // Restore Missing History Logic
  try {
    const history = await dataManager.getFullHistory();
    const loginTable = document.getElementById('loginHistoryTable');
    if (loginTable) {
      loginTable.innerHTML = '';
      history.login.forEach(log => {
        const row = document.createElement('tr');
        // Simple helper to parse UA
        let deviceName = "Unknown Device";
        if (log.device.includes("Windows")) deviceName = "Windows PC";
        else if (log.device.includes("Macintosh")) deviceName = "Mac";
        else if (log.device.includes("iPhone")) deviceName = "iPhone";
        else if (log.device.includes("Android")) deviceName = "Android Phone";

        let browserName = "Browser";
        if (log.device.includes("Chrome")) browserName = "Chrome";
        else if (log.device.includes("Firefox")) browserName = "Firefox";
        else if (log.device.includes("Safari") && !log.device.includes("Chrome")) browserName = "Safari";

        row.innerHTML = `
          <td>${new Date(log.date).toLocaleString()}</td>
          <td title="${log.device}">${browserName} on ${deviceName}</td>
        `;
        loginTable.appendChild(row);
      });
    }

    const listenList = document.getElementById('listeningHistoryList');
    if (listenList) {
      listenList.innerHTML = '';
      history.listening.forEach(listen => {
        const song = allSongs.find(s => s.id === listen.songId);
        if (song) {
          const li = document.createElement('li');
          li.className = 'history-item';
          li.onclick = () => play(song);
          li.innerHTML = `
            <div class="history-cover" style="background:${song.coverGradient || '#333'}">
              <i class="fa-solid fa-music"></i>
              <button class="btn-play-history">
                <i class="fa-solid fa-play"></i>
              </button>
            </div>
            <div class="history-info">
              <span class="history-title">${song.title}</span>
              <span class="history-meta">${song.artist} • ${timeAgo(listen.date)}</span>
            </div>
          `;
          listenList.appendChild(li);
        }
      });
    }
  } catch (err) {
    console.error("Error loading history:", err);
  }
};

function formatDetailedTime(totalSecs) {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${totalSecs % 60}s`;
}

function renderUsageHistory() {
  const container = document.getElementById("usageHistoryList");
  if (!container) return;

  const log = JSON.parse(localStorage.getItem("dailyUsageLog") || "{}");
  const dates = Object.keys(log).sort().reverse();

  if (dates.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); padding:10px;">No usage history yet.</p>`;
    return;
  }

  container.innerHTML = dates.map(date => {
    const displayDate = new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = formatDetailedTime(log[date]);
    return `
      <div class="usage-row" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-weight:600;">${displayDate}</span>
        <span style="color:var(--primary); font-weight:700;">${timeStr}</span>
      </div>
    `;
  }).join('');
}
window.saveProfile = async () => {
  const name = document.getElementById('editName').value;
  const pass = document.getElementById('editPassword').value;

  try {
    const updatedUser = await dataManager.updateProfile(name, pass || null);
    alert("Profile updated successfully!");
    updateUIWithUser(auth.currentUser);
  } catch (e) {
    alert("Error updating profile: " + e.message);
  }
};



window.resetAppLibrary = async () => {
  if (!confirm("This will DELETE all songs in the database and restore the default ones. Use this if your music is broken. Continue?")) return;

  try {
    const btn = document.querySelector('button[onclick="resetAppLibrary()"]');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';
    btn.disabled = true;

    await dataManager.resetLibrary();
    alert("Library restored! App will now reload.");
    location.reload();
  } catch (e) {
    console.error(e);
    alert("Error resetting library: " + e.message);
    const btn = document.querySelector('button[onclick="resetAppLibrary()"]');
    btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reset Music Library (Fix Broken Data)';
    btn.disabled = false;
  }
};

window.logout = async () => {
  await dataManager.logout();
  location.href = "index.html";
};

// Volume Control
volumeSlider.addEventListener('input', (e) => {
  const val = e.target.value / 100;
  audio.volume = val;
  updateVolumeIcon(val);
});

function updateVolumeIcon(vol) {
  const icon = document.getElementById('volumeIcon');
  if (!icon) return;
  if (vol === 0) {
    icon.className = 'fa-solid fa-volume-xmark';
  } else if (vol < 0.5) {
    icon.className = 'fa-solid fa-volume-low';
  } else {
    icon.className = 'fa-solid fa-volume-high';
  }
}

let lastVolume = 0.8;
document.getElementById('volumeIcon').onclick = () => {
  if (audio.volume > 0) {
    lastVolume = audio.volume;
    audio.volume = 0;
    volumeSlider.value = 0;
  } else {
    audio.volume = lastVolume;
    volumeSlider.value = lastVolume * 100;
  }
  updateVolumeIcon(audio.volume);
};

// Control Button Listeners
document.getElementById('shuffleBtn').onclick = () => toggleShuffle();
document.getElementById('repeatBtn').onclick = () => toggleRepeat();
document.getElementById('prevBtn').onclick = () => prevSong();
document.getElementById('nextBtn').onclick = () => nextSong();

/* --- Time Tracking Logic --- */
let sessionSeconds = 0; // Resets every login/session
const timeDisplay = document.getElementById("timeDisplay");

function getTodayKey() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

function updateUsageHistory(secondsToAdd) {
  let log = JSON.parse(localStorage.getItem("dailyUsageLog") || "{}");
  const today = getTodayKey();
  log[today] = (log[today] || 0) + secondsToAdd;

  // Keep only last 7 days to save space
  const keys = Object.keys(log).sort().reverse();
  if (keys.length > 7) {
    const trimmedLog = {};
    keys.slice(0, 7).forEach(k => trimmedLog[k] = log[k]);
    log = trimmedLog;
  }

  localStorage.setItem("dailyUsageLog", JSON.stringify(log));
}

function updateTimeDisplay() {
  const hrs = Math.floor(sessionSeconds / 3600);
  const mins = Math.floor((sessionSeconds % 3600) / 60);
  const secs = sessionSeconds % 60;
  if (timeDisplay) {
    timeDisplay.innerText =
      `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Initialize display
updateTimeDisplay();

// Main tracking loop
setInterval(() => {
  if (!audio.paused) {
    sessionSeconds++;
    updateTimeDisplay();

    // Persist to history every 5 seconds for efficiency
    if (sessionSeconds % 5 === 0) {
      updateUsageHistory(5);
    }
  }
}, 1000);

window.addEventListener("beforeunload", () => {
  if (typeof sessionSeconds !== 'undefined') {
    localStorage.setItem("totalTime", sessionSeconds);
  }
});

/* ===================================
   SPOTIFY INTEGRATION FUNCTIONS
   =================================== */

/**
 * Load Spotify view - show playlists section
 */
window.loadSpotify = () => {
  const spotifySection = document.getElementById('spotifySection');
  const songsDiv = document.getElementById('songs');
  const profileSection = document.getElementById('profileSection');
  const heroSection = document.getElementById('heroSection');
  const libraryHeader = document.querySelector('.library-header');

  if (!spotifySection) {
    alert('Spotify section not found. Please refresh the page.');
    return;
  }

  // Hide EVERYTHING else
  songsDiv.style.display = "none";
  profileSection.style.display = "none";
  if (heroSection) heroSection.style.display = "none";
  if (libraryHeader) libraryHeader.style.display = "none";

  // Show Spotify
  spotifySection.style.display = "block";

  // Update sidebar active state
  document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
  document.querySelector('.sidebar li:nth-child(4)').classList.add('active');

  // Render playlists
  renderSpotifyPlaylists();
};

/**
 * Render Spotify playlists grid
 */
function renderSpotifyPlaylists() {
  const spotifyPlaylistsGrid = document.getElementById('spotifyPlaylistsGrid');
  if (!spotifyPlaylistsGrid) return;

  const playlists = spotifyService.getPlaylists();

  if (playlists.length === 0) {
    spotifyPlaylistsGrid.innerHTML = `
      <div class="spotify-empty-state" style="grid-column: 1/-1;">
        <i class="fa-brands fa-spotify"></i>
        <h3>No Spotify Playlists Yet</h3>
        <p>Add your first playlist to get started</p>
        <button onclick="openAddSpotifyModal()" class="btn-primary" style="width: auto; padding: 12px 30px; margin-top: 10px;">
          <i class="fa-solid fa-plus"></i> Add Playlist
        </button>
      </div>
    `;
    return;
  }

  spotifyPlaylistsGrid.innerHTML = playlists.map(playlist => `
    <div class="spotify-playlist-card">
      <div class="spotify-playlist-thumbnail">
        ${playlist.thumbnail ?
      `<img src="${playlist.thumbnail}" alt="${playlist.title}">` :
      `<div class="placeholder"><i class="fa-brands fa-spotify"></i></div>`
    }
      </div>
      <div class="spotify-playlist-info">
        <h4 title="${playlist.title}">${playlist.title}</h4>
        <p>
          <i class="fa-solid fa-${getSpotifyIcon(playlist.type)}"></i>
          ${capitalizeFirst(playlist.type)}
        </p>
        <span class="spotify-badge">
          <i class="fa-brands fa-spotify"></i> Spotify
        </span>
      </div>
      <div class="spotify-playlist-actions">
        <button class="btn-play-spotify" onclick="playSpotifyPlaylist('${playlist.id}')">
          <i class="fa-solid fa-play"></i> Play
        </button>
        <button class="btn-remove-spotify" onclick="removeSpotifyPlaylist('${playlist.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function getSpotifyIcon(type) {
  const icons = {
    playlist: 'list-music',
    album: 'compact-disc',
    track: 'music',
    artist: 'user-music',
    show: 'podcast',
    episode: 'microphone'
  };
  return icons[type] || 'music';
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

window.openAddSpotifyModal = () => {
  const addSpotifyModal = document.getElementById('addSpotifyModal');
  const spotifyUrlInput = document.getElementById('spotifyUrlInput');
  if (!addSpotifyModal || !spotifyUrlInput) return;

  addSpotifyModal.classList.add('active');
  spotifyUrlInput.value = '';
  spotifyUrlInput.focus();
};

window.closeAddSpotifyModal = () => {
  const addSpotifyModal = document.getElementById('addSpotifyModal');
  const spotifyUrlInput = document.getElementById('spotifyUrlInput');
  if (!addSpotifyModal || !spotifyUrlInput) return;

  addSpotifyModal.classList.remove('active');
  spotifyUrlInput.value = '';
};

window.addSpotifyPlaylist = async () => {
  const spotifyUrlInput = document.getElementById('spotifyUrlInput');
  if (!spotifyUrlInput) return;

  const url = spotifyUrlInput.value.trim();

  if (!url) {
    alert('Please enter a Spotify URL');
    return;
  }

  try {
    const btn = event.target;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
    btn.disabled = true;

    await spotifyService.addPlaylist(url);
    closeAddSpotifyModal();
    renderSpotifyPlaylists();
    showNotification('Playlist added successfully! 🎉', 'success');

  } catch (error) {
    console.error('Error adding playlist:', error);
    alert(error.message || 'Failed to add playlist. Please check the URL and try again.');
    const btn = event.target;
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Library';
    btn.disabled = false;
  }
};

window.playSpotifyPlaylist = (playlistId) => {
  const spotifyPlayerContainer = document.getElementById('spotifyPlayerContainer');
  const spotifyPlayerEmbed = document.getElementById('spotifyPlayerEmbed');
  const spotifyPlayerTitle = document.getElementById('spotifyPlayerTitle');
  const audio = document.getElementById('audio');

  if (!spotifyPlayerContainer || !spotifyPlayerEmbed || !spotifyPlayerTitle) return;

  const playlist = spotifyService.getPlaylist(playlistId);

  if (!playlist) {
    alert('Playlist not found');
    return;
  }

  spotifyPlayerTitle.textContent = playlist.title;
  const embedHtml = spotifyService.generateEmbedCode(playlist.type, playlist.id, {
    height: playlist.type === 'track' ? '152' : '380'
  });

  spotifyPlayerEmbed.innerHTML = embedHtml;
  spotifyPlayerContainer.style.display = 'block';

  if (audio && !audio.paused) {
    audio.pause();
  }
};

window.closeSpotifyPlayer = () => {
  const spotifyPlayerContainer = document.getElementById('spotifyPlayerContainer');
  const spotifyPlayerEmbed = document.getElementById('spotifyPlayerEmbed');
  if (!spotifyPlayerContainer || !spotifyPlayerEmbed) return;

  spotifyPlayerContainer.style.display = 'none';
  spotifyPlayerEmbed.innerHTML = '';
};

window.removeSpotifyPlaylist = (playlistId) => {
  if (!confirm('Remove this playlist from your library?')) {
    return;
  }

  try {
    spotifyService.removePlaylist(playlistId);
    renderSpotifyPlaylists();
    const currentPlaylist = spotifyService.getPlaylist(playlistId);
    if (!currentPlaylist) {
      closeSpotifyPlayer();
    }
    showNotification('Playlist removed', 'info');
  } catch (error) {
    console.error('Error removing playlist:', error);
    alert('Failed to remove playlist');
  }
};

function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 100px;
    right: 40px;
    background: ${type === 'success' ? '#1DB954' : 'rgba(255,255,255,0.1)'};
    color: white;
    padding: 15px 25px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10001;
    animation: slideInRight 0.3s ease-out;
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(100px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideOutRight {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100px); }
  }
`;
document.head.appendChild(style);

// Event listeners - set up when DOM is ready
setTimeout(() => {
  const addSpotifyModal = document.getElementById('addSpotifyModal');
  const spotifyUrlInput = document.getElementById('spotifyUrlInput');

  if (addSpotifyModal) {
    addSpotifyModal.addEventListener('click', (e) => {
      if (e.target === addSpotifyModal) {
        closeAddSpotifyModal();
      }
    });
  }

  if (spotifyUrlInput) {
    spotifyUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addSpotifyPlaylist();
      }
    });
  }
});
