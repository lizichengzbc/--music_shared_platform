from flask import redirect, url_for
from flask_admin import Admin, AdminIndexView
from flask_admin.contrib.sqla import ModelView
from flask_admin.form import ImageUploadField
from flask_login import current_user
from werkzeug.security import generate_password_hash
from wtforms import PasswordField
import os
from datetime import datetime, timedelta

# 导入所有模型
from app.models import User, Artist, Album, Song, Download, VerificationCode
from app import db

# 定义上传路径
STATIC_PATH = 'app/static'
ARTIST_IMAGE_PATH = os.path.join(STATIC_PATH, 'images')
ALBUM_IMAGE_PATH = os.path.join(STATIC_PATH, 'music_images')
SONG_FILE_PATH = os.path.join(STATIC_PATH, 'songs')
UPLOAD_PATH = os.path.join(STATIC_PATH, 'uploads')


class SecureModelView(ModelView):
    def is_accessible(self):
        return current_user.is_authenticated

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('main.login'))


class UserModelView(SecureModelView):
    can_view_details = True
    column_exclude_list = ['password_hash']
    column_searchable_list = ['username', 'email']
    column_filters = ['is_active', 'created_at', 'last_login']
    form_excluded_columns = ['password_hash', 'downloads']

    form_extra_fields = {
        'password': PasswordField('Password'),
        'avatar_url': ImageUploadField('Avatar',
                                       base_path=os.path.join(STATIC_PATH, 'images'),
                                       relative_path='images/')
    }

    def on_model_change(self, form, model, is_created):
        if form.password.data:
            model.password_hash = generate_password_hash(form.password.data)


class ArtistModelView(SecureModelView):
    can_view_details = True
    column_searchable_list = ['name']
    column_filters = ['created_at']
    form_excluded_columns = ['songs', 'albums']

    form_extra_fields = {
        'image_url': ImageUploadField('Artist Image',
                                      base_path=ARTIST_IMAGE_PATH,
                                      relative_path='images/',
                                      allowed_extensions=['jpg', 'gif', 'png', 'jpeg'])
    }

    def _format_image_url(view, context, model, name):
        if not model.image_url:
            return ''
        return f'<img src="/{model.image_url}" width="100">'

    column_formatters = {
        'image_url': _format_image_url
    }


class AlbumModelView(SecureModelView):
    can_view_details = True
    column_searchable_list = ['name']
    column_filters = ['release_year', 'created_at', 'artist.name']
    form_excluded_columns = ['songs']

    form_extra_fields = {
        'cover_image_path': ImageUploadField('Album Cover',
                                             base_path=ALBUM_IMAGE_PATH,
                                             relative_path='music_images/',
                                             allowed_extensions=['jpg', 'gif', 'png', 'jpeg'])
    }

    def _format_cover_image(view, context, model, name):
        if not model.cover_image_path:
            return ''
        return f'<img src="/{model.cover_image_path}" width="100">'

    column_formatters = {
        'cover_image_path': _format_cover_image
    }


class SongModelView(SecureModelView):
    can_view_details = True
    can_export = True
    column_searchable_list = ['name']
    column_filters = ['download_count', 'created_at', 'album.name', 'artists.name']
    column_list = ['name', 'artists', 'album', 'duration', 'download_count', 'file_path', 'created_at']

    form_excluded_columns = ['downloads', 'lyrics', 'download_count']

    form_extra_fields = {
        'file_path': ImageUploadField('Song File',
                                      base_path=SONG_FILE_PATH,
                                      relative_path='songs/',
                                      allowed_extensions=['mp3', 'wav', 'flac', 'm4a'])
    }

    def _artist_names(view, context, model, name):
        return ', '.join([artist.name for artist in model.artists])

    def _format_duration(view, context, model, name):
        if not model.duration:
            return ''
        minutes = model.duration // 60
        seconds = model.duration % 60
        return f'{minutes}:{seconds:02d}'

    column_formatters = {
        'artists': _artist_names,
        'duration': _format_duration
    }


class DownloadModelView(SecureModelView):
    can_view_details = True
    can_create = False
    column_filters = ['download_time', 'status', 'user.username', 'song.name']
    column_searchable_list = ['source_url', 'user.username', 'song.name']
    column_list = ['user', 'song', 'download_time', 'status', 'source_url']


class VerificationCodeModelView(SecureModelView):
    can_view_details = True
    can_create = False
    column_filters = ['created_at', 'expires_at', 'purpose']
    column_searchable_list = ['email']
    column_list = ['email', 'code', 'purpose', 'created_at', 'expires_at']


class MusicAdminIndexView(AdminIndexView):
    def is_accessible(self):
        return current_user.is_authenticated

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('main.login'))

    def _get_count(self, model):
        return db.session.query(model).count()

    def _get_recent_count(self, model):
        yesterday = datetime.utcnow() - timedelta(days=1)
        # 检查是否为 Download 模型，如果是则使用 download_time
        if model == Download:
            return db.session.query(model).filter(model.download_time >= yesterday).count()
        # 其他模型使用 created_at
        return db.session.query(model).filter(model.created_at >= yesterday).count()

    def render(self, template, **kwargs):
        # 添加统计数据到模板上下文
        stats = {
            'total_users': self._get_count(User),
            'total_artists': self._get_count(Artist),
            'total_albums': self._get_count(Album),
            'total_songs': self._get_count(Song),
            'recent_downloads': self._get_recent_count(Download),
            'recent_users': self._get_recent_count(User)
        }
        kwargs['stats'] = stats
        return super().render(template, **kwargs)


def init_admin(app):
    """初始化 Flask-Admin"""
    admin = Admin(
        app,
        name='Music Manager',
        template_mode='bootstrap4',
        index_view=MusicAdminIndexView(
            name='Dashboard',
            template='admin/index.html',
            url='/admin'
        )
    )

    # 注册所有模型视图
    admin.add_view(UserModelView(User, db.session, name='Users', endpoint='admin_users'))
    admin.add_view(ArtistModelView(Artist, db.session, name='Artists', endpoint='admin_artists'))
    admin.add_view(AlbumModelView(Album, db.session, name='Albums', endpoint='admin_albums'))
    admin.add_view(SongModelView(Song, db.session, name='Songs', endpoint='admin_songs'))
    admin.add_view(DownloadModelView(Download, db.session, name='Downloads', endpoint='admin_downloads'))
    admin.add_view(
        VerificationCodeModelView(VerificationCode, db.session, name='Verification Codes', endpoint='admin_codes'))

    return admin