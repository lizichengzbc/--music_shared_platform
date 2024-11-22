from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, FileField, BooleanField, SelectField
from wtforms.fields.choices import RadioField
from wtforms.fields.simple import EmailField, HiddenField
from wtforms.validators import DataRequired, Email, EqualTo, ValidationError, Length, Optional, Regexp
from flask_wtf.file import FileAllowed
from wtforms.widgets.core import PasswordInput

from app.models import User


class RegistrationForm(FlaskForm):
    username = StringField('用户名', validators=[
        DataRequired(message='请输入用户名'),
        Length(min=3, max=20, message='用户名长度必须在3-20个字符之间'),
        Regexp(r'^[a-zA-Z0-9_\u4e00-\u9fa5]+$', message='用户名只能包含字母、数字、下划线和汉字')
    ])

    email = StringField('邮箱', validators=[
        DataRequired(message='请输入邮箱'),
        Email(message='请输入有效的邮箱地址')
    ])

    verification_code = StringField('验证码', validators=[
        DataRequired(message='请输入验证码'),
        Length(min=6, max=6, message='验证码必须是6位数字'),
        Regexp(r'^\d{6}$', message='验证码必须是6位数字')
    ])

    password = PasswordField('密码', validators=[
        DataRequired(message='请输入密码'),
        Length(min=8, message='密码至少需要8个字符'),
        Regexp(r'(?=.*[A-Za-z])(?=.*\d)', message='密码必须包含字母和数字')
    ])

    password2 = PasswordField('确认密码', validators=[
        DataRequired(message='请确认密码'),
        EqualTo('password', message='两次输入的密码不一致')
    ])

    gender = RadioField('性别',
                        choices=[('male', '男'), ('female', '女'), ('other', '其他')],
                        validators=[DataRequired(message='请选择性别')]
                        )

    avatar = FileField('头像',
                       validators=[
                           FileAllowed(['jpg', 'jpeg', 'png', 'gif'], '只允许上传图片文件')
                       ]
                       )
    csrf_token = HiddenField()

class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')

class RequestResetForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])

class ResetPasswordForm(FlaskForm):
    code = StringField('Verification Code', validators=[DataRequired(), Length(min=6, max=6)])
    password = PasswordField('New Password', validators=[DataRequired(), Length(min=8)])
    password2 = PasswordField('Repeat Password', validators=[DataRequired(), EqualTo('password')])


class ProfileForm(FlaskForm):
    username = StringField('用户名', validators=[DataRequired(), Length(min=2, max=20)])
    email = EmailField('邮箱', validators=[DataRequired(), Email()])
    gender = SelectField('性别', choices=[('male', '男'), ('female', '女'), ('other', '其他')])

    current_password = PasswordField('当前密码', widget=PasswordInput())
    new_password = PasswordField('新密码', widget=PasswordInput(),
                                 validators=[Length(min=8, message='密码长度至少为8个字符')])
    confirm_password = PasswordField('确认新密码', widget=PasswordInput(),
                                     validators=[EqualTo('new_password', message='两次输入的密码不匹配')])

    def validate_new_password(self, field):
        if field.data:
            # 检查密码复杂度
            has_upper = any(c.isupper() for c in field.data)
            has_lower = any(c.islower() for c in field.data)
            has_number = any(c.isdigit() for c in field.data)
            has_special = any(not c.isalnum() for c in field.data)

            if not (has_upper and has_lower and has_number and has_special):
                raise ValidationError('密码必须包含大小写字母、数字和特殊字符')

class ChangePasswordForm(FlaskForm):
    current_password = PasswordField('Current Password', validators=[DataRequired()])
    new_password = PasswordField('New Password', validators=[DataRequired(), Length(min=8)])
    new_password2 = PasswordField('Repeat New Password', validators=[DataRequired(), EqualTo('new_password')])