from flask import redirect, url_for, flash
from flask_admin import Admin, AdminIndexView, expose
from flask_admin.contrib.sqla import ModelView
from flask_admin.form import ImageUploadField, FileUploadField
from flask_login import current_user
from werkzeug.security import generate_password_hash
from wtforms import PasswordField, SelectField, TextAreaField
from wtforms.validators import DataRequired, Email, Length
import os
from datetime import datetime, timedelta

from app.models import User, Artist, Album, Song, Download, VerificationCode
from app import db

# Define upload paths
STATIC_PATH = 'app/static'
UPLOAD_PATHS = {
    'artist_images': os.path.join(STATIC_PATH, 'images'),
    'album_covers': os.path.join(STATIC_PATH, 'music_images'),
    'song_files': os.path.join(STATIC_PATH, 'songs'),
    'user_avatars': os.path.join(STATIC_PATH, 'avatars')
}


class SecureModelView(ModelView):
    def is_accessible(self):
        return current_user.is_authenticated and current_user.is_active

    def inaccessible_callback(self, name, **kwargs):
        flash('Please log in to access the admin panel.', 'warning')
        return redirect(url_for('main.login'))


class UserModelView(SecureModelView):
    can_view_details = True
    can_export = True

    column_list = ['username', 'email', 'is_active', 'last_login', 'created_at']
    column_searchable_list = ['username', 'email']
    column_filters = ['is_active', 'created_at', 'last_login', 'gender']
    column_sortable_list = ['username', 'created_at', 'last_login']
    column_default_sort = ('created_at', True)

    form_excluded_columns = ['password_hash', 'downloads', 'favorite_songs']
    form_create_rules = ['username', 'email', 'password', 'avatar_url', 'gender', 'is_active']
    form_edit_rules = ['username', 'email', 'password', 'avatar_url', 'gender', 'is_active']

    form_extra_fields = {
        'password': PasswordField('Password', validators=[Length(min=6)]),
        'avatar_url': ImageUploadField('Avatar',
                                       base_path=UPLOAD_PATHS['user_avatars'],
                                       relative_path='avatars/',
                                       allowed_extensions=['jpg', 'png', 'jpeg', 'gif'])
    }

    def on_model_change(self, form, model, is_created):
        if form.password.data:
            model.password_hash = generate_password_hash(form.password.data)


class ArtistModelView(SecureModelView):
    can_view_details = True
    can_export = True

    column_list = ['name', 'image_url', 'created_at', 'album_count', 'song_count']
    column_searchable_list = ['name']
    column_filters = ['created_at']
    column_sortable_list = ['name', 'created_at']

    form_excluded_columns = ['songs', 'albums']

    form_extra_fields = {
        'image_url': ImageUploadField('Artist Image',
                                      base_path=UPLOAD_PATHS['artist_images'],
                                      relative_path='images/',
                                      allowed_extensions=['jpg', 'png', 'jpeg', 'gif'])
    }

    def _format_image_url(view, context, model, name):
        if not model.image_url:
            return ''
        return f'<img src="/{model.image_url}" width="100">'

    def _album_count(view, context, model, name):
        return model.albums.count()

    def _song_count(view, context, model, name):
        return model.songs.count()

    column_formatters = {
        'image_url': _format_image_url,
        'album_count': _album_count,
        'song_count': _song_count
    }


class AlbumModelView(SecureModelView):
    can_view_details = True
    can_export = True

    column_list = ['name', 'artist', 'release_year', 'cover_image_path', 'song_count', 'created_at']
    column_searchable_list = ['name', 'artist.name']
    column_filters = ['release_year', 'created_at', 'artist.name']
    column_sortable_list = ['name', 'release_year', 'created_at']

    form_excluded_columns = ['songs', 'local_cover_path']

    form_extra_fields = {
        'cover_image_path': ImageUploadField('Album Cover',
                                             base_path=UPLOAD_PATHS['album_covers'],
                                             relative_path='music_images/',
                                             allowed_extensions=['jpg', 'png', 'jpeg', 'gif'])
    }

    def _format_cover_image(view, context, model, name):
        if not model.cover_image_path:
            return ''
        return f'<img src="/{model.cover_image_path}" width="100">'

    def _song_count(view, context, model, name):
        return model.songs.count()

    column_formatters = {
        'cover_image_path': _format_cover_image,
        'song_count': _song_count
    }


