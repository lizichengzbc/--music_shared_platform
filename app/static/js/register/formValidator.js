// formValidator.js
import { CONSTANTS, utils } from './config.js';

class ValidationRule {
    constructor(validate, message) {
        this.validate = validate;
        this.message = message;
    }

    async check(value, formData = {}) {
        try {
            const result = this.validate(value, formData);
            return result instanceof Promise ? await result : result;
        } catch (error) {
            console.error('Validation error:', error);
            return false;
        }
    }
}

class FormField {
    constructor(name, element, errorElement, rules = []) {
        this.name = name;
        this.element = element;
        this.errorElement = errorElement;
        this.rules = rules.map(rule => new ValidationRule(rule.validate, rule.message));
        this.isValid = true;
        this.errorMessage = '';
    }

    getValue() {
        return this.element?.value?.trim() ?? '';
    }

    async validate(formData = {}) {
        const value = this.getValue();

        for (const rule of this.rules) {
            const isValid = await rule.check(value, formData);
            if (!isValid) {
                this.isValid = false;
                this.errorMessage = rule.message;
                return false;
            }
        }

        this.isValid = true;
        this.errorMessage = '';
        return true;
    }

    showError() {
        if (!this.errorElement) return;

        this.errorElement.textContent = utils.escapeHtml(this.errorMessage);
        this.errorElement.style.display = 'block';
        this.errorElement.setAttribute('role', 'alert');
        this.element?.classList.add('error');

        // 添加错误动画
        this.errorElement.classList.add('error-shake');
        setTimeout(() => {
            this.errorElement.classList.remove('error-shake');
        }, 500);
    }

    clearError() {
        if (!this.errorElement) return;

        this.errorElement.textContent = '';
        this.errorElement.style.display = 'none';
        this.errorElement.removeAttribute('role');
        this.element?.classList.remove('error');

        this.isValid = true;
        this.errorMessage = '';
    }
}

export class FormValidator {
    constructor(formId, options = {}) {
        this.form = document.getElementById(formId);
        if (!this.form) {
            throw new Error(`Form with id '${formId}' not found`);
        }

        this.options = {
            validateOnBlur: true,
            validateOnInput: true,
            debounceDelay: 300,
            ...options
        };

        this.state = {
            isSubmitting: false,
            hasChanges: false,
            originalValues: new Map()
        };

        this.fields = this.initializeFields();
        this.bindEvents();
        this.saveInitialState();
    }

    initializeFields() {
        return {
            username: new FormField(
                'username',
                this.form.querySelector('#username'),
                this.form.querySelector('#username-error'),
                [
                    {
                        validate: value => !!value,
                        message: '请输入用户名'
                    },
                    {
                        validate: value => value.length >= 3,
                        message: '用户名至少需要3个字符'
                    },
                    {
                        validate: value => value.length <= CONSTANTS.SECURITY.MAX_USERNAME_LENGTH,
                        message: `用户名不能超过${CONSTANTS.SECURITY.MAX_USERNAME_LENGTH}个字符`
                    },
                    {
                        validate: value => /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(value),
                        message: '用户名只能包含字母、数字、下划线和汉字'
                    }
                ]
            ),

            email: new FormField(
                'email',
                this.form.querySelector('#email'),
                this.form.querySelector('#email-error'),
                [
                    {
                        validate: value => !!value,
                        message: '请输入邮箱地址'
                    },
                    {
                        validate: value => CONSTANTS.SECURITY.EMAIL_REGEX.test(value),
                        message: '请输入有效的邮箱地址'
                    }
                ]
            ),

            password: new FormField(
                'password',
                this.form.querySelector('#password'),
                this.form.querySelector('#password-error'),
                [
                    {
                        validate: value => !!value,
                        message: '请输入密码'
                    },
                    {
                        validate: value => value.length >= CONSTANTS.SECURITY.PASSWORD_MIN_LENGTH,
                        message: `密码至少需要${CONSTANTS.SECURITY.PASSWORD_MIN_LENGTH}个字符`
                    },
                    {
                        validate: value => /(?=.*[A-Za-z])/.test(value),
                        message: '密码必须包含字母'
                    },
                    {
                        validate: value => /(?=.*\d)/.test(value),
                        message: '密码必须包含数字'
                    }
                ]
            ),

            password2: new FormField(
                'password2',
                this.form.querySelector('#password2'),
                this.form.querySelector('#password2-error'),
                [
                    {
                        validate: value => !!value,
                        message: '请再次输入密码'
                    },
                    {
                        validate: (value, formData) => value === formData.password,
                        message: '两次输入的密码不一致'
                    }
                ]
            ),

            verificationCode: new FormField(
                'verificationCode',
                this.form.querySelector('#verification_code'),
                this.form.querySelector('#code-error'),
                [
                    {
                        validate: value => !!value,
                        message: '请输入验证码'
                    },
                    {
                        validate: value => /^\d{6}$/.test(value),
                        message: '验证码必须是6位数字'
                    }
                ]
            ),

            gender: new FormField(
                'gender',
                this.form.querySelector('input[name="gender"]:checked'),
                this.form.querySelector('#gender-error'),
                [
                    {
                        validate: value => !!value,
                        message: '请选择性别'
                    }
                ]
            )
        };
    }

