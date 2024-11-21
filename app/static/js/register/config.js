// config.js
const CONSTANTS = {
    // 文件相关配置
    FILE: {
        MAX_SIZE: 5 * 1024 * 1024,
        ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
        IMAGE_QUALITY: 0.9,
        OUTPUT_SIZE: {
            width: 200,
            height: 200
        }
    },

    // 安全相关配置
    SECURITY: {
        CSRF_HEADER: 'X-CSRF-Token',
        PASSWORD_MIN_LENGTH: 8,
        MAX_USERNAME_LENGTH: 20,
        EMAIL_REGEX: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    },

    // API 相关配置
    API: {
        ENDPOINTS: {
            REGISTER: '/register',
            VALIDATE_EMAIL: '/validate-email',
            SEND_CODE: '/send-verification-code'
        },
        TIMEOUT: 10000,
        RETRY_ATTEMPTS: 3
    },

    // UI相关配置
    UI: {
        ANIMATION_DURATION: 300,
        DEBOUNCE_DELAY: 300,
        COOLDOWN_TIME: 120
    }
};

// 工具函数
const utils = {
    // XSS防护
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 错误处理
    handleError(error, defaultMessage = '操作失败') {
        console.error(error);
        return {
            success: false,
            message: error?.message || defaultMessage
        };
    },

    // 安全的获取DOM元素
    getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id "${id}" not found`);
        }
        return element;
    },

    // URL安全处理
    createSafeUrl(blob) {
        const url = URL.createObjectURL(blob);
        setTimeout(() => URL.revokeObjectURL(url), 60000); // 60秒后自动释放
        return url;
    },
  showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = this.escapeHtml(message);
      element.style.display = 'block';
      element.setAttribute('role', 'alert');
      element.classList.add('error-shake');
      setTimeout(() => element.classList.remove('error-shake'), 500);
    }
  }
};

// HTTP请求封装
class HttpClient {
    constructor() {
        this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    }

    async request(url, options = {}) {
        const config = {
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                [CONSTANTS.SECURITY.CSRF_HEADER]: this.csrfToken,
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            return utils.handleError(error);
        }
    }

    // GET请求
    get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    // POST请求
    post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}
export { CONSTANTS, utils, HttpClient };