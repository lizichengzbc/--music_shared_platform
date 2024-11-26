// 防止表单重复提交
let isSubmitting = false;

// 邮箱验证正则
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CSRF Token获取函数
function getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
}

document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const loginForm = document.getElementById('loginForm');
    const verificationForm = document.getElementById('verificationForm');
    const toggleVerification = document.getElementById('toggleVerification');
    const sendCodeBtn = document.getElementById('sendCode');
    const messageDiv = document.getElementById('message');

    // 倒计时状态
    let countdown = 0;
    let countdownInterval;

    // 显示字段错误函数
    function showFieldError(inputId, errorMessage) {
        const input = document.getElementById(inputId);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = errorMessage;

        // 移除已存在的错误提示
        const existingError = input.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        // 添加错误样式和提示
        input.classList.add('error');
        input.parentNode.appendChild(errorDiv);

        // 当输入框获得焦点时移除错误提示
        input.addEventListener('focus', function() {
            this.classList.remove('error');
            const error = this.parentNode.querySelector('.field-error');
            if (error) {
                error.remove();
            }
        }, { once: true });
    }

    // 显示全局消息函数
    function showMessage(message, isError = false, autoHide = true) {
        messageDiv.textContent = message;
        messageDiv.style.display = 'block';
        messageDiv.className = `message ${isError ? 'error' : 'success'}`;

        // 可选择是否自动隐藏
        if (autoHide) {
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        }
    }

    // 清除所有错误提示
    function clearAllErrors() {
        // 清除所有字段错误
        document.querySelectorAll('.field-error').forEach(error => error.remove());
        document.querySelectorAll('input').forEach(input => input.classList.remove('error'));
        // 清除全局消息
        messageDiv.style.display = 'none';
    }

    // 设置按钮加载状态
    function setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    // 输入验证函数
    function validateForm(formData) {
        let hasError = false;
        clearAllErrors();

        // 验证邮箱
        const email = formData.get('email') || formData.get('verificationEmail');
        if (!email) {
            showFieldError(formData.has('email') ? 'email' : 'verificationEmail', '请输入邮箱地址');
            hasError = true;
        } else if (!emailRegex.test(email)) {
            showFieldError(formData.has('email') ? 'email' : 'verificationEmail', '请输入有效的邮箱地址');
            hasError = true;
        }

        // 验证密码（仅密码登录）
        if (formData.has('password')) {
            const password = formData.get('password');
            if (!password) {
                showFieldError('password', '请输入密码');
                hasError = true;
            } else if (password.length < 6) {
                showFieldError('password', '密码长度不能小于6位');
                hasError = true;
            }
        }

        // 验证验证码（仅验证码登录）
        if (formData.has('verificationCode')) {
            const code = formData.get('verificationCode');
            if (!code) {
                showFieldError('verificationCode', '请输入验证码');
                hasError = true;
            } else if (!/^\d{6}$/.test(code)) {
                showFieldError('verificationCode', '验证码必须是6位数字');
                hasError = true;
            }
        }

        return !hasError;
    }

    // 切换登录方式
    toggleVerification.addEventListener('click', function(e) {
        e.preventDefault();
        const isVerificationVisible = verificationForm.style.display === 'block';
        loginForm.style.display = isVerificationVisible ? 'block' : 'none';
        verificationForm.style.display = isVerificationVisible ? 'none' : 'block';
        toggleVerification.textContent = isVerificationVisible ? '使用验证码登录' : '使用密码登录';
        clearAllErrors();
    });

    // 发送验证码
    sendCodeBtn.addEventListener('click', async function() {
        const email = document.getElementById('verificationEmail').value.trim();

        // 验证邮箱
        if (!email) {
            showFieldError('verificationEmail', '请输入邮箱地址');
            return;
        }
        if (!emailRegex.test(email)) {
            showFieldError('verificationEmail', '请输入有效的邮箱地址');
            return;
        }

        if (countdown > 0) {
            return;
        }

        try {
            setButtonLoading(sendCodeBtn, true);
            const response = await fetch('/send_verification_code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({
                    email: email,
                    purpose: 'login'
                })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('验证码已发送，请查收邮件');
                // 开始倒计时
                countdown = 120;
                sendCodeBtn.disabled = true;

                countdownInterval = setInterval(() => {
                    countdown--;
                    sendCodeBtn.textContent = `重新发送(${countdown}s)`;

                    if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        sendCodeBtn.disabled = false;
                        sendCodeBtn.textContent = '发送验证码';
                    }
                }, 1000);
            } else {
                showMessage(data.message || '发送验证码失败', true);
                if (data.cooldown) {
                    countdown = data.cooldown;
                    // 启动倒计时
                    sendCodeBtn.disabled = true;
                    countdownInterval = setInterval(() => {
                        countdown--;
                        sendCodeBtn.textContent = `重新发送(${countdown}s)`;
                        if (countdown <= 0) {
                            clearInterval(countdownInterval);
                            sendCodeBtn.disabled = false;
                            sendCodeBtn.textContent = '发送验证码';
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('发送验证码错误:', error);
            showMessage('发送验证码失败，请稍后重试', true);
        } finally {
            setButtonLoading(sendCodeBtn, false);
        }
    });

    // 密码登录提交
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (isSubmitting) return;

        const formData = new FormData(loginForm);
        const submitButton = loginForm.querySelector('button[type="submit"]');

        // 验证表单
        if (!validateForm(formData)) {
            return;
        }

        // 构建请求数据
        const requestData = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            isSubmitting = true;
            setButtonLoading(submitButton, true);

            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (data.success) {
                showMessage('登录成功');
                // 跳转到首页或指定页面
                setTimeout(() => {
                    window.location.href = data.redirect_url;
                }, 1000);
            } else {
                showMessage(data.message, true);
            }
        } catch (error) {
            console.error('登录错误:', error);
            showMessage('登录失败，请稍后重试', true);
        } finally {
            isSubmitting = false;
            setButtonLoading(submitButton, false);
        }
    });

    // 验证码登录提交
    verificationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (isSubmitting) return;

        const formData = new FormData(verificationForm);
        const submitButton = verificationForm.querySelector('button[type="submit"]');

        // 验证表单
        if (!validateForm(formData)) {
            return;
        }

        // 构建请求数据
        const requestData = {
            email: formData.get('verificationEmail'),
            code: formData.get('verificationCode')
        };

        try {
            isSubmitting = true;
            setButtonLoading(submitButton, true);

            const response = await fetch('/verification_login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (data.success) {
                showMessage('登录成功');
                // 跳转到首页或指定页面
                setTimeout(() => {
                    window.location.href = data.redirect_url;
                }, 1000);
            } else {
                showMessage(data.message, true);
            }
        } catch (error) {
            console.error('验证码登录错误:', error);
            showMessage('登录失败，请稍后重试', true);
        } finally {
            isSubmitting = false;
            setButtonLoading(submitButton, false);
        }
    });
});