import json

from flask import Blueprint, render_template, request, jsonify, current_app, redirect, url_for, flash, \
    send_from_directory, abort, send_file
from flask_login import login_user, login_required, logout_user, current_user
from retrying import retry
from sqlalchemy.orm import joinedload

from app.models import User, VerificationCode, Song
from app import db, mail
from flask_mail import Message
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, FileField, BooleanField
from wtforms.validators import DataRequired, Email, EqualTo, ValidationError
import random
import string
from datetime import datetime, timedelta
import re
import base64
from io import BytesIO
from PIL import Image
import os
import logging
from app.forms import RegistrationForm,RequestResetForm,ResetPasswordForm,LoginForm
import time
from pytz import timezone
from app.music_downloader import download_song, audio_id_list, images_download

main = Blueprint('main', __name__)
china_tz = timezone('Asia/Shanghai')

@main.route('/')
def welcome():
    return render_template('index.html')

@main.route('/index')
def index():
    return render_template('main.html')

@main.route('/api/songs', methods=['GET'])
def get_songs():
    songs = Song.query.options(
        joinedload(Song.artist),
        joinedload(Song.album)
    ).order_by(Song.created_at.desc()).limit(8).all()

    songs_data = [{
        'id': song.id,
        'name': song.name,
        'artist': song.artist.name if song.artist else 'Unknown Artist',
        'album': song.album.name if song.album else 'Unknown Album',
        'image_url':  song.image_url,
        'duration': song.duration
    } for song in songs]

    return jsonify(songs_data)

# 获取全部歌曲信息
@main.route('/api/all_songs', methods=['GET'])
def get_all_songs():
    songs = Song.query.options(
        joinedload(Song.artist),
        joinedload(Song.album)
    ).order_by(Song.created_at.desc()).all()

    songs_data = [{
        'id': song.id,
        'name': song.name,
        'artist': song.artist.name if song.artist else 'Unknown Artist',
        'album': song.album.name if song.album else 'Unknown Album',
        'image_url': song.image_url,
        'duration': song.duration
    } for song in songs]

    return jsonify(songs_data)

@main.route('/api/play/<int:song_id>')
def play_song(song_id):
    song = Song.query.get_or_404(song_id)

    # 假设你在Song模型中有一个file_name字段，存储实际的文件名（包括扩展名）
    if not song.name:
        return "Song file not found", 404

    songs_dir = os.path.join(current_app.root_path, 'static', 'songs')
    return send_from_directory(songs_dir, str(song.name) + '.mp3')

@main.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    if request.method == 'GET':
        return render_template('login.html')

    if request.method == 'POST':
        if request.is_json:
            # 处理 AJAX 请求
            data = request.get_json()
            user = User.query.filter_by(email=data.get('email')).first()
            if user and user.check_password(data.get('password')):
                login_user(user)
                user.last_login = datetime.now(china_tz)  # 更新最后登录时间
                db.session.commit()
                return jsonify({'message': '登录成功', 'redirect': url_for('main.index')}), 200
            else:
                return jsonify({'error': '邮箱或密码错误'}), 401
        else:
            # 处理传统表单提交
            form = LoginForm()
            if form.validate_on_submit():
                user = User.query.filter_by(email=form.email.data).first()
                if user and user.check_password(form.password.data):
                    login_user(user, remember=form.remember_me.data)
                    user.last_login = datetime.utcnow()  # 更新最后登录时间
                    db.session.commit()
                    next_page = request.args.get('next')
                    return redirect(next_page or url_for('main.index'))
                flash('邮箱或密码错误')
            return render_template('login.html', form=form)

@main.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.welcome'))


@main.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    form = RegistrationForm()
    if form.validate_on_submit():
        email = form.email.data
        verification_code = form.verification_code.data

        pending_code = VerificationCode.query.filter_by(email=email, purpose='registration').first()

        if not pending_code or pending_code.is_expired():
            flash('Please request a valid verification code.')
            return render_template('register.html', title='Register', form=form)

        if pending_code.code != verification_code:
            flash('Invalid verification code.')
            return render_template('register.html', title='Register', form=form)

        if User.query.filter_by(email=email).first():
            flash('This email is already registered.')
            return render_template('register.html', title='Register', form=form)

        try:
            with db.session.begin_nested():
                new_user = User(
                    username=form.username.data,
                    email=email,
                    gender=form.gender.data
                )
                new_user.set_password(form.password.data)
                db.session.add(new_user)
                db.session.flush()  # This will assign an ID to new_user

                if form.avatar.data:
                    try:
                        image = Image.open(form.avatar.data)
                        image = image.convert('RGB')  # Convert to RGB if it's not
                        avatar_filename = f"avatar_{new_user.id}_{int(time.time())}.png"
                        avatar_path = os.path.join(current_app.config['UPLOAD_FOLDER'], avatar_filename)
                        image.save(avatar_path, format="PNG")
                        new_user.avatar_url = avatar_filename
                    except Exception as e:
                        current_app.logger.error(f"Error processing avatar: {str(e)}")
                        flash('Error processing avatar. Default avatar will be used.')
                        new_user.avatar_url = 'default_avatar.png'  # Set a default avatar
                else:
                    new_user.avatar_url = 'default_avatar.png'  # Set a default avatar if no file was uploaded

                db.session.delete(pending_code)

            db.session.commit()
            flash('Congratulations, you are now a registered user!')
            return redirect(url_for('main.index'))
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error during registration: {str(e)}")
            flash('An error occurred during registration. Please try again.')

    return render_template('register.html', title='Register', form=form)

