class LyricsManager {
    constructor(container) {
        this.container = container;
        this.lyrics = [];
        this.activeIndex = -1;
        this.init();
    }

    init() {
        // 简化容器结构
        this.container.innerHTML = `
            <div class="lyrics-wrapper">
                <div class="lyrics-inner"></div>
            </div>
        `;

        this.lyricsInner = this.container.querySelector('.lyrics-inner');
    }

    setLyrics(lyricsData) {
        this.lyrics = lyricsData;
        this.render();
    }

    render() {
        // 只渲染当前行和下一行
        this.updateDisplay();
    }

    updateDisplay() {
        if (this.activeIndex >= 0 && this.activeIndex < this.lyrics.length) {
            const currentLyric = this.lyrics[this.activeIndex];
            const nextLyric = this.lyrics[this.activeIndex + 1];

            this.lyricsInner.innerHTML = `
                <div class="lyric-line active animate">${currentLyric.text}</div>
                ${nextLyric ? `<div class="lyric-line next">${nextLyric.text}</div>` : ''}
            `;
        }
    }

    updateTime(currentTime) {
        const newActiveIndex = this.lyrics.findIndex((line, index) => {
            const nextLine = this.lyrics[index + 1];
            return currentTime >= line.timestamp &&
                   (!nextLine || currentTime < nextLine.timestamp);
        });

        if (newActiveIndex !== -1 && newActiveIndex !== this.activeIndex) {
            this.activeIndex = newActiveIndex;
            this.updateDisplay();
        }
    }

    clear() {
        this.lyrics = [];
        this.activeIndex = -1;
        this.lyricsInner.innerHTML = '';
    }
}

// 在页面加载完成后添加字体
document.addEventListener('DOMContentLoaded', () => {
    // 添加思源宋体
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
});