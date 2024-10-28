// songs.js
document.addEventListener('DOMContentLoaded', function() {
    let page = 1;
    const pageSize = 8;
    let loading = false;
    let hasMore = true;
    let loadingTimeout;

    const songListContainer = document.getElementById('song-list-container');
    const loadingIndicator = createLoadingIndicator();
    songListContainer.parentElement.appendChild(loadingIndicator);

    // 初始加载
    loadSongs();

    // 使用Intersection Observer优化滚动加载
    const observerOptions = {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !loading && hasMore) {
                loadSongs();
            }
        });
    }, observerOptions);

    observer.observe(loadingIndicator);

    // 加载歌曲函数
    function loadSongs() {
        if (loading) return;

        loading = true;
        showLoading();

        // 添加延迟以防止快速滚动导致的频繁请求
        clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(() => {
            fetch(`/api/songs?page=${page}&size=${pageSize}`)
                .then(response => response.json())
                .then(data => {
                    if (data.songs.length < pageSize) {
                        hasMore = false;
                        hideLoading();
                    }

                    const fragment = document.createDocumentFragment();
                    data.songs.forEach(song => {
                        const songElement = createSongElement(song);
                        fragment.appendChild(songElement);
                    });

                    // 使用DocumentFragment批量添加元素，减少重排
                    songListContainer.appendChild(fragment);

                    page++;
                    loading = false;

                    if (hasMore) {
                        hideLoading();
                    }
                })
                .catch(error => {
                    console.error('Error loading songs:', error);
                    loading = false;
                    hideLoading();
                    showErrorMessage('加载失败，请稍后重试');
                });
        }, 300);
    }

    // 创建歌曲元素
    function createSongElement(song) {
        const div = document.createElement('div');
        div.className = 'song-item';
        div.dataset.songId = song.id;

        div.innerHTML = `
            <img src="${song.image_url}" alt="${song.name} album art" loading="lazy">
            <div class="song-info">
                <h4>${escapeHtml(song.name)}</h4>
                <p>${escapeHtml(song.artist)}</p>
            </div>
            <div class="song-duration">${formatDuration(song.duration)}</div>
            <button class="play-button" aria-label="播放 ${escapeHtml(song.name)}">
                <i class="fas fa-play"></i>
            </button>
        `;

        // 使用事件委托处理点击事件
        div.querySelector('.play-button').addEventListener('click', (e) => {
            e.stopPropagation();
            playSong(song);
        });

        return div;
    }

    // 创建加载指示器
    function createLoadingIndicator() {
        const div = document.createElement('div');
        div.className = 'loading-indicator';
        div.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
        return div;
    }

    function showLoading() {
        loadingIndicator.classList.add('visible');
    }

    function hideLoading() {
        loadingIndicator.classList.remove('visible');
    }

    // 显示错误信息
    function showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        songListContainer.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    // HTML转义函数防止XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


});