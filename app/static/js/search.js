// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 格式化时长
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const resultsContainer = document.getElementById('results-container');
    const searchSuggestions = document.getElementById('search-suggestions');
    const contentWrapper = document.querySelector('.content-wrapper');

    // 当前搜索状态
    let isSearching = false;

    // 显示搜索建议
    const showSuggestions = (songs) => {
        if (songs.length > 0) {
            searchSuggestions.innerHTML = songs.map(song => `
                <div class="suggestion-item" data-song-id="${song.id}">
                    <img src="${song.image_url || '/static/images/default-album.png'}" alt="${song.title}">
                    <div class="suggestion-info">
                        <div class="suggestion-title">${song.title}</div>
                        <div class="suggestion-artist">${song.artist}</div>
                    </div>
                </div>
            `).join('');
        } else {
            searchSuggestions.innerHTML = '<div class="no-results">未找到相关歌曲</div>';
        }
        searchSuggestions.style.display = 'block';
    };

    // 显示搜索结果
    const showSearchResults = (songs) => {
        searchResults.style.display = 'block';
        if (songs.length > 0) {
            resultsContainer.innerHTML = songs.map(song => `
                <div class="song-item" data-song-id="${song.id}">
                    <img src="${song.image_url || '/static/images/default-album.png'}" alt="${song.title}">
                    <div class="song-info">
                        <h4>${song.title}</h4>
                        <p>${song.artist}</p>
                    </div>
                    <div class="song-duration">${formatDuration(song.duration || 0)}</div>
                    <button class="play-button" data-song-id="${song.id}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="download-button" data-song="${song.title}" data-artist="${song.artist}">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = '<div class="no-results">未找到相关歌曲</div>';
        }

    };

    // 隐藏搜索结果
    const hideSearchResults = () => {
        searchResults.style.display = 'none';
        const photoOfDay = document.querySelector('.photo-of-the-day');
        const songList = document.querySelector('.song-list');
        photoOfDay.style.display = 'block';
        songList.style.display = 'block';
        isSearching = false;
    };

    // 搜索处理函数
    const handleSearch = async (query) => {
        if (!query) {
            hideSearchResults();
            return;
        }

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('搜索请求失败');

            const songs = await response.json();
            showSearchResults(songs);
            isSearching = true;
        } catch (error) {
            console.error('搜索错误:', error);
            resultsContainer.innerHTML = '<div class="error-message">搜索出错，请稍后重试</div>';
        }
    };

    // 下载处理函数
    const handleDownload = async (songName, artistName) => {
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    song: songName,
                    artist: artistName
                })
            });

            const result = await response.json();
            if (result.success) {
                alert('下载成功！');
            } else {
                alert(result.message || '下载失败，请稍后重试');
            }
        } catch (error) {
            console.error('下载错误:', error);
            alert('下载出错，请稍后重试');
        }
    };

    // 搜索输入事件
    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        if (query) {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const songs = await response.json();
                showSuggestions(songs);
            } catch (error) {
                console.error('搜索建议错误:', error);
                searchSuggestions.innerHTML = '<div class="error-message">加载建议时出错</div>';
            }
        } else {
            searchSuggestions.style.display = 'none';
        }
        hiddenOthers()
    }, 300));

    // 搜索按钮点击事件
    searchButton.addEventListener('click', () => {

        const query = searchInput.value.trim();
        handleSearch(query);
        searchSuggestions.style.display = 'none';

        hiddenOthers();
    });

    // 搜索建议点击事件
    searchSuggestions.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestion-item');
        if (suggestionItem) {
            const title = suggestionItem.querySelector('.suggestion-title').textContent;
            searchInput.value = title;
            handleSearch(title);
            searchSuggestions.style.display = 'none';
        }
    });

    // 搜索结果区域点击事件
    resultsContainer.addEventListener('click', (e) => {
        // 处理下载按钮点击
        if (e.target.closest('.download-button')) {
            const button = e.target.closest('.download-button');
            const songName = button.dataset.song;
            const artistName = button.dataset.artist;
            handleDownload(songName, artistName);
        }

        // 处理播放按钮点击
        if (e.target.closest('.play-button')) {
            const button = e.target.closest('.play-button');
            const songId = button.dataset.songId;
            // 触发播放事件
            const playEvent = new CustomEvent('playSong', { detail: { songId } });
            document.dispatchEvent(playEvent);
        }
    });

    // 按回车搜索
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            handleSearch(query);
            searchSuggestions.style.display = 'none';
        }

        hiddenOthers();
    });

    // 点击外部关闭搜索建议
    document.addEventListener('click', (e) => {
        if (!searchWrapper.contains(e.target)) {
            searchSuggestions.style.display = 'none';
        }
    });
    function hiddenOthers(){
        // 调整其他内容的显示
        const photoOfDay = document.querySelector('.photo-of-the-day');
        const songList = document.querySelector('.song-list');
        if (isSearching) {
            photoOfDay.style.display = 'none';
            songList.style.display = 'none';
        }
    }
});