from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, FileField, BooleanField, SelectField
from wtforms.fields.simple import EmailField
from wtforms.validators import DataRequired, Email, EqualTo, ValidationError, Length, Optional
from flask_wtf.file import FileAllowed
from wtforms.widgets.core import PasswordInput

from app.models import User

class RegistrationForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=2, max=20)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=8)])
    password2 = PasswordField('Repeat Password', validators=[DataRequired(), EqualTo('password')])
    avatar = FileField('Avatar', validators=[FileAllowed(['jpg', 'png', 'jpeg'], 'Images only!')])
    verification_code = StringField('Verification Code', validators=[DataRequired(), Length(min=6, max=6)])
    gender = SelectField('Gender', choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')], validators=[DataRequired()])

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('That username is taken. Please choose a different one.')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user:
            raise ValidationError('That email is taken. Please choose a different one.')

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