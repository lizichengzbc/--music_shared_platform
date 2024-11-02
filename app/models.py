import re
from sqlalchemy.dialects.mysql import JSON
from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin



# 创建艺术家和歌曲的多对多关系表
song_artists = db.Table('song_artists',
                        db.Column('song_id', db.Integer, db.ForeignKey('songs.id'), primary_key=True),
                        db.Column('artist_id', db.Integer, db.ForeignKey('artists.id'), primary_key=True),
                        db.Column('created_at', db.DateTime, default=datetime.utcnow)
                        )


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True, nullable=False)
    email = db.Column(db.String(120), index=True, unique=True, nullable=False)
    password_hash = db.Column(db.String(512), nullable=False)
    avatar_url = db.Column(db.String(255))
    gender = db.Column(db.String(10))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    downloads = db.relationship('Download', back_populates='user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

class VerificationCode(db.Model):
    __tablename__ = 'verification_codes'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)
    code = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    purpose = db.Column(db.String(20), nullable=False)

    def is_expired(self):
        return datetime.utcnow() > self.expires_at


class Artist(db.Model):
    __tablename__ = 'artists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    image_url = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 改进关系定义
    albums = db.relationship('Album', back_populates='artist', lazy='dynamic')
    songs = db.relationship('Song',
                            secondary=song_artists,
                            back_populates='artists',
                            lazy='dynamic')

    def __repr__(self):
        return f'<Artist {self.name}>'


class Album(db.Model):
    __tablename__ = 'albums'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    artist_id = db.Column(db.Integer, db.ForeignKey('artists.id'), nullable=False)
    release_year = db.Column(db.Integer)
    cover_image_path = db.Column(db.String(255))
    local_cover_path = db.Column(db.String(255))  # 新增本地存储路径
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 改进关系定义
    artist = db.relationship('Artist', back_populates='albums')
    songs = db.relationship('Song', back_populates='album', lazy='dynamic')

    def __repr__(self):
        return f'<Album {self.name}>'


class Song(db.Model):
    __tablename__ = 'songs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    album_id = db.Column(db.Integer, db.ForeignKey('albums.id'))
    duration = db.Column(db.Integer)  # 歌曲时长（秒）
    image_url = db.Column(db.String(255))
    local_image_path = db.Column(db.String(255))  # 本地图片存储路径
    file_path = db.Column(db.String(255))  # 新增：MP3文件存储路径
    file_size = db.Column(db.Integer)  # 新增：文件大小
    download_count = db.Column(db.Integer, default=0)  # 新增：下载计数
    lyrics = db.Column(JSON)  # 使用 MySQL 的 JSON 类型
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系定义
    artists = db.relationship('Artist',
                            secondary=song_artists,
                            back_populates='songs',
                            lazy='joined')
    album = db.relationship('Album', back_populates='songs')
    downloads = db.relationship('Download', back_populates='song', lazy='dynamic')

    def __repr__(self):
        return f'<Song {self.name}>'

    @property
    def artist_names(self):
        """获取所有艺术家名字的列表"""
        return [artist.name for artist in self.artists]

    @property
    def primary_artist(self):
        """获取主要艺术家（通常是第一个）"""
        return self.artists[0] if self.artists else None

    def increment_download_count(self):
        """增加下载计数"""
        self.download_count += 1
        db.session.commit()

    def get_file_path(self):
        """获取文件的相对路径（用于URL生成）"""
        if self.file_path:
            return self.file_path.replace('app/static/', '')
        return None

    # 保留原有的歌词相关方法...
    @property
    def lyrics_dict(self):
        """获取歌词数据"""
        return self.lyrics if self.lyrics is not None else None

    @lyrics_dict.setter
    def lyrics_dict(self, value):
        """设置歌词数据"""
        self.lyrics = value


class Download(db.Model):
    __tablename__ = 'downloads'
    id = db.Column(db.Integer, primary_key=True)
    song_id = db.Column(db.Integer, db.ForeignKey('songs.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    download_time = db.Column(db.DateTime, default=datetime.utcnow)
    source_url = db.Column(db.String(255))
    status = db.Column(db.String(20), default='pending')  # 新增状态字段

    song = db.relationship('Song', back_populates='downloads')
    user = db.relationship('User', back_populates='downloads')

    def __repr__(self):
        return f'<Download {self.id}>'