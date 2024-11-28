from functools import wraps
from urllib.parse import urlparse, urljoin
from flask_admin.helpers import is_safe_url
from flask_wtf.csrf import generate_csrf
from .email_service import EmailService
from alembic.util import status
from flask import Blueprint, render_template, request, jsonify, current_app, redirect, url_for, flash, \
    send_from_directory, abort, send_file
from flask_login import login_user, login_required, logout_user, current_user
from retrying import retry
from sqlalchemy.orm import joinedload
from werkzeug.datastructures import FileStorage
from app.models import User, VerificationCode, Song
from app import db, mail
from flask_mail import Message
import random
import string
from datetime import datetime, timedelta
import re
from PIL import Image
import os
import logging
from app.forms import RegistrationForm, RequestResetForm, ResetPasswordForm, LoginForm, ProfileForm
import time
from pytz import timezone
from app.music_downloader import download_song, audio_id_list, images_download
from typing import Optional, Tuple
from .utils.redis_client import RedisHelper, RateLimit
import redis
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect()
main = Blueprint('main', __name__)
china_tz = timezone('Asia/Shanghai')
redis_helper = RedisHelper()
auth = Blueprint('auth', __name__)
redis_client = redis.Redis(host='localhost', port=6379, db=0)

def login_rate_limit(f):
    """登录请求速率限制装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        key = f'login_attempts:{request.remote_addr}'
        attempts = redis_client.get(key)

        # 检查是否超过限制(5分钟内最多5次)
        if attempts and int(attempts) >= 5:
            return jsonify({
                'success': False,
                'message': '登录尝试次数过多，请5分钟后再试'
            }), 429

        # 更新尝试次数
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, 300)  # 5分钟过期
        pipe.execute()

        return f(*args, **kwargs)

    return decorated_function

@main.route('/')
def welcome():
    return render_template('index.html')

@main.route('/index')
def index():
    return render_template('main.html')



@main.route('/login', methods=['GET', 'POST'])
def login():
    """登录页面和登录处理"""
    # 如果用户已登录，重定向到首页
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    # GET请求返回登录页面
    if request.method == 'GET':
        return render_template('login.html', title='登录')

    # POST请求处理登录逻辑
    if not request.is_json:
        return jsonify({
            'success': False,
            'message': '无效的请求格式'
        }), 400

    data = request.get_json()
    if not data:
        return jsonify({
            'success': False,
            'message': '无效的请求数据'
        }), 400
    """密码登录处理"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '无效的请求数据'
            }), 400

        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({
                'success': False,
                'message': '请提供邮箱和密码'
            }), 400

        user = User.query.filter_by(email=email).first()

        if user is None or not user.check_password(password):
            return jsonify({
                'success': False,
                'message': '邮箱或密码错误'
            }), 401

        if not user.is_active:
            return jsonify({
                'success': False,
                'message': '账号已被禁用，请联系管理员'
            }), 403

        # 更新最后登录时间
        user.last_login = datetime.utcnow()
        db.session.commit()

        # 执行登录
        login_user(user)

        return jsonify({
            'success': True,
            'message': '登录成功',
            'redirect_url': url_for('main.index')
        })

    except Exception as e:
        current_app.logger.error(f"登录失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '登录失败，请稍后重试'
        }), 500