    bindEvents() {
        // 防止重复提交
        this.form.addEventListener('submit', (e) => {
            if (this.state.isSubmitting) {
                e.preventDefault();
                return;
            }
        });

        // 字段验证事件
        Object.values(this.fields).forEach(field => {
            if (!field.element) return;

            if (this.options.validateOnBlur) {
                field.element.addEventListener('blur', () => {
                    this.validateField(field.name);
                });
            }

            if (this.options.validateOnInput) {
                field.element.addEventListener('input',
                    utils.debounce(() => {
                        this.validateField(field.name);
                        this.updatePasswordStrength(field.name);
                        this.state.hasChanges = true;
                    }, this.options.debounceDelay)
                );
            }
        });

        // 监听密码强度
        const passwordField = this.fields.password;
        if (passwordField?.element) {
            passwordField.element.addEventListener('input',
                utils.debounce(() => {
                    this.updatePasswordStrength();
                }, this.options.debounceDelay)
            );
        }
    }

    async validateField(fieldName) {
        const field = this.fields[fieldName];
        if (!field) return false;

        // 特殊处理性别字段
        if (fieldName === 'gender') {
            field.element = this.form.querySelector('input[name="gender"]:checked');
        }

        const formData = this.getFormData();
        const isValid = await field.validate(formData);

        if (!isValid) {
            field.showError();
        } else {
            field.clearError();
        }

        return isValid;
    }

    updatePasswordStrength() {
        const passwordField = this.fields.password;
        const strengthIndicator = this.form.querySelector('#password-strength');
        if (!passwordField?.element || !strengthIndicator) return;

        const password = passwordField.getValue();
        const strength = this.calculatePasswordStrength(password);

        strengthIndicator.className = `password-strength strength-${strength.level}`;
        strengthIndicator.textContent = strength.message;
    }

    calculatePasswordStrength(password) {
        if (!password) return { level: 'none', message: '' };

        let score = 0;
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /\d/.test(password),
            symbols: /[@$!%*?&]/.test(password)
        };

        score += Object.values(checks).filter(Boolean).length;

        const strengthLevels = {
            1: { level: 'weak', message: '密码强度：弱' },
            2: { level: 'medium', message: '密码强度：中' },
            3: { level: 'strong', message: '密码强度：强' },
            4: { level: 'very-strong', message: '密码强度：非常强' }
        };

