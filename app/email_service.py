from flask import current_app, render_template
from flask_mail import Message
from threading import Thread
from app import mail
import time

class EmailService:
    def __init__(self, app=None):
        self.app = app or current_app._get_current_object()  # 获取实际的 app 对象
        self.mail = mail

    def send_async_email(self, app, msg):
        """异步发送邮件"""
        with app.app_context():
            try:
                self.mail.send(msg)
            except Exception as e:
                current_app.logger.error(f"发送邮件失败: {str(e)}")
                raise

    def send_email(self, subject, recipients, text_body, html_body=None, sender=None):
        """发送邮件的通用方法"""
        try:
            msg = Message(
                subject=subject,
                recipients=[recipients] if isinstance(recipients, str) else recipients,
                sender=sender or self.app.config['MAIL_DEFAULT_SENDER']
            )
            msg.body = text_body
            if html_body:
                msg.html = html_body

            Thread(
                target=self.send_async_email,
                args=(self.app, msg)  # 使用实例变量中存储的 app 对象
            ).start()

            return True
        except Exception as e:
            current_app.logger.error(f"准备邮件失败: {str(e)}")
            return False

    def send_verification_code(self, email, code, purpose='registration'):
        """发送验证码邮件"""
        try:
            action_text = {
                'registration': '注册',
                'login': '登录',
                'reset_password': '重置密码'
            }.get(purpose, '验证')

            subject = f'JJ20音乐分享 - {action_text}验证码'

            # 文本版本
            text_body = f'''您好！

您正在进行{action_text}操作，验证码为：{code}

该验证码将在10分钟后过期，请及时使用。

如果这不是您本人的操作，请忽略此邮件。

祝您使用愉快！
JJ20音乐分享团队
'''
            html_body = f'''
            <html>
            <body>
                <h2>您好！</h2>
                <p>您正在进行{action_text}操作，验证码为：<strong>{code}</strong></p>
                <p>该验证码将在10分钟后过期，请及时使用。</p>
                <p>如果这不是您本人的操作，请忽略此邮件。</p>
                <br>
                <p>祝您使用愉快！</p>
                <p>JJ20音乐分享团队</p>
            </body>
            </html>
            '''

            return self.send_email(
                subject=subject,
                recipients=email,
                text_body=text_body,
                html_body=html_body,
            )

        except Exception as e:
            current_app.logger.error(f"发送验证码邮件失败: {str(e)}")
            return False