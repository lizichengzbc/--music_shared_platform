// main.js
import { FormValidator } from './formValidator.js';
import { AvatarCropper } from './avatarCropper.js';
import { EmailVerification } from './emailVerification.js';
import { CONSTANTS, utils, HttpClient } from './config.js';

class RegisterForm {
    constructor() {
        this.components = {
            formValidator: null,
            avatarCropper: null,
            emailVerification: null
        };

        this.elements = {
            form: utils.getElement('register-form'),
            submitBtn: utils.getElement('register-form')?.querySelector('button[type="submit"]'),
            loginUrl: utils.getElement('register-form')?.dataset.loginUrl
        };

        this.httpClient = new HttpClient();
        this.init();
        this.setupBeforeUnload();
    }

    async init() {
        try {
            console.log('Initializing registration form...');
            await this.initializeComponents();
            this.handleFormSubmission();
            console.log('Registration form initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showGlobalError('初始化失败，请刷新页面重试');
        }
    }

    async initializeComponents() {
        if (!this.elements.form || !this.elements.submitBtn) {
            throw new Error('Required elements not found');
        }

        // 初始化表单验证器
        this.components.formValidator = new FormValidator('register-form', {
            validateOnBlur: true,
            validateOnInput: true,
            debounceDelay: CONSTANTS.UI.DEBOUNCE_DELAY
        });

        // 初始化头像裁剪器
        this.components.avatarCropper = new AvatarCropper();

        // 初始化邮箱验证
        this.components.emailVerification = new EmailVerification();
    }

    handleFormSubmission() {
        this.elements.form.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                // 开始提交
                await this.startSubmission();

                // 表单验证
                if (!await this.validateForm()) {
                    return;
                }

                // 收集数据并提交
                const formData = await this.collectFormData();
                const response = await this.submitForm(formData);

                // 处理响应
                await this.handleSubmissionResponse(response);

            } catch (error) {
                this.handleSubmissionError(error);
            } finally {
                this.endSubmission();
            }
        });
    }

    async startSubmission() {
        this.elements.submitBtn.disabled = true;
        this.elements.submitBtn.textContent = '注册中...';
        this.clearGlobalMessages();
    }

    async validateForm() {
        // 验证所有表单字段
        const isValid = await this.components.formValidator.validateForm();
        if (!isValid) {
            return false;
        }

        // 验证头像
        const avatarBlob = this.components.avatarCropper.getCroppedBlob();
        if (!avatarBlob) {
            utils.showError('avatar-error', '请上传并裁剪头像');
            return false;
        }

        return true;
    }

    async collectFormData() {
        const formData = new FormData(this.elements.form);

        // 添加 CSRF token
        const csrftoken = document.querySelector('meta[name="csrf-token"]').content;
        formData.append('csrf_token', csrftoken);

        // 添加裁剪后的头像
        const avatarBlob = this.components.avatarCropper.getCroppedBlob();
        if (avatarBlob) {
            formData.set('avatar', avatarBlob, 'avatar.png');
        }

        return formData;
    }

    async submitForm(formData) {
        const response = await fetch(this.elements.form.action, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async handleSubmissionResponse(response) {
        if (!response.success) {
            // 处理字段错误
            if (response.errors) {
                Object.entries(response.errors).forEach(([field, message]) => {
                    if (field === 'avatar') {
                        utils.showError('avatar-error', message);
                    } else {
                        this.components.formValidator.showError(field, message);
                    }
                });
            }
            throw new Error(response.message || '注册失败');
        }

        // 注册成功
        this.showSuccessMessage(response.message || '注册成功！');

        // 清理状态
        this.components.formValidator.resetForm();

        // 延时重定向
        if (response.redirect_url) {
            setTimeout(() => {
                window.location.href = response.redirect_url;
            }, 2000);
        }
    }

    handleSubmissionError(error) {
        console.error('Registration error:', error);
        this.showGlobalError(error.message || '注册失败，请重试');
    }

    endSubmission() {
        this.elements.submitBtn.disabled = false;
        this.elements.submitBtn.textContent = '完成注册';
    }

    setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.components.formValidator?.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    showSuccessMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message message-success';
        messageElement.textContent = message;
        messageElement.setAttribute('role', 'status');
        document.body.appendChild(messageElement);

        setTimeout(() => messageElement.remove(), 3000);
    }

    showGlobalError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'message message-error';
        errorElement.textContent = message;
        errorElement.setAttribute('role', 'alert');
        document.body.appendChild(errorElement);

        setTimeout(() => errorElement.remove(), 5000);
    }

    clearGlobalMessages() {
        document.querySelectorAll('.message').forEach(el => el.remove());
    }

    destroy() {
        console.log('Cleaning up registration form...');

        // 清理所有组件
        Object.values(this.components).forEach(component => {
            if (component?.destroy) {
                component.destroy();
            }
        });

        // 移除事件监听器
        window.removeEventListener('beforeunload', this.handleBeforeUnload);

        // 清理消息
        this.clearGlobalMessages();
    }
}

// 确保 DOM 加载完成后再初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.registerForm = new RegisterForm();
    });
} else {
    window.registerForm = new RegisterForm();
}

// 页面卸载时清理资源
window.addEventListener('unload', () => {
    window.registerForm?.destroy();
});