        return strengthLevels[score] || { level: 'weak', message: '密码强度：弱' };
    }

    async validateForm() {
        this.state.isSubmitting = true;
        const validationPromises = Object.keys(this.fields).map(fieldName =>
            this.validateField(fieldName)
        );

        const results = await Promise.all(validationPromises);
        this.state.isSubmitting = false;

        return results.every(Boolean);
    }

    getFormData() {
        const formData = {};
        Object.entries(this.fields).forEach(([name, field]) => {
            formData[name] = field.getValue();
        });
        return formData;
    }

    saveInitialState() {
        Object.entries(this.fields).forEach(([name, field]) => {
            this.state.originalValues.set(name, field.getValue());
        });
    }

    hasUnsavedChanges() {
        return Object.entries(this.fields).some(([name, field]) => {
            const originalValue = this.state.originalValues.get(name);
            return field.getValue() !== originalValue;
        });
    }

    resetForm() {
        this.form.reset();
        Object.values(this.fields).forEach(field => field.clearError());
        this.state.hasChanges = false;
        this.saveInitialState();
    }

    showError(fieldName, message) {
        const field = this.fields[fieldName];
        if (field) {
            field.errorMessage = message;
            field.showError();
        }
    }

    clearAllErrors() {
        Object.values(this.fields).forEach(field => field.clearError());
    }

    destroy() {
        // 清理所有验证状态
        this.clearAllErrors();

        // 移除事件监听器
        Object.values(this.fields).forEach(field => {
            if (field.element) {
                field.element.removeEventListener('blur', this.validateField);
                field.element.removeEventListener('input', this.validateField);
            }
        });

        // 清理状态
        this.state.originalValues.clear();
        this.state = null;
        this.fields = null;
    }
}
// eventManager.js
export class EventManager {
    constructor() {
        // 存储所有事件监听器
        this.listeners = new Map();
        // 存储防抖定时器
        this.debounceTimers = new Map();
    }

    /**
     * 绑定事件监听器
     * @param {HTMLElement} element - DOM 元素
     * @param {string} eventType - 事件类型
     * @param {Function} handler - 事件处理函数
     * @param {Object} options - 配置选项
     * @param {number} options.debounce - 防抖延迟时间（毫秒）
     */
    on(element, eventType, handler, options = {}) {
        if (!element || !eventType || !handler) return;

        // 创建唯一的监听器标识
        const listenerId = this.generateListenerId(element, eventType, handler);

        // 如果需要防抖
        if (options.debounce) {
            const debouncedHandler = this.debounce(handler, options.debounce);
            this.listeners.set(listenerId, {
                element,
                eventType,
                originalHandler: handler,
                handler: debouncedHandler,
                options
            });
            element.addEventListener(eventType, debouncedHandler);
        } else {
            this.listeners.set(listenerId, {
                element,
                eventType,
                originalHandler: handler,
                handler,
                options
            });
            element.addEventListener(eventType, handler);
        }
    }

    /**
     * 移除事件监听器
     * @param {HTMLElement} element - DOM 元素
     * @param {string} eventType - 事件类型
     * @param {Function} handler - 事件处理函数
     */
    off(element, eventType, handler) {
        if (!element || !eventType || !handler) return;

        const listenerId = this.generateListenerId(element, eventType, handler);
        const listener = this.listeners.get(listenerId);

        if (listener) {
            element.removeEventListener(eventType, listener.handler);
            this.listeners.delete(listenerId);

            // 清除相关的防抖定时器
            const timerId = this.debounceTimers.get(listenerId);
            if (timerId) {
                clearTimeout(timerId);
                this.debounceTimers.delete(listenerId);
            }
        }
    }

    /**
     * 生成监听器唯一标识
     * @private
     */
    generateListenerId(element, eventType, handler) {
        return `${element.id || 'anonymous'}_${eventType}_${handler.name || 'anonymous'}`;
    }

    /**
     * 防抖函数
     * @private
     */
    debounce(func, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
            // 存储定时器ID
            const listenerId = this.generateListenerId(
                args[0]?.target,
                args[0]?.type,
                func
            );
            this.debounceTimers.set(listenerId, timer);
        };
    }

    /**
     * 移除所有事件监听器
     */
    removeAll() {
        this.listeners.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        this.listeners.clear();

        // 清除所有防抖定时器
        this.debounceTimers.forEach(timerId => clearTimeout(timerId));
        this.debounceTimers.clear();
    }

    /**
     * 销毁实例
     */
    destroy() {
        this.removeAll();
        this.listeners = null;
        this.debounceTimers = null;
    }
}
