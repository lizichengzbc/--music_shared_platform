class SongLoader {
    constructor() {
        // 初始化状态变量
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.isExpanded = false;

        // 缓存 DOM 元素
        this.container = document.getElementById('song-list-container');
        this.loadMoreBtn = document.getElementById('load-more');
        this.statusElement = document.getElementById('songs-status');
        this.songList = document.querySelector('.song-list');
        this.loadMoreWrapper = document.querySelector('.load-more-wrapper');
        this.fadeOverlay = document.querySelector('.fade-overlay');

        // 绑定事件处理
        this.loadMoreBtn.addEventListener('click', () => {
            if (!this.isExpanded) {
                this.songList.classList.add('expanded');
                this.isExpanded = true;
                this.updateButtonState();
            }
            if (!this.isLoading && this.hasMore) {
                this.loadMoreSongs();
            }
        });

        // 初始加载
        this.loadInitialSongs();
    }

    // 更新按钮状态和显示
    updateButtonState() {
        if (!this.hasMore) {
            // 当没有更多歌曲时，隐藏整个加载更多区域
            this.loadMoreWrapper.style.display = 'none';
            this.fadeOverlay.style.display = 'none';
            this.loadMoreBtn.classList.add('disabled');
            this.loadMoreBtn.innerHTML = '<i class="fas fa-check"></i><span>已加载全部</span>';
        } else if (this.isLoading) {
            this.loadMoreBtn.classList.add('loading');
            this.loadMoreBtn.innerHTML = '<span>加载中...</span>';
        } else if (!this.isExpanded) {
            this.loadMoreBtn.classList.remove('disabled', 'loading');
            this.loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>展开更多</span>';
        } else {
            this.loadMoreBtn.classList.remove('disabled', 'loading');
            this.loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>加载更多</span>';
        }
    }

    // 更新已加载歌曲状态
    updateStatus(totalLoaded, total) {
        if (total === totalLoaded) {
            // 如果已加载数量等于总数，隐藏状态显示和加载更多区域
            this.statusElement.style.display = 'none';
            this.loadMoreWrapper.style.display = 'none';
            this.fadeOverlay.style.display = 'none';
        } else if (total) {
            this.statusElement.innerHTML = `
                <i class="fas fa-music"></i>
                <span>已加载 ${totalLoaded} / ${total} 首歌曲</span>
            `;
            this.statusElement.style.display = 'block';
        } else {
            this.statusElement.innerHTML = `
                <i class="fas fa-music"></i>
                <span>已加载 ${totalLoaded} 首歌曲</span>
            `;
            this.statusElement.style.display = 'block';
        }
    }

    // 格式化歌曲时长
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 创建单个歌曲元素
 createSongElement(song) {
    const songElement = document.createElement('div');
    songElement.className = 'song-item';
    songElement.setAttribute('data-song-id', song.id);

    // 转义处理歌曲信息
    const escapedSong = {
        ...song,
        name: this.escapeHtml(song.name),
        artist: this.escapeHtml(song.artist),
        album: this.escapeHtml(song.album || 'Unknown Album')
    };

    songElement.innerHTML = `
        <img src="${escapedSong.image_url}" alt="${escapedSong.name}" 
            onerror="this.src='/static/images/default-album.png'">
        <div class="song-info">
            <h4>${escapedSong.name}</h4>
            <p>${escapedSong.artist}</p>
        </div>
        <div class="song-duration">
            ${this.formatDuration(escapedSong.duration)}
        </div>
        <div class="song-controls">
            <button class="play-button" title="播放">
                <i class="fas fa-play"></i>
            </button>
            <button class="add-to-playlist" title="添加到播放列表">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;

    // 获取按钮元素
    const playButton = songElement.querySelector('.play-button');
    const addToPlaylistBtn = songElement.querySelector('.add-to-playlist');

    // 播放按钮事件
    playButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.player) {
            const songIndex = window.player.displayedSongs.findIndex(s => s.id === song.id);
            window.player.playSong(songIndex, true);

            // 更新按钮图标
            const icons = songElement.querySelectorAll('.play-button i');
            icons.forEach(icon => {
                icon.className = audioPlayer.paused ? 'fas fa-play' : 'fas fa-pause';
            });
        }
    });

    // 添加到播放列表按钮事件
    addToPlaylistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.player && !addToPlaylistBtn.disabled) {
            window.player.addToPlaylist(song, addToPlaylistBtn);
        }
    });

    // 如果是当前播放的歌曲，添加playing类
    if (window.player && window.player.currentSongIndex === song.id) {
        songElement.classList.add('playing');
        playButton.querySelector('i').className = 'fas fa-pause';
    }

    return songElement;
}

    // HTML 转义
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 安全的 JSON 字符串化
    safeStringify(obj) {
        return JSON.stringify(obj).replace(/[<>]/g, '');
    }

    // 加载初始歌曲
    async loadInitialSongs() {
        try {
            const response = await fetch('/api/songs');
            const songs = await response.json();

            if (songs && songs.length > 0) {
                this.container.innerHTML = '';
                const fragment = document.createDocumentFragment();
                songs.forEach(song => {
                    fragment.appendChild(this.createSongElement(song));
                });
                this.container.appendChild(fragment);
                this.updateStatus(songs.length);

                // 检查是否需要显示加载更多按钮
                const totalSongsResponse = await fetch('/api/songs/total');
                const { total } = await totalSongsResponse.json();
                this.hasMore = songs.length < total;

                if (!this.hasMore) {
                    this.loadMoreWrapper.style.display = 'none';
                    this.fadeOverlay.style.display = 'none';
                }
            } else {
                this.container.innerHTML = '<div class="empty-message">暂无歌曲</div>';
                this.hasMore = false;
                this.loadMoreWrapper.style.display = 'none';
                this.fadeOverlay.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading initial songs:', error);
            this.container.innerHTML = '<div class="error-message">加载歌曲失败，请稍后重试</div>';
            this.hasMore = false;
            this.loadMoreWrapper.style.display = 'none';
            this.fadeOverlay.style.display = 'none';
        }
        this.updateButtonState();
    }

    // 加载更多歌曲
    async loadMoreSongs() {
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;
        this.updateButtonState();

        try {
            const response = await fetch(`/api/songsLoading?page=${this.currentPage + 1}&per_page=8`);
            const data = await response.json();

            if (data.songs && data.songs.length > 0) {
                const fragment = document.createDocumentFragment();
                data.songs.forEach(song => {
                    fragment.appendChild(this.createSongElement(song));
                });
                this.container.appendChild(fragment);
                this.currentPage++;

                // 更新总数和加载状态
                this.updateStatus(data.total_loaded, data.total);

                // 检查是否还有更多歌曲
                this.hasMore = data.has_more;

                // 如果没有更多歌曲，隐藏相关元素
                if (!this.hasMore) {
                    this.loadMoreWrapper.style.display = 'none';
                    this.fadeOverlay.style.display = 'none';
                }
            } else {
                this.hasMore = false;
                this.loadMoreWrapper.style.display = 'none';
                this.fadeOverlay.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading more songs:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = '加载更多歌曲失败，请稍后重试';
            this.container.appendChild(errorDiv);
        } finally {
            this.isLoading = false;
            this.updateButtonState();
        }
    }

    // 显示错误信息
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        this.container.appendChild(errorDiv);

        // 3秒后自动移除错误信息
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
}

// 当 DOM 加载完成后初始化 SongLoader
document.addEventListener('DOMContentLoaded', () => {
    window.songLoader = new SongLoader();
});