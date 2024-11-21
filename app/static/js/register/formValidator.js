// formValidator.js
import { CONSTANTS, utils, HttpClient } from './config.js';

export class EventManager {
    constructor() {
        this.handlers = new Map();
    }

    on(element, event, handler, options = {}) {
        if (!element) return;

        const wrappedHandler = options.debounce
            ? utils.debounce(handler, options.debounce)
            : handler;

        element.addEventListener(event, wrappedHandler);

        if (!this.handlers.has(element)) {
            this.handlers.set(element, new Map());
        }

        this.handlers.get(element).set(event, {
            original: handler,
            wrapped: wrappedHandler
        });
    }

    off(element, event) {
        if (!element || !this.handlers.has(element)) return;

        const elementHandlers = this.handlers.get(element);

        if (event) {
            const handler = elementHandlers.get(event);
            if (handler) {
                element.removeEventListener(event, handler.wrapped);
                elementHandlers.delete(event);
            }
        } else {
            elementHandlers.forEach((handler, event) => {
                element.removeEventListener(event, handler.wrapped);
            });
            this.handlers.delete(element);
        }
    }

    destroy() {
        this.handlers.forEach((elementHandlers, element) => {
            this.off(element);
        });
        this.handlers.clear();
    }
}

export class FormValidator {
    constructor(formId) {
        this.form = utils.getElement(formId);
        this.httpClient = new HttpClient();
        this.eventManager = new EventManager();
        this.fields = this.initializeFields();

        if (this.form) {
            this.init();
        }
    }

    initializeFields() {
        return {
            username: {
                id: 'username',
                errorId: 'username-error',
                validate: this.validateUsername.bind(this)
            },
            email: {
                id: 'email',
                errorId: 'email-error',
                validate: this.validateEmail.bind(this)
            },
            verificationCode: {
                id: 'verification_code',
                errorId: 'code-error',
                validate: this.validateVerificationCode.bind(this)
            },
            password: {
                id: 'password',
                errorId: 'password-error',
                validate: this.validatePassword.bind(this)
            },
            password2: {
                id: 'password2',
                errorId: 'password2-error',
                validate: this.validatePasswordConfirm.bind(this)
            },
            gender: {
                errorId: 'gender-error',
                validate: this.validateGender.bind(this)
            }
        };
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 表单提交事件
        this.eventManager.on(this.form, 'submit', this.handleSubmit.bind(this));

        // 字段验证事件
        Object.keys(this.fields).forEach(fieldName => {
            const field = this.fields[fieldName];
            if (field.id) {
                const element = utils.getElement(field.id);
                if (element) {
                    this.eventManager.on(element, 'blur',
                        () => this.validateField(fieldName),
                        { debounce: CONSTANTS.UI.DEBOUNCE_DELAY }
                    );
                    this.eventManager.on(element, 'input',
                        () => this.clearError(field.errorId)
                    );
                }
            }
        });
    }

    // 字段验证方法
    validateUsername(value) {
        if (!value.trim()) return '请输入用户名';
        if (value.length < 3) return '用户名至少需要3个字符';
        if (value.length > CONSTANTS.SECURITY.MAX_USERNAME_LENGTH) {
            return `用户名不能超过${CONSTANTS.SECURITY.MAX_USERNAME_LENGTH}个字符`;
        }
        return true;
    }

    validateEmail(value) {
        if (!value.trim()) return '请输入邮箱地址';
        if (!CONSTANTS.SECURITY.EMAIL_REGEX.test(value)) {
            return '请输入有效的邮箱地址';
        }
        return true;
    }

    validateVerificationCode(value) {
        if (!value.trim()) return '请输入验证码';
        if (!/^\d{6}$/.test(value)) return '验证码应为6位数字';
        return true;
    }

    validatePassword(value) {
        if (!value) return '请输入密码';
        if (value.length < CONSTANTS.SECURITY.PASSWORD_MIN_LENGTH) {
            return `密码至少需要${CONSTANTS.SECURITY.PASSWORD_MIN_LENGTH}个字符`;
        }
        if (!/(?=.*[A-Za-z])(?=.*\d)/.test(value)) {
            return '密码必须包含字母和数字';
        }
        return true;
    }

    validatePasswordConfirm(value, formData) {
        if (!value) return '请再次输入密码';
        if (value !== formData.password) return '两次输入的密码不一致';
        return true;
    }

    validateGender(value) {
        return value ? true : '请选择性别';
    }

    // 表单验证方法
    validateField(fieldName) {
        const field = this.fields[fieldName];
        const element = field.id ? utils.getElement(field.id) : this.getGenderValue();
        if (!element && fieldName !== 'gender') return false;

        const value = fieldName === 'gender' ? element : element.value;
        const formData = this.getFormData();

        const validationResult = field.validate(value, formData);

        if (validationResult !== true) {
            this.showError(field.errorId, validationResult);
            return false;
        }

        this.clearError(field.errorId);
        return true;
    }

    validateForm() {
        let isValid = true;
        Object.keys(this.fields).forEach(fieldName => {
            if (!this.validateField(fieldName)) {
                isValid = false;
            }
        });
        return isValid;
    }

    // 表单数据处理
    getFormData() {
        const formData = {};
        Object.keys(this.fields).forEach(fieldName => {
            const field = this.fields[fieldName];
            if (fieldName === 'gender') {
                formData[fieldName] = this.getGenderValue();
            } else if (field.id) {
                const element = utils.getElement(field.id);
                if (element) {
                    formData[fieldName] = element.value;
                }
            }
        });
        return formData;
    }

    getGenderValue() {
        const maleRadio = document.querySelector('input[name="gender"][value="male"]');
        const femaleRadio = document.querySelector('input[name="gender"][value="female"]');
        return (maleRadio?.checked ? 'male' : '') || (femaleRadio?.checked ? 'female' : '');
    }

    // UI相关方法
    showError(errorId, message) {
        const errorElement = utils.getElement(errorId);
        if (errorElement) {
            errorElement.textContent = utils.escapeHtml(message);
            errorElement.style.display = 'block';
            errorElement.setAttribute('role', 'alert');
            errorElement.classList.add('error-shake');
            setTimeout(() => errorElement.classList.remove('error-shake'), 500);
        }
    }

    clearError(errorId) {
        const errorElement = utils.getElement(errorId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
            errorElement.removeAttribute('role');
        }
    }

    // 表单提交处理
    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        const formData = this.getFormData();

        try {
            const response = await this.httpClient.post(
                CONSTANTS.API.ENDPOINTS.REGISTER,
                formData
            );

            if (response.error) {
                this.showError(
                    this.fields[response.field]?.errorId || 'form-error',
                    response.error
                );
            } else {
                window.location.href = '/registration-success';
            }
        } catch (error) {
            this.showError('form-error', '注册失败，请稍后重试');
        }
    }

    // 资源清理
    destroy() {
        this.eventManager.destroy();
    }
}

export default FormValidator;