class SongModelView(SecureModelView):
    can_view_details = True
    can_export = True

    column_list = ['name', 'artists', 'album', 'duration', 'download_count', 'likes_count', 'created_at']
    column_searchable_list = ['name', 'artists.name', 'album.name']
    column_filters = ['download_count', 'likes_count', 'created_at', 'album.name']
    column_sortable_list = ['name', 'download_count', 'likes_count', 'created_at']

    form_excluded_columns = ['downloads', 'favorited_by', 'local_image_path']

    form_extra_fields = {
        'file_path': FileUploadField('Song File',
                                     base_path=UPLOAD_PATHS['song_files'],
                                     relative_path='songs/',
                                     allowed_extensions=['mp3', 'wav', 'flac', 'm4a']),
        'lyrics_text': TextAreaField('Lyrics')
    }

    def _format_duration(view, context, model, name):
        if not model.duration:
            return ''
        minutes = model.duration // 60
        seconds = model.duration % 60
        return f'{minutes}:{seconds:02d}'

    def _format_artists(view, context, model, name):
        return ', '.join(model.artist_names)

    column_formatters = {
        'duration': _format_duration,
        'artists': _format_artists
    }

    def on_model_change(self, form, model, is_created):
        if hasattr(form, 'lyrics_text') and form.lyrics_text.data:
            model.parse_lyrics(form.lyrics_text.data)


class DownloadModelView(SecureModelView):
    can_view_details = True
    can_export = True
    can_create = False
    can_edit = False

    column_list = ['user', 'song', 'download_time', 'status', 'source_url']
    column_searchable_list = ['user.username', 'song.name', 'source_url']
    column_filters = ['download_time', 'status', 'user.username', 'song.name']
    column_sortable_list = ['download_time', 'status']
    column_default_sort = ('download_time', True)


class VerificationCodeModelView(SecureModelView):
    can_view_details = True
    can_create = False
    can_edit = False

    column_list = ['email', 'code', 'purpose', 'created_at', 'expires_at', 'attempts']
    column_searchable_list = ['email', 'code']
    column_filters = ['purpose', 'created_at', 'expires_at', 'attempts']
    column_sortable_list = ['created_at', 'expires_at', 'attempts']


class MusicAdminIndexView(AdminIndexView):
    def is_accessible(self):
        return current_user.is_authenticated and current_user.is_active

    def inaccessible_callback(self, name, **kwargs):
        flash('请登录以访问管理面板', 'warning')
        return redirect(url_for('main.login'))

    @expose('/')
    def index(self):
        from datetime import datetime

        # 统计数据
        stats = {
            'total_users': db.session.query(User).count(),
            'total_artists': db.session.query(Artist).count(),
            'total_albums': db.session.query(Album).count(),
            'total_songs': db.session.query(Song).count(),
            'recent_downloads': db.session.query(Download).filter(
                Download.download_time >= datetime.utcnow() - timedelta(days=1)
            ).count(),
            'recent_users': db.session.query(User).filter(
                User.created_at >= datetime.utcnow() - timedelta(days=1)
            ).count(),
            'top_songs': db.session.query(Song).order_by(Song.download_count.desc()).limit(5).all(),
            'most_liked_songs': db.session.query(Song).order_by(Song.likes_count.desc()).limit(5).all(),
            'recent_downloads_list': db.session.query(Download).order_by(
                Download.download_time.desc()
            ).limit(10).all(),
            'current_time': datetime.utcnow()  # 添加当前时间到 stats 字典中
        }
        return self.render('admin/index.html', stats=stats)
def init_admin(app):
    admin = Admin(
        app,
        name='Music Admin',
        template_mode='bootstrap4',
        index_view=MusicAdminIndexView(
            name='Dashboard',
            template='admin/index.html',
            url='/admin'
        )
    )

    # Register all model views
    admin.add_view(UserModelView(User, db.session, name='Users', category='User Management'))
    admin.add_view(ArtistModelView(Artist, db.session, name='Artists', category='Content'))
    admin.add_view(AlbumModelView(Album, db.session, name='Albums', category='Content'))
    admin.add_view(SongModelView(Song, db.session, name='Songs', category='Content'))
    admin.add_view(DownloadModelView(Download, db.session, name='Downloads', category='Activity'))
    admin.add_view(
        VerificationCodeModelView(VerificationCode, db.session, name='Verification Codes', category='Activity'))

    return admin