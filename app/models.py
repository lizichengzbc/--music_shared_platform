import re
from sqlalchemy.dialects.mysql import JSON
from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

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

class Comment(db.Model):
    __tablename__ = 'comments'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('comments', lazy=True))

class Artist(db.Model):
    __tablename__ = 'artists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    image_url = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Artist {self.name}>'

class Album(db.Model):
    __tablename__ = 'albums'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    artist_id = db.Column(db.Integer, db.ForeignKey('artists.id'), nullable=False)
    release_year = db.Column(db.Integer)
    cover_image_path = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    artist = db.relationship('Artist', backref=db.backref('albums', lazy=True))

    def __repr__(self):
        return f'<Album {self.name}>'


class Song(db.Model):
    __tablename__ = 'songs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    artist_id = db.Column(db.Integer, db.ForeignKey('artists.id'), nullable=False)
    album_id = db.Column(db.Integer, db.ForeignKey('albums.id'))
    duration = db.Column(db.Integer)  # 歌曲时长（秒）
    image_url = db.Column(db.String(255))
    lyrics = db.Column(JSON)  # 使用 MySQL 的 JSON 类型
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    artist = db.relationship('Artist', backref=db.backref('songs', lazy=True))
    album = db.relationship('Album', backref=db.backref('songs', lazy=True))

    def __repr__(self):
        return f'<Song {self.name}>'

    @property
    def lyrics_dict(self):
        """获取歌词数据"""
        return self.lyrics if self.lyrics is not None else None

    @lyrics_dict.setter
    def lyrics_dict(self, value):
        """设置歌词数据"""
        self.lyrics = value

    @staticmethod
    def parse_krc_time(time_str):
        """解析KRC时间戳为秒数"""
        try:
            minutes, seconds = time_str.split(':')
            return float(minutes) * 60 + float(seconds)
        except:
            return 0.0

    def import_krc_lyrics(self, krc_content):
        """导入KRC格式的歌词"""
        # 初始化歌词数据结构
        lyrics_data = {
            "metadata": {},
            "lyrics": []
        }

        # 解析元数据和歌词行
        lines = krc_content.strip().split('\n')
        current_time = 0.0

        for line in lines:
            # 处理元数据（方括号内的信息）
            meta_match = re.match(r'\[(.*?):(.*?)\]', line)
            if meta_match and not re.match(r'\[\d{2}:', line):
                key, value = meta_match.groups()
                lyrics_data["metadata"][key] = value.strip()
                continue

            # 处理带时间戳的歌词行
            time_match = re.match(r'\[(\d{2}:\d{2}\.\d{2})\](.*)', line)
            if time_match:
                timestamp, text = time_match.groups()
                time_seconds = self.parse_krc_time(timestamp)

                lyrics_line = {
                    "timestamp": time_seconds,
                    "text": text.strip(),
                    "duration": 0  # 将在下一步计算
                }

                lyrics_data["lyrics"].append(lyrics_line)

        # 计算每行歌词的持续时间
        sorted_lyrics = sorted(lyrics_data["lyrics"], key=lambda x: x["timestamp"])
        for i in range(len(sorted_lyrics) - 1):
            sorted_lyrics[i]["duration"] = sorted_lyrics[i + 1]["timestamp"] - sorted_lyrics[i]["timestamp"]

        # 最后一行歌词持续时间设为默认值
        if sorted_lyrics:
            sorted_lyrics[-1]["duration"] = 5.0

        # 更新数据库字段
        self.lyrics_dict = lyrics_data
        return lyrics_data

    def get_lyrics_at_time(self, current_time):
        """获取指定时间点应显示的歌词"""
        lyrics_data = self.lyrics_dict
        if not lyrics_data or "lyrics" not in lyrics_data:
            return None

        current_line = None
        next_line = None

        for i, line in enumerate(lyrics_data["lyrics"]):
            if line["timestamp"] <= current_time < (line["timestamp"] + line["duration"]):
                current_line = line
                if i + 1 < len(lyrics_data["lyrics"]):
                    next_line = lyrics_data["lyrics"][i + 1]
                break

        return {
            "current": current_line,
            "next": next_line
        }

    def get_metadata(self):
        """获取歌词元数据"""
        lyrics_data = self.lyrics_dict
        return lyrics_data.get("metadata", {}) if lyrics_data else {}

class Download(db.Model):
    __tablename__ = 'downloads'
    id = db.Column(db.Integer, primary_key=True)
    song_id = db.Column(db.Integer, db.ForeignKey('songs.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    download_time = db.Column(db.DateTime, default=datetime.utcnow)
    source_url = db.Column(db.String(255))

    song = db.relationship('Song', backref=db.backref('downloads', lazy=True))
    user = db.relationship('User', backref=db.backref('downloads', lazy=True))

    def __repr__(self):
        return f'<Download {self.id}>'
