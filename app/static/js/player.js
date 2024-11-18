// 播放模式枚举
const PlayMode = {
    SEQUENCE: 'sequence',
    RANDOM: 'random',
    REPEAT: 'repeat'
};

// 获取DOM元素
const audioPlayer = document.getElementById('audio-player');
const playPauseBtn = document.getElementById('play-pause');
const prevBtn = document.getElementById('prev-track');
const nextBtn = document.getElementById('next-track');
const progressBar = document.querySelector('.progress');
const progressContainer = document.querySelector('.progress-bar');
const currentSongTitle = document.getElementById('current-song-title');
const currentSongArtist = document.getElementById('current-song-artist');
const currentAlbumArt = document.getElementById('current-album-art');
const likeButton = document.querySelector('.like-button');

// 创建播放器实例并初始化
document.addEventListener('DOMContentLoaded', () => {
    const player = new PlayerController();

    // 初始化歌词管理器
    const lyricsContainer = document.getElementById('lyrics-container');
    if (lyricsContainer) {
        player.lyricsManager = new LyricsManager(lyricsContainer);
    }

    // 导出 player 实例供其他模块使用
    window.player = player;

    // 恢复播放状态
    const savedTime = localStorage.getItem('currentTime');
    const savedSongIndex = localStorage.getItem('songIndex');
    const savedPlaylistIndex = localStorage.getItem('currentPlaylistIndex');
    const savedIsPlayingFromPlaylist = localStorage.getItem('isPlayingFromPlaylist') === 'true';

    if (savedSongIndex !== null) {
        if (savedIsPlayingFromPlaylist && savedPlaylistIndex !== null) {
            player.isPlayingFromPlaylist = true;
            player.currentPlaylistIndex = parseInt(savedPlaylistIndex);
            player.playFromPlaylist(parseInt(savedPlaylistIndex));
        } else {
            player.playSong(parseInt(savedSongIndex), false);
        }
        audioPlayer.currentTime = parseFloat(savedTime || 0);
    }
});


// 播放器控制类
class PlayerController {
    constructor() {
        // 基础属性
        this.displayedSongs = [];  // 显示在界面上的歌曲
        this.allSongs = [];        // 数据库中的所有歌曲
        this.currentSongIndex = -1;
        this.playMode = PlayMode.SEQUENCE;

        // 播放列表相关属性
        this.playlist = [];
        this.isPlayingFromPlaylist = false;
        this.currentPlaylistIndex = -1;

        // 初始化各个组件
        this.initializeTimeDisplay();
        this.initializePlayMode();
        this.initializePlaylist();
        this.fetchSongs();
        this.restorePlayerState();
        this.initializeLikeButton();
        this.initializeEventListeners();
        // 添加点击事件监听
        if (likeButton) {
            likeButton.addEventListener('click', () => {
                console.log("Like button clicked!");
                this.toggleLike();
            });
        }
    }


    // 初始化时间显示
    initializeTimeDisplay() {
        this.currentTimeDisplay = document.getElementById('current-time');
        this.durationDisplay = document.getElementById('duration');
    }

    // 初始化播放模式
    initializePlayMode() {
        this.playModeButton = document.createElement('button');
        this.playModeButton.className = 'mode-button';
        this.playModeButton.innerHTML = '<i class="fas fa-list"></i>';
        this.playModeButton.title = '顺序播放';

        const controls = document.querySelector('.controls');
        controls.appendChild(this.playModeButton);

        this.playModeButton.addEventListener('click', () => this.togglePlayMode());
    }

