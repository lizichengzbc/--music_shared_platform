document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素引用
    const profileForm = document.getElementById('profile-form');
    const avatarUpload = document.getElementById('avatar-upload');
    const cropperModal = document.getElementById('cropperModal');
    const cropperImage = document.getElementById('cropperImage');
    const uploadProgress = document.querySelector('.upload-progress');
    const progressBar = document.querySelector('.progress-bar');
    const notification = document.getElementById('notification');
    const editButtons = document.querySelectorAll('.edit-btn');
    const formFields = document.querySelectorAll('.field-feedback');
    const formInputs = document.querySelectorAll('.form-input, .form-select');

    // 密码相关元素
    const passwordToggle = document.querySelector('.password-toggle');
    const passwordFields = document.querySelector('.password-fields');
    const passwordToggles = document.querySelectorAll('.toggle-password');
    const newPasswordInput = document.querySelector('[name="new_password"]');
    const currentPasswordInput = document.querySelector('[name="current_password"]');
    const confirmPasswordInput = document.querySelector('[name="confirm_password"]');
    const passwordStrength = document.querySelector('.password-strength');
    const passwordFeedback = document.querySelector('.password-feedback');

    // Cropper 实例
    let cropper = null;

    // 通知函数
    function showNotification(message, type = 'info') {
        const messageElement = notification.querySelector('.notification-message');
        const icon = notification.querySelector('.notification-icon');

        messageElement.textContent = message;
        notification.className = `notification ${type}`;
        icon.className = `notification-icon fas ${
            type === 'success' ? 'fa-check-circle' :
            type === 'error' ? 'fa-times-circle' :
            'fa-info-circle'
        }`;

        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 3000);
    }

    // 密码强度检查
    function checkPasswordStrength(password) {
        let strength = 0;
        const feedback = [];

        if (password.length >= 8) strength++;
        else feedback.push('密码至少需要8个字符');

        return { strength, feedback };
    }

    // 初始化头像裁剪器
    function initCropper() {
        if (cropper) cropper.destroy();

        cropper = new Cropper(cropperImage, {
            aspectRatio: 1,
            viewMode: 1,
            preview: '.preview-container',
            dragMode: 'move',
            autoCropArea: 1,
            responsive: true
        });
    }

    // 密码匹配验证
    function validatePasswordMatch() {
        const confirmFeedback = document.querySelector('.confirm-password-feedback');
        if (newPasswordInput.value !== confirmPasswordInput.value) {
            confirmFeedback.textContent = '两次输入的密码不一致';
            return false;
        }
        confirmFeedback.textContent = '';
        return true;
    }

    // 表单提交处理
    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(profileForm);

        // 显示处理中提示
        showNotification('正在提交...', 'info');

        try {
            const response = await fetch('/update_profile', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': document.querySelector('[name="csrf_token"]').value
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showNotification(result.message, 'success');
                if (formData.get('new_password')) {
                    passwordFields.classList.add('hidden');
                    newPasswordInput.value = '';
                    currentPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                }
            } else {
                // 显示详细错误信息
                const errorMessages = {
                    'current_password': '当前密码',
                    'new_password': '新密码',
                    'confirm_password': '确认密码',
                    'username': '用户名',
                    'gender': '性别'
                };

                let errorMsg = result.message;
                if (result.errors) {
                    errorMsg = Object.entries(result.errors)
                        .map(([field, msg]) => `${errorMessages[field]}: ${msg}`)
                        .join('\n');
                }
                showNotification(errorMsg, 'error');
                throw new Error(errorMsg);
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    // 头像上传处理
    async function handleAvatarUpload(blob) {
        const formData = new FormData();
        formData.append('avatar', blob, 'avatar.png');

        try {
            uploadProgress.style.display = 'block';

            const response = await fetch('/upload_avatar', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': document.querySelector('[name="csrf_token"]').value
                }
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.message || '上传失败');

            document.querySelector('.avatar-img').src = result.avatar_url;
            showNotification('头像上传成功', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            uploadProgress.style.display = 'none';
            cropperModal.classList.add('hidden');
            avatarUpload.value = '';
        }
    }

    // 初始化表单
    formInputs.forEach(input => {
        if(input.name === 'email') {
            input.setAttribute('readonly', true);
            if (input.tagName === 'SELECT') {
                input.setAttribute('disabled', true);
            }
        }
    });

    // 编辑按钮点击处理
    editButtons.forEach(btn => {
        const field = btn.dataset.field;
        if(field === 'email') {
            btn.style.display = 'none';
            return;
        }

        btn.addEventListener('click', () => {
            const input = document.querySelector(`[name="${field}"]`);
            if(input.hasAttribute('readonly')) {
                input.removeAttribute('readonly');
                if(input.tagName === 'SELECT') {
                    input.removeAttribute('disabled');
                }
                input.focus();
                btn.innerHTML = '<i class="fas fa-check"></i>';
            } else {
                input.setAttribute('readonly', true);
                if(input.tagName === 'SELECT') {
                    input.setAttribute('disabled', true);
                }
                btn.innerHTML = '<i class="fas fa-edit"></i>';
            }
        });
    });

    // 密码可见性切换
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.dataset.target;
            const input = document.querySelector(`[name="${targetId}"]`);
            const icon = toggle.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // 密码部分显示切换
    passwordToggle?.addEventListener('click', () => {
        passwordFields.classList.toggle('hidden');
        passwordToggle.querySelector('.fa-chevron-down')
            .classList.toggle('fa-chevron-up');
    });

    // 新密码输入监听
    newPasswordInput?.addEventListener('input', () => {
        const { strength, feedback } = checkPasswordStrength(newPasswordInput.value);

        passwordStrength.classList.remove('hidden');
        passwordStrength.className = `password-strength strength-${strength}`;
        passwordFeedback.innerHTML = feedback.join('<br>');

        if (confirmPasswordInput.value) {
            validatePasswordMatch();
        }
    });

    // 确认密码输入监听
    confirmPasswordInput?.addEventListener('input', validatePasswordMatch);

    // 头像上传监听
    avatarUpload?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showNotification('请选择有效的图片文件', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = e => {
            cropperImage.src = e.target.result;
            cropperModal.classList.remove('hidden');
            initCropper();
        };
        reader.readAsDataURL(file);
    });

    // 裁剪器控制按钮
    document.getElementById('rotateLeft')?.addEventListener('click', () => cropper.rotate(-90));
    document.getElementById('rotateRight')?.addEventListener('click', () => cropper.rotate(90));
    document.getElementById('zoomIn')?.addEventListener('click', () => cropper.zoom(0.1));
    document.getElementById('zoomOut')?.addEventListener('click', () => cropper.zoom(-0.1));
    document.getElementById('reset')?.addEventListener('click', () => cropper.reset());

    // 裁剪比例按钮
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const ratio = parseFloat(btn.dataset.ratio) || NaN;
            cropper.setAspectRatio(ratio);
        });
    });

    // 裁剪取消按钮
    document.getElementById('cancelCrop')?.addEventListener('click', () => {
        cropperModal.classList.add('hidden');
        avatarUpload.value = '';
    });

    // 裁剪确认按钮
    document.getElementById('confirmCrop')?.addEventListener('click', () => {
        const canvas = cropper.getCroppedCanvas({
            width: 300,
            height: 300
        });

        canvas.toBlob(handleAvatarUpload);
    });

    // 表单提交事件
    profileForm?.addEventListener('submit', handleFormSubmit);

    // 通知关闭按钮
    document.querySelector('.notification-close')?.addEventListener('click', () => {
        notification.classList.add('hidden');
    });
});