@main.route('/verification_login', methods=['POST'])
@login_rate_limit
def verification_login():
    """验证码登录处理"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '无效的请求数据'
            }), 400

        email = data.get('email')
        code = data.get('code')

        if not email or not code:
            return jsonify({
                'success': False,
                'message': '请提供邮箱和验证码'
            }), 400

        # 验证验证码
        verification_service = VerificationService(db)
        success, message, _ = verification_service.verify_code(
            email, code, 'login'
        )

        if not success:
            return jsonify({
                'success': False,
                'message': message
            }), 400

        # 查找用户
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({
                'success': False,
                'message': '用户不存在'
            }), 404

        if not user.is_active:
            return jsonify({
                'success': False,
                'message': '账号已被禁用，请联系管理员'
            }), 403

        # 更新最后登录时间
        user.last_login = datetime.utcnow()
        db.session.commit()

        # 执行登录
        login_user(user)

        return jsonify({
            'success': True,
            'message': '登录成功',
            'redirect_url': url_for('main.index')
        })

    except Exception as e:
        current_app.logger.error(f"验证码登录失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '登录失败，请稍后重试'
        }), 500

@main.route('/api/songs', methods=['GET'])
def get_songs():
    songs = Song.query.options(
        joinedload(Song.artists),  # 使用新的多对多关系
        joinedload(Song.album)
    ).order_by(Song.created_at.desc()).limit(8).all()

    songs_data = [{
        'id': song.id,
        'name': song.name,
        'artist': ', '.join(song.artist_names),  # 使用新添加的属性方法
        'album': song.album.name if song.album else 'Unknown Album',
        'image_url': song.image_url,
        'duration': song.duration,
        'file_path': song.get_file_path()  # 使用新添加的方法
    } for song in songs]

    return jsonify(songs_data)


@main.route('/api/songsLoading')
def load_more_songs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 8, type=int)

    # 计算偏移量
    offset = (page - 1) * per_page

    # 查询歌曲
    songs = Song.query.options(
        joinedload(Song.artists),
        joinedload(Song.album)
    ).order_by(Song.created_at.desc()).offset(offset).limit(per_page).all()

    # 获取总数
    total_songs = Song.query.count()
    total_loaded = min(offset + per_page, total_songs)

    songs_data = [{
        'id': song.id,
        'name': song.name,
        'artist': ', '.join(song.artist_names),
        'album': song.album.name if song.album else 'Unknown Album',
        'image_url': song.image_url,
        'duration': song.duration,
        'file_path': song.get_file_path()
    } for song in songs]

    return jsonify({
        'songs': songs_data,
        'has_more': total_loaded < total_songs,
        'total_loaded': total_loaded,
        'total': total_songs
    })

@main.route('/api/all_songs', methods=['GET'])
def get_all_songs():
    songs = Song.query.options(
        joinedload(Song.artists),
        joinedload(Song.album)
    ).order_by(Song.created_at.desc()).all()

    songs_data = [{
        'id': song.id,
        'name': song.name,
        'artist': ', '.join(song.artist_names),
        'album': song.album.name if song.album else 'Unknown Album',
        'image_url': song.image_url,
        'duration': song.duration,
        'file_path': song.get_file_path()
    } for song in songs]

    return jsonify(songs_data)

@main.route('/api/songs/total', methods=['GET'])
def get_total_songs():
    try:
        total = Song.query.count()
        return jsonify({
            'total': total,
            'status': 'success'
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@main.route('/api/play/<int:song_id>')
def play_song(song_id):
    """
    处理音频文件的播放请求

    Args:
        song_id: 歌曲ID

    Returns:
        成功时返回音频文件流，失败时返回错误信息和状态码
    """
    try:
        # 使用 joined load 优化查询，减少数据库查询次数
        song = Song.query.options(
            joinedload(Song.artists),
            joinedload(Song.album)
        ).get_or_404(song_id)

        if not song.file_path:
            abort(404, description="Song file not found")

        # 获取文件路径
        filename = os.path.basename(song.file_path)
        file_directory = os.path.join(current_app.config['UPLOAD_FOLDER'], 'songs')
        file_path = os.path.join(file_directory, filename)

        if not os.path.exists(file_path):
            abort(404, description="Audio file not found")

        # 根据文件扩展名确定MIME类型
        mime_type = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'm4a': 'audio/mp4'
        }.get(filename.rsplit('.', 1)[1].lower(), 'application/octet-stream')

        return send_from_directory(
            file_directory,
            filename,
            mimetype=mime_type,
            as_attachment=False
        )

    except Exception as e:
        abort(500, description="Internal server error")


@main.route('/api/songs/<int:song_id>/like', methods=['POST'])
@login_required
def toggle_like_song(song_id):
    song = Song.query.get_or_404(song_id)
    user = current_user

    if user.has_liked_song(song):
        user.unlike_song(song)
        is_liked = False
    else:
        user.like_song(song)
        is_liked = True

    return jsonify({
        'status': 'success',
        'is_liked': is_liked,
        'likes_count': song.likes_count
    })

@main.route('/api/songs/<int:song_id>/like-status', methods=['GET'])
@login_required
def get_song_like_status(song_id):
    song = Song.query.get_or_404(song_id)
    return jsonify({
        'status': 'success',
        'is_liked': current_user.has_liked_song(song),
        'likes_count': song.likes_count
    })


@main.route('/api/me/favorites', methods=['GET'])
@login_required
def get_my_favorites():
    page = request.args.get('page', 1, type=int)
    favorites = current_user.get_favorite_songs(page=page)

    return jsonify({
        'status': 'success',
        'total': favorites.total,
        'songs': [song.to_dict for song in favorites.items]
    })

@main.route('/api/download', methods=['POST'])
def download():
    """下载歌曲"""
    data = request.json
    song_name = data.get('song')

    if not song_name:
        return jsonify({'success': False, 'message': '歌曲名称不能为空'})

    # 不传入用户ID进行下载
    success, message = download_song(song_name)

    if success:
        # 查找最新下载的歌曲
        song = Song.query.filter_by(name=song_name).first()
        if song:
            song_data = {
                'id': song.id,
                'name': song.name,
                'artist': ', '.join(song.artist_names),
                'album': song.album.name if song.album else 'Unknown Album',
                'image_url': song.image_url,
                'duration': song.duration,
                'file_path': song.get_file_path()
            }
            return jsonify({
                'success': True,
                'message': '下载成功',
                'song': song_data
            })

    return jsonify({'success': False, 'message': message})


@main.route('/api/songs/<int:song_id>/lyrics')
def get_song_lyrics(song_id):
    song = Song.query.get_or_404(song_id)
    song.parse_lyrics(song.lyrics)
    if not song.lyrics:
        return jsonify({'lyrics': []})
    return jsonify({'lyrics': song.lyrics['lyrics']})




@main.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.welcome'))


@main.route('/register', methods=['GET', 'POST'])
def register():
    form = RegistrationForm()
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    if request.method == 'GET':
        return render_template('register.html', title='Register',form=form)

    # POST 请求处理
    form = RegistrationForm()
    if not form.validate_on_submit():
        return jsonify({
            'success': False,
            'errors': form.errors
        }), 400

    # 初始化注册服务
    registration_service = RegistrationService(db, current_app)

    # 收集表单数据
    form_data = {
        'username': form.username.data,
        'email': form.email.data,
        'password': form.password.data,
        'verification_code': form.verification_code.data,
        'gender': form.gender.data,
        'avatar': form.avatar.data
    }

    # 执行注册
    success, error_message, user_data = registration_service.register_user(form_data)

    if not success:
        return jsonify({
            'success': False,
            'message': error_message
        }), 400

    # 注册成功
    return jsonify({
        'success': True,
        'message': '注册成功！',
        'data': user_data
    })

@retry(stop_max_attempt_number=3, wait_fixed=2000)
def send_email(subject, recipient, body):
    with current_app.app_context():
        msg = Message(subject, recipients=[recipient])
        msg.body = body
        current_app.extensions['mail'].send(msg)

@main.route('/send_verification_code', methods=['POST'])
 # 5分钟内最多5次请求
async def send_verification_code():
    """发送验证码"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '无效的请求数据'
            }), 400

        email = data.get('email')
        purpose = data.get('purpose', 'registration')

        if not email:
            return jsonify({
                'success': False,
                'message': '请提供邮箱地址'
            }), 400

        if purpose not in ['registration', 'login', 'reset_password']:
            return jsonify({
                'success': False,
                'message': '无效的验证码用途'
            }), 400

        verification_service = VerificationService(db)

        # 创建验证码
        success, code_or_error, cooldown = verification_service.create_or_update_code(
            email, purpose
        )

        if not success:
            return jsonify({
                'success': False,
                'message': code_or_error,
                'cooldown': cooldown
            }), 400

        # 发送邮件
        email_sent =  verification_service.send_verification_email(
            email, code_or_error, purpose
        )

        if not email_sent:
            return jsonify({
                'success': False,
                'message': '验证码发送失败，请稍后重试'
            }), 500

        return jsonify({
            'success': True,
            'message': '验证码已发送，请查收邮件'
        })

    except Exception as e:
        current_app.logger.error(f"发送验证码失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '发送验证码失败，请稍后重试'
        }), 500

