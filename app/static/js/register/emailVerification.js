// emailVerification.js
import { CONSTANTS, utils, HttpClient } from './config.js';
import { EventManager } from './formValidator.js';

export class EmailVerification {
    constructor() {
        this.httpClient = new HttpClient();
        this.eventManager = new EventManager();
        this.cooldownTimer = null;
        this.init();
    }

    init() {
        const sendCodeBtn = utils.getElement('send-code');
        if (sendCodeBtn) {
            this.eventManager.on(
                sendCodeBtn,
                'click',
                this.handleSendCode.bind(this),
                { debounce: CONSTANTS.UI.DEBOUNCE_DELAY }
            );
        }
    }

    async handleSendCode() {
        const emailInput = utils.getElement('email');
        const sendCodeBtn = utils.getElement('send-code');
        const errorDiv = utils.getElement('email-error');

        if (!emailInput || !sendCodeBtn || !errorDiv) return;

        const email = emailInput.value.trim();

        if (!this.validateEmail(email, errorDiv)) {
            return;
        }

        try {
            sendCodeBtn.disabled = true;
            errorDiv.textContent = '';

          const response = await this.httpClient.post('/send_verification_code', {
            email,
            purpose: 'registration'
          });

            if (response.error) {
                this.handleError(response, sendCodeBtn, errorDiv);
            } else {
                this.showMessage(errorDiv, '验证码已发送，请查收邮件');
                this.startCooldown(CONSTANTS.UI.COOLDOWN_TIME);
            }
        } catch (error) {
            console.error('Error:', error);
            this.showError(errorDiv, '发送验证码失败，请稍后重试');
            sendCodeBtn.disabled = false;
        }
    }

    validateEmail(email, errorDiv) {
        if (!email) {
            this.showError(errorDiv, '请输入邮箱地址');
            return false;
        }
        if (!CONSTANTS.SECURITY.EMAIL_REGEX.test(email)) {
            this.showError(errorDiv, '请输入有效的邮箱地址');
            return false;
        }
        return true;
    }

    handleError(response, sendCodeBtn, errorDiv) {
        this.showError(errorDiv, response.error);
        if (response.error.includes('Please wait')) {
            const waitTime = parseInt(response.error.match(/\d+/)[0]);
            this.startCooldown(waitTime);
        } else {
            sendCodeBtn.disabled = false;
        }
    }

    startCooldown(seconds) {
        const sendCodeBtn = utils.getElement('send-code');
        if (!sendCodeBtn) return;

        sendCodeBtn.disabled = true;

        const updateButtonText = () => {
            sendCodeBtn.textContent = `重新发送 (${seconds}s)`;
            if (--seconds < 0) {
                clearInterval(this.cooldownTimer);
                sendCodeBtn.textContent = '发送验证码';
                sendCodeBtn.disabled = false;
            }
        };

        clearInterval(this.cooldownTimer);
        this.cooldownTimer = setInterval(updateButtonText, 1000);
        updateButtonText();
    }

    showMessage(element, message, isError = false) {
        if (element) {
            element.textContent = utils.escapeHtml(message);
            element.style.display = 'block';
            element.style.color = isError ? 'var(--color-error)' : 'var(--color-success)';
            element.setAttribute('role', isError ? 'alert' : 'status');
        }
    }

    showError(element, message) {
        this.showMessage(element, message, true);
    }

    destroy() {
        clearInterval(this.cooldownTimer);
        this.eventManager.destroy();
    }
}

export default EmailVerification;