    // 初始化播放列表
    initializePlaylist() {
        // 创建播放列表按钮
        this.playlistButton = document.createElement('button');
        this.playlistButton.className = 'playlist-button';
        this.playlistButton.innerHTML = '<i class="fas fa-list-ul"></i>';
        this.playlistButton.title = '播放列表';

        // 创建播放列表容器
        this.playlistContainer = document.createElement('div');
        this.playlistContainer.className = 'playlist-container';
        this.playlistContainer.innerHTML = `
            <div class="playlist-header">
                <h3>播放列表</h3>
                <button class="clear-playlist" title="清空播放列表">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="playlist-items"></div>
        `;

        // 将按钮添加到控制区
        const controls = document.querySelector('.controls');
        controls.appendChild(this.playlistButton);

        // 将播放列表容器添加到页面
        document.body.appendChild(this.playlistContainer);

        // 添加事件监听器
        this.playlistButton.addEventListener('click', () => this.togglePlaylistView());
        this.playlistContainer.querySelector('.clear-playlist').addEventListener('click',
            () => this.clearPlaylist());

        // 尝试从本地存储恢复播放列表
        this.loadPlaylistFromStorage();
    }
        // 初始化歌曲列表
    initializeSongList() {
    const songListContainer = document.getElementById('song-list-container');
    if (!songListContainer) return;

    songListContainer.innerHTML = '';

    this.displayedSongs.forEach((song, index) => {
        const songElement = document.createElement('div');
        songElement.classList.add('song-item');
        songElement.dataset.songId = song.id;
        songElement.innerHTML = `
            <img src="${song.image_url || '/static/images/default-album.png'}" alt="${song.name} album art">
            <div class="song-info">
                <h4>${song.name}</h4>
                <div class="song-albumname">${song.album}</div>
                <p>${song.artist}</p>
            </div>
            <div class="song-duration">${this.formatTime(song.duration)}</div>
                <button class="play-button" title="播放">
                    <i class="fas fa-play"></i>
                </button>
                <button class="add-to-playlist" title="添加到播放列表">
                    <i class="fas fa-plus"></i>
                </button>
        `;

        // 播放按钮事件
        songElement.querySelector('.play-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.playSong(index, true);
        });


        // 添加到播放列表按钮事件
        songElement.querySelector('.add-to-playlist').addEventListener('click', (e) => {
            e.stopPropagation();
            this.addToPlaylist(song);
        });

        songListContainer.appendChild(songElement);
    });
}
        initializeLikeButton() {
        // 添加喜欢按钮到控制区
        const controls = document.querySelector('.controls');
        this.likeButton = document.createElement('button');
        this.likeButton.className = 'like-button';
        this.likeButton.innerHTML = '<i class="far fa-heart"></i><span class="likes-count">0</span>';
        this.likeButton.title = '喜欢';
        controls.appendChild(this.likeButton);

        // 绑定点击事件
        this.likeButton.addEventListener('click', () => this.toggleLike());
    }
        initializeEventListeners() {
        // 播放器时间更新事件
        audioPlayer.addEventListener('timeupdate', () => {
            const currentTime = audioPlayer.currentTime;
            const duration = audioPlayer.duration;
            const currentSongIndex = window.player.currentSongIndex;

            // 设置window参数保存歌曲播放进度
            localStorage.setItem('currentTime', currentTime);
            localStorage.setItem('songIndex', currentSongIndex);

            // 更新进度条
            const progress = (currentTime / duration) * 100;
            progressBar.style.width = `${progress}%`;

            // 更新时间显示
            this.currentTimeDisplay.textContent = this.formatTime(currentTime);
            this.durationDisplay.textContent = this.formatTime(duration);

            // 更新歌词
            if (this.lyricsManager) {
                this.lyricsManager.updateTime(currentTime);
            }
        });

        // 播放结束事件
        audioPlayer.addEventListener('ended', () => {
            this.playNext();
        });

        // 进度条点击事件
        progressContainer.addEventListener('click', (e) => {
            const clickPosition = (e.clientX - progressContainer.getBoundingClientRect().left) / progressContainer.offsetWidth;
            audioPlayer.currentTime = clickPosition * audioPlayer.duration;
        });

        // 播放/暂停按钮事件
        playPauseBtn.addEventListener('click', () => {
            if (audioPlayer.paused) {
                audioPlayer.play();
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                audioPlayer.pause();
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        });

        // 上一首/下一首按钮事件
        prevBtn.addEventListener('click', () => this.playPrev());
        nextBtn.addEventListener('click', () => this.playNext());

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    playPauseBtn.click();
                    break;
                case 'ArrowLeft':
                    prevBtn.click();
                    break;
                case 'ArrowRight':
                    nextBtn.click();
                    break;
            }
        });
        window.addEventListener('beforeunload', () => {
            this.savePlayerState();
    });
    }



    // 获取歌曲数据
    async fetchSongs() {
    try {
    // 获取显示的歌曲（用于界面展示）
    const displayResponse = await fetch('/api/songs');
    this.displayedSongs = await displayResponse.json();
    this.initializeSongList();

    // 获取所有歌曲（用于播放控制）
    const allSongsResponse = await fetch('/api/all_songs');
    this.allSongs = await allSongsResponse.json();

    // 在获取到歌曲后恢复播放状态
    const savedSongIndex = localStorage.getItem('songIndex');
    const savedTime = localStorage.getItem('currentTime');
    const savedIsPlayingFromPlaylist = localStorage.getItem('isPlayingFromPlaylist') === 'true';

    if (savedSongIndex !== null) {
        const index = parseInt(savedSongIndex);
        if (savedIsPlayingFromPlaylist) {
            const playlistIndex = parseInt(localStorage.getItem('currentPlaylistIndex'));
            if (playlistIndex !== null) {
                await this.playFromPlaylist(playlistIndex);
            }
        } else {
            await this.playSong(index, false);
        }

        if (savedTime) {
            audioPlayer.currentTime = parseFloat(savedTime);
        }
    }
    } catch (error) {
    console.error('获取歌曲数据时出错:', error);
    }
    }

    // 时间格式化
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 存储播放列表到本地存储
    savePlaylistToStorage() {
        const playlistData = {
            songs: this.playlist,
            currentIndex: this.currentPlaylistIndex
        };
        localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlistData));
    }

    // 从本地存储加载播放列表
    loadPlaylistFromStorage() {
        try {
            const savedPlaylist = localStorage.getItem('musicPlayerPlaylist');
            if (savedPlaylist) {
                const playlistData = JSON.parse(savedPlaylist);
                this.playlist = playlistData.songs;
                this.currentPlaylistIndex = playlistData.currentIndex;
                this.updatePlaylistView();
            }
        } catch (error) {
            console.error('加载播放列表失败:', error);
        }
    }

    // 切换播放列表显示状态
    togglePlaylistView() {
        this.playlistContainer.classList.toggle('show');
    }


    // PlayerController 类的播放控制和播放列表管理方法
    async playSong(index, isFromDisplayList = true) {
        let song;
        if (isFromDisplayList) {
            song = this.displayedSongs[index];
            this.currentSongIndex = this.allSongs.findIndex(s => s.id === song.id);
        } else {
            song = this.allSongs[index];
            this.currentSongIndex = index;
        }

        if (!song) return;

        try {
            // 检查歌曲是否已下载
            if (song) {
                audioPlayer.src = `/api/play/${song.id}`;
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                await audioPlayer.play();
                this.updatePlayerInfo(song);
            }

        } catch (error) {
            console.error('播放出错:', error);
            this.handlePlayError();
        }
        try {
        // 获取并显示歌词
        if (this.lyricsManager) {
            const lyricsResponse = await fetch(`/api/songs/${song.id}/lyrics`);
            if (lyricsResponse.ok) {
                const data = await lyricsResponse.json();
                if (data.lyrics) {
                    this.lyricsManager.setLyrics(data.lyrics);
                    document.getElementById('lyrics-section').style.display = 'block';
                } else {
                    this.lyricsManager.clear();
                }
            }
        }
    } catch (error) {
        console.error('获取歌词失败:', error);
        this.lyricsManager.clear();
    }
    this.lyricsManager.updateTime(localStorage.getItem('currentTime'));
    await this.loadLikeStatus(song.id);
    }
    // 播放列表管理方法
    addToPlaylist(song) {
        if (!this.playlist.some(item => item.id === song.id)) {
            this.playlist.push(song);
            this.updatePlaylistView();
            this.savePlaylistToStorage();
        } else {
        }
    }

    removeFromPlaylist(index) {
        if (index >= 0 && index < this.playlist.length) {
            // 如果移除的是当前播放的歌曲，且不是最后一首
            if (index === this.currentPlaylistIndex && index < this.playlist.length - 1) {
                this.playNextInPlaylist();
            }
            this.playlist.splice(index, 1);
            this.updatePlaylistView();
            this.savePlaylistToStorage();

            // 更新当前播放索引
            if (this.currentPlaylistIndex >= index) {
                this.currentPlaylistIndex--;
            }
        }
    }
    updatePlayModeButton() {

    switch (this.playMode) {
        case PlayMode.SEQUENCE:
            this.playModeButton.innerHTML = '<i class="fas fa-list"></i>';
            this.playModeButton.title = '顺序播放';
            break;
        case PlayMode.RANDOM:
            this.playModeButton.innerHTML = '<i class="fas fa-random"></i>';
            this.playModeButton.title = '随机播放';
            break;
        case PlayMode.REPEAT:
            this.playModeButton.innerHTML = '<i class="fas fa-redo"></i>';
            this.playModeButton.title = '单曲循环';
            break;
    }
}
    // 恢复歌曲信息显示
    restorePlayerState() {
    // 恢复播放模式
    const savedPlayMode = localStorage.getItem('playMode');
    if (savedPlayMode) {
        this.playMode = savedPlayMode;
        // 更新播放模式按钮显示
        this.updatePlayModeButton();
    }

    // 恢复歌曲信息显示
    const savedSongInfo = localStorage.getItem('currentSongInfo');
    if (savedSongInfo) {
        const songInfo = JSON.parse(savedSongInfo);
        currentSongTitle.textContent = songInfo.name;
        currentSongArtist.textContent = songInfo.artist;
        if (songInfo.image_url) {
            currentAlbumArt.src = songInfo.image_url;
        }
    }
    }
    clearPlaylist() {
        this.playlist = [];
        this.currentPlaylistIndex = -1;
        this.isPlayingFromPlaylist = false;
        this.updatePlaylistView();
        this.savePlaylistToStorage();
    }

    updatePlaylistView() {
        const playlistItems = this.playlistContainer.querySelector('.playlist-items');
        playlistItems.innerHTML = '';

        this.playlist.forEach((song, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'playlist-item';
            if (index === this.currentPlaylistIndex && this.isPlayingFromPlaylist) {
                itemElement.classList.add('playing');
            }

            itemElement.innerHTML = `
                <div class="playlist-item-info">
                    <span class="playlist-item-title">${song.name}</span>
                    <span class="playlist-item-artist">${song.artist}</span>
                </div>
                <button class="remove-from-playlist" title="从播放列表中移除">
                    <i class="fas fa-times"></i>
                </button>
            `;

            // 添加点击播放事件
            itemElement.addEventListener('click', () => this.playFromPlaylist(index));

            // 添加移除按钮事件
            itemElement.querySelector('.remove-from-playlist').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFromPlaylist(index);
            });

            playlistItems.appendChild(itemElement);
        });
    }
    // 歌曲喜欢功能逻辑的实现
    async toggleLike() {
        let song = this.allSongs[this.currentSongIndex]

        if (!song)
            return;

        try {
            console.log("Toggling like for current song:", this.currentSongIndex);
            const response = await fetch(`/api/songs/${song.id}/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            });

            const data = await response.json();
            console.log("Like response:", data);

            if (data.status === 'success') {
                this.updateLikeButton(data.is_liked, data.likes_count);
                // 更新列表中的对应按钮
                this.updateSongListLikeButton(song.id, data.is_liked, data.likes_count);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }
    async loadLikeStatus(songId) {
        try {
            const response = await fetch(`/api/songs/${songId}/like-status`);
            const data = await response.json();

            if (data.status === 'success') {
                this.updateLikeButton(data.is_liked, data.likes_count);
            }
        } catch (error) {
            console.error('Error loading like status:', error);
        }
    }

    updateLikeButton(isLiked, likesCount) {
        const icon = this.likeButton.querySelector('i');
        const count = this.likeButton.querySelector('.likes-count');

        this.likeButton.classList.toggle('active', isLiked);
        icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
        count.textContent = likesCount;
    }

    updateSongListLikeButton(songId, isLiked, likesCount) {
        const songItem = document.querySelector(`.song-item[data-song-id="${songId}"]`);
        if (songItem) {
            const likeButton = songItem.querySelector('.like-button');
            if (likeButton) {
                const icon = likeButton.querySelector('i');
                const count = likeButton.querySelector('.likes-count');

                likeButton.classList.toggle('active', isLiked);
                icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
                count.textContent = likesCount;
            }
        }
    }
    // 播放控制方法
    async playFromPlaylist(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.isPlayingFromPlaylist = true;
            this.currentPlaylistIndex = index;
            const song = this.playlist[index];

            try {
                audioPlayer.src = `/api/play/${song.id}`;
                await audioPlayer.play();
                this.updatePlayerInfo(song);
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                this.updatePlaylistView();

                // 获取并显示歌词
                const lyricsResponse = await fetch(`/api/songs/${song.id}/lyrics`);
                if (lyricsResponse.ok) {
                    const data = await lyricsResponse.json();
                    if (this.lyricsManager) {
                        this.lyricsManager.setLyrics(data.lyrics);
                        document.getElementById('lyrics-section').style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('播放出错:', error);
                this.handlePlayError();
            }
        }
    }

    playNext() {
        if (this.isPlayingFromPlaylist) {
            this.playNextInPlaylist();
        } else {
            if (this.allSongs.length === 0) return;

            let nextIndex;
            switch (this.playMode) {
                case PlayMode.SEQUENCE:
                    nextIndex = (this.currentSongIndex + 1) % this.allSongs.length;
                    break;
                case PlayMode.RANDOM:
                    do {
                        nextIndex = Math.floor(Math.random() * this.allSongs.length);
                    } while (nextIndex === this.currentSongIndex && this.allSongs.length > 1);
                    break;
                case PlayMode.REPEAT:
                    nextIndex = this.currentSongIndex;
                    break;
            }
            this.playSong(nextIndex, false);
        }
    }

    playPrev() {
        if (this.isPlayingFromPlaylist) {
            this.playPrevInPlaylist();
        } else {
            if (this.allSongs.length === 0) return;

            if (audioPlayer.currentTime > 3) {
                audioPlayer.currentTime = 0;
                return;
            }

            let prevIndex;
            switch (this.playMode) {
                case PlayMode.SEQUENCE:
                    prevIndex = (this.currentSongIndex - 1 + this.allSongs.length) % this.allSongs.length;
                    break;
                case PlayMode.RANDOM:
                    do {
                        prevIndex = Math.floor(Math.random() * this.allSongs.length);
                    } while (prevIndex === this.currentSongIndex && this.allSongs.length > 1);
                    break;
                case PlayMode.REPEAT:
                    prevIndex = this.currentSongIndex;
                    break;
            }
            this.playSong(prevIndex, false);
        }
    }

    playNextInPlaylist() {
        if (this.isPlayingFromPlaylist && this.playlist.length > 0) {
            const nextIndex = (this.currentPlaylistIndex + 1) % this.playlist.length;
            this.playFromPlaylist(nextIndex);
        }
    }

    playPrevInPlaylist() {
        if (this.isPlayingFromPlaylist && this.playlist.length > 0) {
            const prevIndex = (this.currentPlaylistIndex - 1 + this.playlist.length) % this.playlist.length;
            this.playFromPlaylist(prevIndex);
        }
    }

    updatePlayerInfo(song) {
        currentSongTitle.textContent = song.name;
        currentSongArtist.textContent = song.artist;
        if (song.image_url) {
            currentAlbumArt.src = song.image_url;
        } else {
            currentAlbumArt.src = '/static/images/default-album.png';
        }
    }

    handlePlayError() {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    togglePlayMode() {
        switch (this.playMode) {
            case PlayMode.SEQUENCE:
                this.playMode = PlayMode.RANDOM;
                this.playModeButton.innerHTML = '<i class="fas fa-random"></i>';
                this.playModeButton.title = '随机播放';
                break;
            case PlayMode.RANDOM:
                this.playMode = PlayMode.REPEAT;
                this.playModeButton.innerHTML = '<i class="fas fa-redo"></i>';
                this.playModeButton.title = '单曲循环';
                break;
            case PlayMode.REPEAT:
                this.playMode = PlayMode.SEQUENCE;
                this.playModeButton.innerHTML = '<i class="fas fa-list"></i>';
                this.playModeButton.title = '顺序播放';
                break;
        }
    }
    savePlayerState() {
    // 保存基本播放信息
    localStorage.setItem('currentTime', audioPlayer.currentTime);
    localStorage.setItem('songIndex', this.currentSongIndex);
    localStorage.setItem('playMode', this.playMode);

    // 保存播放列表相关信息
    localStorage.setItem('currentPlaylistIndex', this.currentPlaylistIndex);
    localStorage.setItem('isPlayingFromPlaylist', this.isPlayingFromPlaylist);

    // 保存当前播放的歌曲信息
    if (this.currentSongIndex >= 0 && this.allSongs[this.currentSongIndex]) {
        const currentSong = this.allSongs[this.currentSongIndex];
        localStorage.setItem('currentSongInfo', JSON.stringify({
            name: currentSong.name,
            artist: currentSong.artist,
            image_url: currentSong.image_url
        }));
    }
    }

}

// 确保正确引入了 Cropper.js
// document.addEventListener('DOMContentLoaded', () => {
//   const cropperModal = document.getElementById('cropperModal');
//   const closeCropperModal = document.getElementById('closeCropperModal');
//
//   // 修复模态框显示隐藏
//   if (closeCropperModal) {
//     closeCropperModal.addEventListener('click', () => {
//       cropperModal.classList.add('hidden');
//     });
//   }
//
//   // 点击模态框外部关闭
//   cropperModal.addEventListener('click', (e) => {
//     if (e.target === cropperModal) {
//       cropperModal.classList.add('hidden');
//     }
//   });
//
//   // ESC 键关闭模态框
//   document.addEventListener('keydown', (e) => {
//     if (e.key === 'Escape' && !cropperModal.classList.contains('hidden')) {
//       cropperModal.classList.add('hidden');
//     }
//   });
// });