@retry(stop_max_attempt_number=3, wait_fixed=2000)
def send_email(subject, recipient, body):
    with current_app.app_context():
        msg = Message(subject, recipients=[recipient])
        msg.body = body
        current_app.extensions['mail'].send(msg)

@main.route('/send_verification_code', methods=['POST'])
def send_verification_code():
    email = request.json.get('email')
    purpose = request.json.get('purpose', 'registration')
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    try:
        existing_code = VerificationCode.query.filter_by(email=email, purpose=purpose).first()
        current_time = datetime.utcnow()

        if existing_code and (current_time - existing_code.created_at) < timedelta(minutes=2):
            time_left = 120 - (current_time - existing_code.created_at).seconds
            return jsonify({'error': f'Please wait {time_left} seconds before requesting a new code'}), 400

        verification_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        expires_at = current_time + timedelta(minutes=10)

        if existing_code:
            existing_code.code = verification_code
            existing_code.expires_at = expires_at
            existing_code.created_at = current_time
        else:
            new_code = VerificationCode(email=email, code=verification_code, expires_at=expires_at,
                                        created_at=current_time, purpose=purpose)
            db.session.add(new_code)

        db.session.commit()

        try:
            send_email('Your Verification Code',
                       email,
                       f'Your verification code is: {verification_code}. It will expire in 10 minutes.')
        except Exception as mail_error:
            current_app.logger.error(f"Error sending email: {str(mail_error)}")
            return jsonify({'error': 'Failed to send verification code. Please try again later.'}), 500

        return jsonify({'message': 'Verification code sent successfully'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in send_verification_code: {str(e)}")
        return jsonify({'error': 'An error occurred while processing your request'}), 500

@main.route('/verify_code', methods=['POST'])
def verify_code():
    email = request.json.get('email')
    code = request.json.get('code')

    if not email or not code:
        return jsonify({'error': 'Email and code are required'}), 400

    verification_code = VerificationCode.query.filter_by(email=email, purpose='login').first()

    if not verification_code or verification_code.is_expired():
        return jsonify({'error': 'Invalid or expired verification code'}), 400

    if verification_code.code != code:
        return jsonify({'error': 'Incorrect verification code'}), 400

    user = User.query.filter_by(email=email).first()
    if user:
        login_user(user)
        return jsonify({'message': 'Verification successful', 'redirect': url_for('main.index')}), 200
    else:
        return jsonify({'error': 'User not found'}), 404


@main.route('/profile')
@login_required
def profile():
    return render_template('profile.html', user=current_user)


@main.route('/reset_password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'GET':
        form = RequestResetForm()
        return render_template('reset_password.html', form=form)

    if request.method == 'POST':
        form = RequestResetForm()
        if form.validate_on_submit():
            email = form.email.data
            logging.info(f"Received reset password request for email: {email}")

            user = User.query.filter_by(email=email).first()
            if user:
                verification_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                expires_at = datetime.utcnow() + timedelta(minutes=10)

                new_code = VerificationCode(email=email, code=verification_code, expires_at=expires_at,
                                            created_at=datetime.utcnow(), purpose='password_reset')
                db.session.add(new_code)
                db.session.commit()

                msg = Message('Password Reset Code', recipients=[email])
                msg.body = f'Your password reset code is: {verification_code}. It will expire in 10 minutes.'
                mail.send(msg)
                logging.info(f"Reset password code sent to {email}")
            else:
                logging.info(f"Reset password requested for non-existent email: {email}")

            flash('If an account with that email exists, we have sent a password reset code.')
            return redirect(url_for('main.reset_password_confirm'))

        return render_template('reset_password.html', form=form)


@main.route('/api/search')
def search():
    query = request.args.get('q', '')
    results = audio_id_list(query)
    songs = []
    if results:
        file_names, emixsong_ids = results
        for emixsong_id in emixsong_ids:
            response = images_download(emixsong_id)
            if response:
                content = response.json().get('data', {})
                songs.append({
                    'title': content.get('audio_name', ''),
                    'artist': content.get('author_name', '未知艺术家'),
                    'image_url': content.get('img', ''),
                    'album': content.get('album_name', '未知专辑'),
                    'duration': int(int(content.get('timelength', 0)) / 1000),
                    'emixsong_id': emixsong_id
                })
    return jsonify(songs)


@main.route('/api/download', methods=['POST'])
def download():
    data = request.json
    song_name = f"{data['song']}"
    success, message = download_song(song_name)
    return jsonify({'success': success, 'message': message})

@main.route('/api/songs/<int:song_id>/lyrics')
def get_song_lyrics(song_id):
    song = Song.query.get_or_404(song_id)
    return jsonify(song.import_krc_lyrics(song.lyrics))











def is_strong_password(password):
    return (len(password) >= 8 and
            re.search(r"[A-Z]", password) and
            re.search(r"[a-z]", password) and
            re.search(r"\d", password) and
            re.search(r"[!@#$%^&*(),.?\":{}|<>]", password))


def clean_expired_verification_codes():
    expired_codes = VerificationCode.query.filter(VerificationCode.expires_at < datetime.utcnow()).all()
    for code in expired_codes:
        db.session.delete(code)
    db.session.commit()