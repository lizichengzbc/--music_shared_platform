// 获取DOM元素
const audioPlayer = document.getElementById('audio-player');
const playPauseBtn = document.getElementById('play-pause');
const prevBtn = document.getElementById('prev-track');
const nextBtn = document.getElementById('next-track');
const progressBar = document.querySelector('.progress');
const currentSongTitle = document.getElementById('current-song-title');
const currentSongArtist = document.getElementById('current-song-artist');
const currentAlbumArt = document.getElementById('current-album-art');

// 初始化变量
let currentSongIndex = -1;  // 当前播放歌曲的索引
let songs = [];  // 存储歌曲列表


// 从后端API获取歌曲数据
fetch('/api/songs')
  .then(response => response.json())
  .then(data => {
    songs = data;  // 将获取到的歌曲数据存储到songs数组中
    initializeSongList();  // 初始化歌曲列表
  })
  .catch(error => console.error('获取歌曲数据时出错:', error));

// 初始化歌曲列表
function initializeSongList() {
  const songListContainer = document.getElementById('song-list-container');
  songs.forEach((song, index) => {
    const songElement = document.createElement('div');
    songElement.classList.add('song-item');
    songElement.dataset.songId = song.id;
    songElement.innerHTML = `
      <img src="${song.image_url}" alt="${song.name} album art">
      <div class="song-info">
        <h4>${song.name}</h4>
        <p>${song.artist}</p>
      </div>
      <div class="song-duration">${formatDuration(song.duration)}</div>
      <button class="play-button"><i class="fas fa-play"></i></button>
    `;
    songElement.addEventListener('click', () => playSong(index));
    songListContainer.appendChild(songElement);
  });
}

// 格式化歌曲时长
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 播放指定索引的歌曲
function playSong(index) {
  if (songs.length === 0) return;  // 如果歌曲列表为空,直接返回

  if (index >= 0 && index < songs.length) {
    currentSongIndex = index;
    const song = songs[currentSongIndex];
    audioPlayer.src = `/api/play/${song.id}`;
    audioPlayer.play().catch(error => {
      console.error('播放歌曲时出错:', error);
      alert('无法播放此歌曲，请稍后再试。');
    });
    updatePlayerInfo(song);
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  }
}

// 更新播放器显示的歌曲信息
function updatePlayerInfo(song) {
  currentSongTitle.textContent = song.name;
  currentSongArtist.textContent = song.artist;
  currentAlbumArt.src = '/static/music_images/' + song.name + '.jpg';
}

// 初始化音频播放器
function initializePlayer() {
    // 确保音频元素正确创建
    if (!audioPlayer) {
        console.error('Audio player element not found');
        return;
    }

    // 设置初始音频源（如果需要）
    // audioPlayer.src = initialAudioSource;

    // 音频加载完成事件
    audioPlayer.addEventListener('loadedmetadata', () => {
        console.log('Audio metadata loaded');
        // 可以在这里更新总时长等信息
    });

    // 播放状态更新事件
    audioPlayer.addEventListener('play', () => {
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        console.log('Audio playing');
    });

    audioPlayer.addEventListener('pause', () => {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        console.log('Audio paused');
    });

    // 播放错误处理
    audioPlayer.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        alert('播放出错，请检查音频文件');
    });

    // 进度更新
    audioPlayer.addEventListener('timeupdate', updateProgress);
}

// 播放/暂停按钮点击事件
playPauseBtn.addEventListener('click', () => {

  if (audioPlayer.paused) {
    audioPlayer.play();
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';  // 更改为暂停图标
  } else {
    audioPlayer.pause();
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';  // 更改为播放图标
  }
});

// 上一首按钮点击事件
prevBtn.addEventListener('click', () => {
  let newIndex = currentSongIndex - 1;
  if (newIndex < 0) {
    newIndex = songs.length - 1;  // 如果是第一首歌,则循环到最后一首
  }
  playSong(newIndex);
});

// 下一首按钮点击事件
nextBtn.addEventListener('click', () => {
  let newIndex = currentSongIndex + 1;
  if (newIndex >= songs.length) {
    newIndex = 0;  // 如果是最后一首歌,则循环到第一首
  }
  playSong(newIndex);
});

// 更新进度条
audioPlayer.addEventListener('timeupdate', () => {
  const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  progressBar.style.width = `${progress}%`;
});

// 歌曲播放结束时自动播放下一首
audioPlayer.addEventListener('ended', () => {
  nextBtn.click();  // 歌曲结束时,触发下一首按钮的点击事件
});

// 进度条点击事件,允许用户跳转到歌曲的特定位置
progressBar.parentElement.addEventListener('click', (e) => {
  const clickPosition = e.offsetX / progressBar.parentElement.offsetWidth;
  audioPlayer.currentTime = clickPosition * audioPlayer.duration;
});

// 初始化音量
audioPlayer.volume = 0.5;  // 设置初始音量为50%

// 添加键盘快捷键
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {  // 空格键控制播放/暂停
    e.preventDefault();  // 防止页面滚动
    playPauseBtn.click();
  } else if (e.code === 'ArrowLeft') {  // 左箭头键播放上一首
    prevBtn.click();
  } else if (e.code === 'ArrowRight') {  // 右箭头键播放下一首
    nextBtn.click();
  }
  //初始化音频播放器
initializePlayer()
});