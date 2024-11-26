// search.js
class SearchManager {
    constructor() {
        this.initializeElements();
        this.isSearching = false;
        this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        this.initEventListeners();
    }

    initializeElements() {
        this.elements = {
            wrapper: document.querySelector('.search-wrapper'),
            input: document.getElementById('search-input'),
            button: document.getElementById('search-button'),
            results: document.getElementById('search-results'),
            suggestions: document.getElementById('search-suggestions'),
            resultsContainer: document.getElementById('results-container'),
            contentWrapper: document.querySelector('.content-wrapper')
        };
    }

    initEventListeners() {
        // 搜索输入事件
        this.elements.input.addEventListener('input',
            this.debounce(e => this.handleInputChange(e.target.value.trim()), 300));

        // 搜索按钮点击
        this.elements.button.addEventListener('click',
            () => this.handleSearchClick());

        // 搜索建议点击
        this.elements.suggestions.addEventListener('click',
            e => this.handleSuggestionClick(e));

        // 搜索结果点击
        this.elements.resultsContainer.addEventListener('click',
            e => this.handleResultClick(e));

        // Enter键搜索
        this.elements.input.addEventListener('keypress',
            e => e.key === 'Enter' && this.handleSearchClick());

        // 点击外部关闭搜索建议
        document.addEventListener('click',
            e => this.handleClickOutside(e));
    }

    async handleInputChange(query) {
        if (!query) {
            this.hideSuggestions();
            return;
        }

        try {
            const songs = await this.fetchSearchResults(query);
            this.showSuggestions(songs);
            this.updateContentVisibility();
        } catch (error) {
            console.error('搜索建议错误:', error);
            this.showError('加载建议时出错');
        }
    }

    async handleSearchClick() {
        const query = this.elements.input.value.trim();
        await this.handleSearch(query);
        this.hideSuggestions();
        this.updateContentVisibility();
    }

    handleSuggestionClick(e) {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            const title = item.querySelector('.suggestion-title').textContent;
            this.elements.input.value = title;
            this.handleSearch(title);
            this.hideSuggestions();
        }
    }

    handleResultClick(e) {
        const downloadBtn = e.target.closest('.download-button');
        if (downloadBtn) {
            const { song, artist } = downloadBtn.dataset;
            this.handleDownload(song, artist,downloadBtn);
            return;
        }

        const playBtn = e.target.closest('.play-button');
        if (playBtn) {
            const { songId } = playBtn.dataset;
            document.dispatchEvent(new CustomEvent('playSong', { detail: { songId } }));
        }
    }

    handleClickOutside(e) {
        if (!this.elements.wrapper.contains(e.target)) {
            this.hideSuggestions();
        }
    }

    async handleSearch(query) {
        if (!query) {
            this.hideSearchResults();
            return;
        }

        try {
            const songs = await this.fetchSearchResults(query);
            this.showSearchResults(songs);
            this.isSearching = true;
        } catch (error) {
            console.error('搜索错误:', error);
            this.showError('搜索出错，请稍后重试');
        }
    }

    async handleDownload(songName, artistName, button) {
        if(!button) return;
        try {
            button.classList.add('loading');
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({ song: songName, artist: artistName })
            });

            const result = await response.json();
            this.showNotification(result.success ? '下载成功！' : result.message || '下载失败');
        } catch (error) {
            console.error('下载错误:', error);
            this.showNotification('下载失败，请稍后重试', 'error');
        } finally {
            button.classList.remove('loading');
        }
    }

    async fetchSearchResults(query) {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('搜索请求失败');
        return response.json();
    }

    showSuggestions(songs) {
        this.elements.suggestions.innerHTML = songs.length ?
            this.createSuggestionsHTML(songs) :
            '<div class="no-results">未找到相关歌曲</div>';
        this.elements.suggestions.style.display = 'block';
    }

    showSearchResults(songs) {
        this.elements.results.style.display = 'block';
        this.elements.resultsContainer.innerHTML = songs.length ?
            songs.map(song => this.createSongElement(song)).join('') :
            '<div class="no-results">未找到相关歌曲</div>';
    }

    createSuggestionsHTML(songs) {
        return songs.map(song => `
            <div class="suggestion-item" data-song-id="${song.id}">
                <img src="${song.image_url || '/static/images/default-album.png'}" alt="${song.title}">
                <div class="suggestion-info">
                    <div class="suggestion-title">${song.title}</div>
                    <div class="suggestion-artist">${song.artist}</div>
                </div>
            </div>
        `).join('');
    }

    createSongElement(song) {
        return `
            <div class="song-item" data-song-id="${song.id}">
                <img src="${song.image_url || '/static/images/default-album.png'}" alt="${song.title}">
                <div class="song-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist}</p>
                </div>
                <div class="song-duration">${this.formatDuration(song.duration || 0)}</div>
                <button class="play-button" data-song-id="${song.id}">
                    <i class="fas fa-play"></i>
                </button>
                <button class="download-button" data-song="${song.title}" data-artist="${song.artist}">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;
    }

    hideSuggestions() {
        this.elements.suggestions.style.display = 'none';
    }

    hideSearchResults() {
        this.elements.results.style.display = 'none';
        this.isSearching = false;
        this.updateContentVisibility();
    }

    updateContentVisibility() {
        const elements = ['.photo-of-the-day', '.song-list'];
        elements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = this.isSearching ? 'none' : 'block';
            }
        });
    }

    showError(message) {
        this.elements.resultsContainer.innerHTML = `
            <div class="error-message">${message}</div>
        `;
    }

    showNotification(message, type = 'success') {
        alert(message); // 可以替换为更好的通知系统
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

}

// 初始化搜索管理器
document.addEventListener('DOMContentLoaded', () => {
    window.searchManager = new SearchManager();
});