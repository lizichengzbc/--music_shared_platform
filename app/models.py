import re
from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# 创建艺术家和歌曲的多对多关系表
song_artists = db.Table('song_artists',
                        db.Column('song_id', db.Integer, db.ForeignKey('songs.id'), primary_key=True),
                        db.Column('artist_id', db.Integer, db.ForeignKey('artists.id'), primary_key=True),
                        db.Column('created_at', db.DateTime, default=datetime.utcnow)
                        )
# 添加用户收藏歌曲关联表
user_favorites = db.Table('user_favorites',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('song_id', db.Integer, db.ForeignKey('songs.id'), primary_key=True),
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
    # 添加收藏歌曲关系
    favorite_songs = db.relationship('Song',
                                     secondary=user_favorites,
                                     lazy='dynamic',
                                     backref=db.backref('favorited_by', lazy='dynamic'))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

    def like_song(self, song):
        """添加歌曲到收藏"""
        if not self.has_liked_song(song):
            self.favorite_songs.append(song)
            song.likes_count += 1
            db.session.commit()

    def unlike_song(self, song):
        """取消收藏歌曲"""
        if self.has_liked_song(song):
            self.favorite_songs.remove(song)
            song.likes_count = max(0, song.likes_count - 1)  # 确保不会小于0
            db.session.commit()

    def has_liked_song(self, song):
        """检查是否已收藏某首歌"""
        return self.favorite_songs.filter_by(id=song.id).first() is not None

    def get_favorite_songs(self, page=1, per_page=20):
        """获取用户收藏的歌曲（分页）"""
        return self.favorite_songs.order_by(user_favorites.c.created_at.desc()) \
            .paginate(page=page, per_page=per_page)

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
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, index=True)
    album_id = Column(Integer, ForeignKey('albums.id'))
    duration = Column(Integer)
    image_url = Column(String(255))
    local_image_path = Column(String(255))
    file_path = Column(String(255))
    file_size = Column(Integer)
    download_count = Column(Integer, default=0)
    lyrics = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    artists = relationship('Artist', secondary=song_artists, back_populates='songs', lazy='joined')
    album = relationship('Album', back_populates='songs')
    downloads = relationship('Download', back_populates='song', lazy='dynamic')
    likes_count = Column(Integer, default=0,nullable=False)


    def __repr__(self):
        return f'<Song {self.name}>'

    def parse_lyrics(self, lyrics_str):
        """解析歌词字符串，包含元数据和时间戳歌词"""
        lines = lyrics_str.strip().split('\r\n')
        metadata = {}
        lyrics_dict = {}

        for line in lines:
            # 解析元数据行 (以[开头但不含时间戳的行)
            if line.startswith('[') and not re.match(r'\[\d{2}:', line):
                meta_match = re.match(r'\[(\w+):([^]]+)]', line)
                if meta_match:
                    key, value = meta_match.groups()
                    metadata[key] = value.strip()
                continue

            # 解析带时间戳的歌词行
            timestamp_matches = re.finditer(r'\[(\d{2}):(\d{2}\.\d{2})\]', line)
            lyric_text = re.sub(r'\[\d{2}:\d{2}\.\d{2}\]', '', line).strip()

            # 一行可能有多个时间戳
            for match in timestamp_matches:
                minutes = int(match.group(1))
                seconds = float(match.group(2))
                timestamp = f"{minutes:02d}:{seconds:05.2f}"

                if lyric_text:  # 只存储非空歌词
                    lyrics_dict[timestamp] = lyric_text

        # 存储完整的歌词数据结构
        self.lyrics = {
            'metadata': metadata,
            'lyrics': lyrics_dict
        }

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

    @property
    def lyrics_dict(self):
        """获取格式化的歌词数据，包含元数据和按时间排序的歌词"""
        if not self.lyrics:
            return {'metadata': {}, 'lyrics': {}}

        lyrics_data = self.lyrics.get('lyrics', {})
        return {
            'metadata': self.lyrics.get('metadata', {}),
            'lyrics': dict(sorted(lyrics_data.items(), key=lambda x: self.timestamp_to_seconds(x[0])))
        }

    @staticmethod
    def timestamp_to_seconds(timestamp):
        """将时间戳字符串转换为秒数"""
        minutes, seconds = timestamp.split(':')
        return int(minutes) * 60 + float(seconds)

    @property
    def to_dict(self):
        """返回歌曲的字典表示，包含收藏数"""
        return {
            'id': self.id,
            'name': self.name,
            'artist': self.artist_names,
            'album': self.album.name if self.album else None,
            'duration': self.duration,
            'image_url': self.image_url,
            'likes_count': self.likes_count,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def get_like_status(self, user):
        """获取指定用户的收藏状态"""
        if not user.is_authenticated:
            return False
        return user.has_liked_song(self)

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