let cropper;
let cooldownTimer;
let croppedImageBlob;

document.getElementById('choose-avatar').addEventListener('click', function() {
    document.getElementById('avatar-input').click();
});

document.getElementById('edit-avatar').addEventListener('click', function() {
    if (croppedImageBlob) {
        const imageUrl = URL.createObjectURL(croppedImageBlob);
        document.getElementById('cropper-image').src = imageUrl;
        document.getElementById('cropper-container').style.display = 'block';
        initCropper();
    } else {
        alert('请先选择一个头像图片');
    }
});

document.getElementById('avatar-input').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('cropper-image').src = e.target.result;
            document.getElementById('cropper-container').style.display = 'block';
            initCropper();
        }
        reader.readAsDataURL(file);
    }
});

function initCropper() {
    if (cropper) {
        cropper.destroy();
    }
    cropper = new Cropper(document.getElementById('cropper-image'), {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.8,
        restore: false,
        modal: false,
        guides: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        crop: function(event) {
            updateAvatarPreview();
        }
    });
}

function updateAvatarPreview() {
    if (cropper) {
        cropper.getCroppedCanvas({
            width: 200,
            height: 200,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        }).toBlob((blob) => {
            croppedImageBlob = blob;
            const imageUrl = URL.createObjectURL(blob);
            document.getElementById('avatar-preview').src = imageUrl;
        }, 'image/png', 1);
    }
}

document.getElementById('rotate-left').addEventListener('click', function() {
    cropper.rotate(-90);
});

document.getElementById('rotate-right').addEventListener('click', function() {
    cropper.rotate(90);
});

document.getElementById('zoom-in').addEventListener('click', function() {
    cropper.zoom(0.1);
});

document.getElementById('zoom-out').addEventListener('click', function() {
    cropper.zoom(-0.1);
});

document.getElementById('cancel-crop').addEventListener('click', function() {
    document.getElementById('cropper-container').style.display = 'none';
    if (cropper) {
        cropper.destroy();
    }
});

document.getElementById('confirm-crop').addEventListener('click', function() {
    if (cropper) {
        updateAvatarPreview();
        document.getElementById('cropper-container').style.display = 'none';
        cropper.destroy();
    }
});

document.getElementById('send-code').addEventListener('click', function() {
    var email = document.getElementById('email').value;
    var sendCodeBtn = this;
    var errorDiv = document.getElementById('email-error');

    if (!email) {
        errorDiv.textContent = '请输入邮箱地址';
        return;
    }

    if (!isValidEmail(email)) {
        errorDiv.textContent = '请输入有效的邮箱地址';
        return;
    }

    sendCodeBtn.disabled = true;
    errorDiv.textContent = '';

    fetch('/send_verification_code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({email: email}),
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            errorDiv.textContent = data.error;
            if (data.error.includes('Please wait')) {
                startCooldown(parseInt(data.error.match(/\d+/)[0]));
            } else {
                sendCodeBtn.disabled = false;
            }
        } else {
            errorDiv.textContent = '验证码已发送，请查收邮件';
            startCooldown(120);
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        errorDiv.textContent = '发送验证码失败，请稍后重试';
        sendCodeBtn.disabled = false;
    });
});

function startCooldown(seconds) {
    var sendCodeBtn = document.getElementById('send-code');
    sendCodeBtn.disabled = true;

    function updateButtonText() {
        sendCodeBtn.textContent = `重新发送 (${seconds}s)`;
        seconds--;

        if (seconds < 0) {
            clearInterval(cooldownTimer);
            sendCodeBtn.textContent = '发送验证码';
            sendCodeBtn.disabled = false;
        }
    }

    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(updateButtonText, 1000);
    updateButtonText();
}

function isValidEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function validateForm() {
    let isValid = true;
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const verificationCode = document.getElementById('verification_code').value;
    const password = document.getElementById('password').value;
    const password2 = document.getElementById('password2').value;
    const gender = document.querySelector('input[name="gender"]:checked');

    // 用户名验证
    if (!username) {
        document.getElementById('username-error').textContent = '请输入用户名';
        isValid = false;
    } else {
        document.getElementById('username-error').textContent = '';
    }

    // 邮箱验证
    if (!email) {
        document.getElementById('email-error').textContent = '请输入邮箱地址';
        isValid = false;
    } else if (!isValidEmail(email)) {
        document.getElementById('email-error').textContent = '请输入有效的邮箱地址';
        isValid = false;
    } else {
        document.getElementById('email-error').textContent = '';
    }

    // 验证码验证
    if (!verificationCode) {
        document.getElementById('code-error').textContent = '请输入验证码';
        isValid = false;
    } else {
        document.getElementById('code-error').textContent = '';
    }

    // 密码验证
    if (!password) {
        document.getElementById('password-error').textContent = '请输入密码';
        isValid = false;
    } else {
        document.getElementById('password-error').textContent = '';
    }

    if (!password2) {
        document.getElementById('password2-error').textContent = '请再次输入密码';
        isValid = false;
    } else if (password !== password2) {
        document.getElementById('password2-error').textContent = '两次输入的密码不一致';
        isValid = false;
    } else {
        document.getElementById('password2-error').textContent = '';
    }

    // 性别验证
    if (!gender) {
        document.getElementById('gender-error').textContent = '请选择性别';
        isValid = false;
    } else {
        document.getElementById('gender-error').textContent = '';
    }

    return isValid;
}

document.getElementById('register-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (validateForm()) {
        const formData = new FormData(this);
        const loginUrl = this.dataset.loginUrl; // 从表单的 data 属性获取登录 URL

        // Remove the original avatar input from the form data
        formData.delete('avatar');

        // Add the cropped image blob to the form data if it exists
        if (croppedImageBlob) {
            formData.append('avatar', croppedImageBlob, 'default-album.png');
        }

        fetch(this.action, {
            method: 'POST',
            body: formData
        }).then(response => {
            if (response.ok) {
                window.location.href = loginUrl; // 使用从 HTML 获取的 URL
            } else {
                return response.json();
            }
        }).then(data => {
            if (data && data.error) {
                alert(data.error);
            }
        }).catch(error => {
            console.error('Error:', error);
            alert('注册过程中发生错误，请稍后重试');
        });
    }
});