@main.route('/verify_code', methods=['POST'])
async def verify_code():
    """验证验证码"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '无效的请求数据'
            }), 400

        email = data.get('email')
        code = data.get('code')
        purpose = data.get('purpose', 'login')

        if not email or not code:
            return jsonify({
                'success': False,
                'message': '请提供邮箱和验证码'
            }), 400

        verification_service = VerificationService(db)
        success, message, additional_data = verification_service.verify_code(
            email, code, purpose
        )

        if not success:
            return jsonify({
                'success': False,
                'message': message
            }), 400

        response_data = {
            'success': True,
            'message': message
        }

        # 如果是登录验证，执行登录
        if purpose == 'login':
            user = User.query.filter_by(email=email).first()
            if user:
                login_user(user)
                response_data['redirect_url'] = url_for('main.index')
            else:
                return jsonify({
                    'success': False,
                    'message': '用户不存在'
                }), 404

        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"验证码验证失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '验证失败，请稍后重试'
        }), 500





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
    """搜索在线歌曲"""
    query = request.args.get('q', '')
    if not query:
        return jsonify([])

    results = audio_id_list(query)
    songs = []
    if results:
        file_names, emixsong_ids = results
        for i, emixsong_id in enumerate(emixsong_ids):
            response = images_download(emixsong_id)
            if response and response.ok:
                content = response.json().get('data', {})
                songs.append({
                    'title': content.get('audio_name', ''),
                    'artist': content.get('author_name', '未知艺术家'),
                    'album': content.get('album_name', '未知专辑'),
                    'duration': int(int(content.get('timelength', 0)) / 1000),
                    'image_url': content.get('img', ''),
                    'emixsong_id': emixsong_id,
                    'file_name': file_names[i]
                })

    return jsonify(songs)

@main.route('/profile', methods=['GET', 'POST'])
@login_required
def user_profile():
    """个人信息页面"""
    form = ProfileForm(
        original_username=current_user.username,
        original_email=current_user.email,
        formdata=request.form if request.method == 'POST' else None,
        obj=current_user if request.method == 'GET' else None
    )

    if request.method == 'GET':
        return render_template('profile.html', form=form, user=current_user)

    return render_template('profile.html', form=form, user=current_user)

@main.route('/upload_avatar', methods=['POST'])
@login_required
def upload_avatar():
    """头像上传处理"""
    try:
        if 'avatar' not in request.files:
            return jsonify({'success': False, 'message': '没有上传文件'}), 400

        avatar_file = request.files['avatar']
        if not avatar_file.filename:
            return jsonify({'success': False, 'message': '没有选择文件'}), 400

        # 验证文件类型
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
        if not ('.' in avatar_file.filename and
                avatar_file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'success': False, 'message': '不支持的文件类型'}), 400

        # 保存新头像
        avatar_filename = save_avatar(avatar_file, current_user)
        if not avatar_filename:
            return jsonify({'success': False, 'message': '头像保存失败'}), 500

        # 删除旧头像
        if current_user.avatar_url:
            old_avatar_path = os.path.join(
                current_app.root_path, 'static', 'uploads', current_user.avatar_url
            )
            if os.path.exists(old_avatar_path):
                os.remove(old_avatar_path)

        # 更新数据库
        current_user.avatar_url = avatar_filename
        current_user.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '头像更新成功',
            'avatar_url': url_for('static', filename=f'uploads/{avatar_filename}')
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Avatar update error: {str(e)}")
        return jsonify({'success': False, 'message': '头像更新失败'}), 500

@main.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    """更新个人信息"""
    try:
        data = request.get_json() if request.is_json else request.form.to_dict()
        errors = {}

        # 验证并更新密码
        if data.get('current_password'):
            if not current_user.check_password(data['current_password']):
                errors['current_password'] = '当前密码错误'
            elif data.get('new_password'):
                if not is_strong_password(data['new_password']):
                    errors['new_password'] = '密码长度至少8位'
                elif data['new_password'] != data.get('confirm_password'):
                    errors['confirm_password'] = '两次输入的密码不一致'
                else:
                    current_user.set_password(data['new_password'])

        # 验证并更新用户名
        if 'username' in data and data['username'] != current_user.username:
            if User.query.filter_by(username=data['username']).first():
                errors['username'] = '用户名已存在'
            elif not re.match(r'^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$', data['username']):
                errors['username'] = '用户名格式不正确'
            else:
                current_user.username = data['username']

        if errors:
            return jsonify({
                'success': False,
                'message': '更新失败',
                'errors': errors
            }), 400

        # 更新性别
        if 'gender' in data:
            current_user.gender = data['gender']

        current_user.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '个人信息更新成功',
            'data': {
                'username': current_user.username,
                'gender': current_user.gender,
                'updated_at': current_user.updated_at.strftime('%Y-%m-%d %H:%M:%S')
            }
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Profile update error: {str(e)}")
        return jsonify({
            'success': False,
            'message': '更新失败',
            'error': str(e)
        }), 500


def is_strong_password(password):
    return len(password) >= 8


def clean_expired_verification_codes():
    expired_codes = VerificationCode.query.filter(VerificationCode.expires_at < datetime.utcnow()).all()
    for code in expired_codes:
        db.session.delete(code)
    db.session.commit()


def save_avatar(file, user):
    """保存头像文件并返回文件名"""
    if not file:
        return None
    try:
        image = Image.open(file)
        image = image.convert('RGB')

        timestamp = int(time.time())
        filename = f"avatar_{user.id}_{timestamp}.png"

        upload_dir = os.path.join(current_app.root_path, 'static', 'uploads')
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)

        file_path = os.path.join(upload_dir, filename)
        image.save(file_path, format="PNG")
        return filename
    except Exception as e:
        current_app.logger.error(f"Error saving avatar: {str(e)}")
        return None


class RegistrationService:
    def __init__(self, db, current_app):
        self.db = db
        self.app = current_app
        self.logger = current_app.logger

    def verify_registration_code(self, email: str, code: str) -> Tuple[bool, Optional[str]]:
        """验证注册验证码"""
        pending_code = VerificationCode.query.filter_by(
            email=email,
            purpose='registration'
        ).first()

        if not pending_code:
            return False, "请先获取验证码"

        if pending_code.is_expired():
            return False, "验证码已过期，请重新获取"

        if pending_code.code != code:
            return False, "验证码错误"

        return True, None

    def check_email_availability(self, email: str) -> Tuple[bool, Optional[str]]:
        """检查邮箱是否可用"""
        if User.query.filter_by(email=email).first():
            return False, "该邮箱已被注册"
        return True, None

    def process_avatar(self, avatar_file: FileStorage, user_id: int) -> Tuple[str, Optional[str]]:
        """处理头像上传"""
        try:
            if not avatar_file:
                return 'default_avatar.png', None

            # 验证文件类型
            if not self._is_allowed_file(avatar_file.filename):
                return 'default_avatar.png', "不支持的文件格式"

            # 处理图片
            image = Image.open(avatar_file)
            image = image.convert('RGB')

            # 限制图片大小
            if image.size[0] > 1920 or image.size[1] > 1920:
                image.thumbnail((1920, 1920), Image.Resampling.LANCZOS)

            # 生成文件名和路径
            timestamp = int(time.time())
            filename = f"avatar_{user_id}_{timestamp}.png"
            avatar_directory = self._ensure_upload_directory()
            filepath = os.path.join(avatar_directory, filename)

            # 保存图片
            image.save(filepath, format="PNG", quality=95, optimize=True)

            return filename, None

        except Exception as e:
            self.logger.error(f"头像处理错误: {str(e)}", exc_info=True)
            return 'default_avatar.png', "头像处理失败"

    def register_user(self, form_data: dict) -> Tuple[bool, Optional[str], Optional[dict]]:
        """用户注册流程"""
        try:
            # 验证码检查
            code_valid, code_error = self.verify_registration_code(
                form_data['email'],
                form_data['verification_code']
            )
            if not code_valid:
                return False, code_error, None

            # 邮箱可用性检查
            email_available, email_error = self.check_email_availability(form_data['email'])
            if not email_available:
                return False, email_error, None

            # 开启事务
            with self.db.session.begin_nested():
                # 创建新用户
                new_user = User(
                    username=form_data['username'],
                    email=form_data['email'],
                    gender=form_data['gender']
                )
                new_user.set_password(form_data['password'])

                # 添加用户并获取ID
                self.db.session.add(new_user)
                self.db.session.flush()

                # 处理头像
                avatar_filename, avatar_error = self.process_avatar(
                    form_data.get('avatar'),
                    new_user.id
                )
                if avatar_error:
                    return False, avatar_error, None

                new_user.avatar_url = avatar_filename

                # 删除验证码
                pending_code = VerificationCode.query.filter_by(
                    email=form_data['email'],
                    purpose='registration'
                ).first()
                if pending_code:
                    self.db.session.delete(pending_code)

            # 提交事务
            self.db.session.commit()

            return True, None, {
                'user_id': new_user.id,
                'username': new_user.username,
                'redirect_url': url_for('main.index')
            }

        except Exception as e:
            self.db.session.rollback()
            self.logger.error("注册过程错误", exc_info=True)
            return False, "注册失败，请稍后重试", None

    def _is_allowed_file(self, filename: str) -> bool:
        """检查文件类型是否允许"""
        ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
        return '.' in filename and \
            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

    def _ensure_upload_directory(self) -> str:
        """确保上传目录存在"""
        avatar_directory = os.path.join(
            self.app.config['UPLOAD_FOLDER'],
            'uploads'
        )
        os.makedirs(avatar_directory, exist_ok=True)
        return avatar_directory


class VerificationService:
    def __init__(self, db):
        self.db = db
        self.email_service = EmailService()

    def create_or_update_code(self, email: str, purpose: str = 'registration') -> Tuple[bool, str, Optional[int]]:
        """创建或更新验证码"""
        try:
            current_time = datetime.utcnow()
            existing_code = VerificationCode.query.filter_by(
                email=email,
                purpose=purpose
            ).first()

            # 检查冷却时间
            if existing_code:
                time_since_last = (current_time - existing_code.created_at).total_seconds()
                if time_since_last < 120:  # 2分钟冷却时间
                    return False, '请稍后再试', int(120 - time_since_last)

            # 生成新验证码
            verification_code = self._generate_code()
            expires_at = current_time + timedelta(minutes=10)

            if existing_code:
                existing_code.code = verification_code
                existing_code.expires_at = expires_at
                existing_code.created_at = current_time
            else:
                new_code = VerificationCode(
                    email=email,
                    code=verification_code,
                    expires_at=expires_at,
                    created_at=current_time,
                    purpose=purpose,
                    attempts=0
                )
                self.db.session.add(new_code)

            self.db.session.commit()
            return True, verification_code, None

        except Exception as e:
            self.db.session.rollback()
            current_app.logger.error(f"验证码创建错误: {str(e)}", exc_info=True)
            raise

    def verify_code(self, email: str, code: str, purpose: str) -> Tuple[bool, str, Optional[dict]]:
        """验证验证码"""
        try:
            verification = VerificationCode.query.filter_by(
                email=email,
                purpose=purpose
            ).first()

            if not verification:
                return False, '验证码不存在', None

            if verification.is_expired():
                return False, '验证码已过期', None

            # 检查尝试次数
            if verification.attempts >= 5:
                return False, '尝试次数过多，请重新获取验证码', None

            verification.attempts += 1
            self.db.session.commit()

            if verification.code != code:
                return False, '验证码错误', None

            # 验证成功后，如果是注册验证码，直接删除
            if purpose == 'registration':
                self.db.session.delete(verification)
                self.db.session.commit()

            return True, '验证成功', None

        except Exception as e:
            self.db.session.rollback()
            current_app.logger.error(f"验证码验证错误: {str(e)}", exc_info=True)
            raise

    def _generate_code(self, length: int = 6) -> str:
        """生成验证码"""
        return ''.join(random.choices(string.digits, k=length))

    def send_verification_email(self, email: str, code: str, purpose: str = 'registration') -> bool:
        """发送验证码邮件"""
        try:
            # 直接调用 EmailService 的 send_verification_code 方法
            result = self.email_service.send_verification_code(
                email=email,
                code=code,
                purpose=purpose
            )
            return result
        except Exception as e:
            current_app.logger.error(f"发送验证码邮件失败: {str(e)}", exc_info=True)
            return False

def simple_rate_limit(limit=10, period=60):
    """简化版速率限制装饰器"""

    def decorator(f):
        if not hasattr(simple_rate_limit, 'request_history'):
            simple_rate_limit.request_history = {}

        @wraps(f)
        def wrapped(*args, **kwargs):
            key = f"{request.remote_addr}:{request.endpoint}"
            now = time.time()

            # 获取该IP的请求历史
            request_times = simple_rate_limit.request_history.get(key, [])

            # 清理过期的记录
            request_times = [t for t in request_times if t > now - period]

            # 检查是否超过限制
            if len(request_times) >= limit:
                return jsonify({
                    'success': False,
                    'message': '请求过于频繁，请稍后再试'
                }), 429

            # 添加新的请求时间
            request_times.append(now)
            simple_rate_limit.request_history[key] = request_times

            return f(*args, **kwargs)

        return wrapped

    return decorator


def is_safe_url(target):
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc


def ratelimit(limit=5, window=60):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            # 获取客户端IP
            ip = request.remote_addr
            key = f'login_attempts:{ip}'

            # 检查是否超过限制
            attempts = redis_client.get(key)
            if attempts and int(attempts) >= limit:
                return jsonify({'error': '尝试次数过多，请稍后再试'}), 429

            # 更新尝试次数
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window)
            pipe.execute()

            return f(*args, **kwargs)

        return wrapped

    return decorator


def login_rate_limit(f):
    """登录请求速率限制装饰器"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        key = f'login_attempts:{request.remote_addr}'
        attempts = redis_client.get(key)

        # 检查是否超过限制(5分钟内最多5次)
        if attempts and int(attempts) >= 5:
            return jsonify({
                'success': False,
                'message': '登录尝试次数过多，请5分钟后再试'
            }), 429

        # 更新尝试次数
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, 300)  # 5分钟过期
        pipe.execute()

        return f(*args, **kwargs)

    return decorated_function