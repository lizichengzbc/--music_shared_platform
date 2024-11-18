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
    // 假设 lyricsData 是一个字典，格式为 { '00:00.00': '歌词文本', ... }
    // 将其转换为数组格式 [{ text: '歌词文本', timestamp: '00:00.00' }, ...]

    this.lyrics = this.convertLyricsFormat(lyricsData);
    // 调用更新显示的函数
    this.render();
}
    convertLyricsFormat(lyricsDict) {
        if (!lyricsDict || Object.keys(lyricsDict).length === 0) {
            return [];
        }

        // 将字典格式转换为数组格式
        return Object.entries(lyricsDict)
            .map(([timestamp, text]) => ({
                timestamp: this.parseTimestamp(timestamp),
                text: text
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }
    render() {
        // 只渲染当前行和下一行
        this.updateDisplay();
    }
    parseTimestamp(timestamp) {
        // 将 "mm:ss.ms" 格式转换为秒数
        const [minutes, seconds] = timestamp.split(':');
        return parseInt(minutes) * 60 + parseFloat(seconds);
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