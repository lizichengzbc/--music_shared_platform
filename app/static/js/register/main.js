// 表单验证处理
import { FormValidator } from './formValidator.js';
import { AvatarCropper } from './avatarCropper.js';
import { EmailVerification } from './emailVerification.js';

class RegisterForm {
   constructor() {
       this.formValidator = null;
       this.avatarCropper = null;
       this.emailVerification = null;
       this.init();
   }

   init() {
       try {
           // 初始化各个组件
           this.formValidator = new FormValidator('register-form');
           this.avatarCropper = new AvatarCropper();
           this.emailVerification = new EmailVerification();
           this.handleFormSubmission();
       } catch (error) {
           console.error('初始化错误:', error);
           this.showError('初始化失败，请刷新重试');
       }
   }

   handleFormSubmission() {
       const form = document.getElementById('register-form');
       const submitBtn = form.querySelector('.btn.btn--lg.btn--primary.btn--full');
       if (!form || !submitBtn) return;

       form.addEventListener('submit', async (e) => {
           e.preventDefault();

           try {
               submitBtn.disabled = true;
               submitBtn.textContent = '注册中...';

               // 验证头像
               const croppedBlob = this.avatarCropper.getCroppedBlob();
               if (!croppedBlob) {
                   this.formValidator.showError('avatar-error', '请上传头像');
                   return;
               }

               // 验证表单
               if (!this.formValidator.validateForm()) {
                   return;
               }

               // 提交表单
               const formData = new FormData(form);
               formData.set('avatar', croppedBlob, 'avatar.png');

               const response = await fetch(form.action, {
                   method: 'POST',
                   body: formData
               });

               if (response.ok) {
                   submitBtn.textContent = '注册成功';
                   this.showSuccessMessage('注册成功，3秒后跳转到登录页面...');
                   setTimeout(() => {
                       window.location.href = form.dataset.loginUrl;
                   }, 3000);
               } else {
                   const result = await response.json();
                   throw new Error(result.error || '注册失败');
               }

           } catch (error) {
               console.error('注册错误:', error);
               this.formValidator.showError('form-error', error.message);
               submitBtn.textContent = '完成注册';
           } finally {
               submitBtn.disabled = false;
           }
       });
   }

   showSuccessMessage(message) {
       const messageEl = document.createElement('div');
       messageEl.className = 'global-success';
       messageEl.textContent = message;
       messageEl.setAttribute('role', 'status');
       document.body.appendChild(messageEl);
   }

   showError(message) {
       if (!message) return;

       const errorEl = document.createElement('div');
       errorEl.className = 'global-error';
       errorEl.textContent = message;
       errorEl.setAttribute('role', 'alert');
       document.body.appendChild(errorEl);

       setTimeout(() => errorEl.remove(), 5000);
   }

   destroy() {
       this.formValidator?.destroy();
       this.avatarCropper?.destroy();
       this.emailVerification?.destroy();
   }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
   window.registerForm = new RegisterForm();
});

window.addEventListener('unload', () => {
   window.registerForm?.destroy();
});

export default RegisterForm;