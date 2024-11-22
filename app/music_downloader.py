# app/music_downloader.py

import hashlib
import os
import time
import requests
import re
import json
import logging
from typing import Tuple, Optional, List, Any
from app.models import Artist, Album, Song, Download
from app import db
from flask import current_app
from pathlib import Path
from sqlalchemy.exc import SQLAlchemyError

# 配置 logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def calculate_md5(data: str) -> str:
    """计算字符串的MD5值"""
    return hashlib.md5(data.encode('utf-8')).hexdigest()


def generate_signature(timestamp: int, key: str, params: list) -> str:
    """生成API签名"""
    signature_list = [key] + params + [key]
    return calculate_md5("".join(signature_list))


def MD5_sign(timestamp: int, audio_id: str) -> str:
    """生成歌曲信息API的签名"""
    params = [
        "appid=1014",
        f"clienttime={timestamp}",
        "clientver=20000",
        "dfid=3ewLD22PAhYA49Ohz53I5AJu",
        f"encode_album_audio_id={audio_id}",
        "mid=08e20c779ea827a1cc5cc3995b71f48e",
        "platid=4",
        "srcappid=2919",
        "token=9db06ee5df6575d2c567548362cb837a6fad024d031d30505f2130447be39d06",
        "userid=1188922775",
        "uuid=08e20c779ea827a1cc5cc3995b71f48e",
    ]
    return generate_signature(timestamp, 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt', params)


def MD5_sign_search(timestamp: int, music_name: str) -> str:
    """生成搜索API的签名"""
    params = [
        "appid=1014",
        "bitrate=0",
        "callback=callback123",
        f"clienttime={timestamp}",
        "clientver=1000",
        "dfid=3ewLD22PAhYA49Ohz53I5AJu",
        "filter=10",
        "inputtype=0",
        "iscorrection=1",
        "isfuzzy=0",
        f"keyword={music_name}",
        "mid=08e20c779ea827a1cc5cc3995b71f48e",
        "page=1",
        "pagesize=30",
        "platform=WebFilter",
        "privilege_filter=0",
        "srcappid=2919",
        "token=9db06ee5df6575d2c567548362cb837a6fad024d031d30505f2130447be39d06",
        "userid=1188922775",
        "uuid=08e20c779ea827a1cc5cc3995b71f48e",
    ]
    return generate_signature(timestamp, 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt', params)


def fetch_url(audio_id: str) -> Optional[str]:
    """获取音乐下载URL"""
    timestamp = int(time.time() * 1000)
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    }
    params_dict = {
        "appid": "1014",
        "clienttime": timestamp,
        "clientver": "20000",
        "dfid": "3ewLD22PAhYA49Ohz53I5AJu",
        "encode_album_audio_id": audio_id,
        "mid": "08e20c779ea827a1cc5cc3995b71f48e",
        "platid": "4",
        "srcappid": "2919",
        "token": "9db06ee5df6575d2c567548362cb837a6fad024d031d30505f2130447be39d06",
        "userid": "1188922775",
        "uuid": "08e20c779ea827a1cc5cc3995b71f48e",
        "signature": MD5_sign(timestamp, audio_id),
    }

    try:
        response = requests.get('https://wwwapi.kugou.com/play/songinfo', headers=headers, params=params_dict)
        response.raise_for_status()
        jsurl = response.json()
        return jsurl['data']['play_url']
    except requests.RequestException as e:
        logger.error(f"获取音乐URL失败: {e}")
        return None


def audio_id_list(music_name: str) -> Optional[Tuple[List[str], List[str]]]:
    """
    搜索歌曲并返回文件名和ID列表

    Args:
        music_name: 要搜索的歌曲名称

    Returns:
        Optional[Tuple[List[str], List[str]]]: 返回(文件名列表, ID列表)或None
    """
    timestamp = int(time.time() * 1000)
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    }
    sign = MD5_sign_search(timestamp, music_name)
    params_dict = {
        "appid": "1014",
        "bitrate": "0",
        "callback": "callback123",
        "clienttime": timestamp,
        "clientver": "1000",
        "dfid": "3ewLD22PAhYA49Ohz53I5AJu",
        "filter": "10",
        "inputtype": "0",
        "iscorrection": "1",
        "isfuzzy": "0",
        "keyword": music_name,
        "mid": "08e20c779ea827a1cc5cc3995b71f48e",
        "page": "1",
        "pagesize": "30",
        "platform": "WebFilter",
        "privilege_filter": "0",
        "srcappid": "2919",
        "token": "9db06ee5df6575d2c567548362cb837a6fad024d031d30505f2130447be39d06",
        "userid": "1188922775",
        "uuid": "08e20c779ea827a1cc5cc3995b71f48e",
        "signature": sign,
    }

    try:
        response = requests.get('https://complexsearch.kugou.com/v2/search/song',
                                headers=headers,
                                params=params_dict)
        response.raise_for_status()
        callback_dict = re.findall('callback123\((.*)\)', response.text)[0]
        jsurl = json.loads(callback_dict)

        fileNames = [item['FileName'] for item in jsurl['data']['lists'][0:8]]
        eMixSongIDs = [item['EMixSongID'] for item in jsurl['data']['lists'][0:8]]
        return fileNames, eMixSongIDs

    except (requests.RequestException, json.JSONDecodeError, IndexError) as e:
        logger.error(f"获取音乐ID失败: {e}")
        return None


def images_download(audio_id: str) -> Optional[requests.Response]:
    """获取歌曲详细信息"""
    timestamp = int(time.time() * 1000)
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    }
    params_dict = {
        "appid": "1014",
        "clienttime": timestamp,
        "clientver": "20000",
        "dfid": "3ewLD22PAhYA49Ohz53I5AJu",
        "encode_album_audio_id": audio_id,
        "mid": "08e20c779ea827a1cc5cc3995b71f48e",
        "platid": "4",
        "srcappid": "2919",
        "token": "9db06ee5df6575d2c567548362cb837a6fad024d031d30505f2130447be39d06",
        "userid": "1188922775",
        "uuid": "08e20c779ea827a1cc5cc3995b71f48e",
        "signature": MD5_sign(timestamp, audio_id)
    }
    try:
        response = requests.get('https://wwwapi.kugou.com/play/songinfo',
                                params=params_dict,
                                headers=headers)
        response.raise_for_status()
        return response
    except requests.RequestException as e:
        logger.error(f"获取歌曲信息失败: {e}")
        return None


def save_image(url: str, name: str) -> Optional[str]:
    """
    下载并保存图片

    Args:
        url: 图片URL
        name: 文件名（不包含扩展名）

    Returns:
        Optional[str]: 成功则返回相对于static目录的路径，失败返回None
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        image_dir = Path('app/static/music_images')
        image_dir.mkdir(parents=True, exist_ok=True)

        # 清理文件名中的非法字符
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        image_path = image_dir / f'{safe_name}.jpg'
        image_path.write_bytes(response.content)

        return str(image_path.relative_to('app/static'))

    except Exception as e:
        logger.error(f'保存图片失败: {url}, 错误: {e}')
        return None


def song_information_download(response: requests.Response) -> Optional[Song]:
    """
    从API响应下载并保存歌曲信息到数据库

    Args:
        response: API的响应对象

    Returns:
        Optional[Song]: 成功则返回歌曲对象，失败返回None
    """
    if not response.ok:
        logger.error(f'API 请求失败: {response.status_code}')
        return None

    try:
        content = response.json().get('data')
        if not content:
            logger.error('响应中没有数据字段')
            return None

        # 提取基本信息
        name = content.get('audio_name')
        if not name:
            logger.error('未找到歌曲名称')
            return None

        duration = int(int(content.get('timelength', 0)) / 1000)
        images_url = content.get('img')
        album_name = content.get('album_name', 'Unknown Album')
        artist_names = [name.strip() for name in content.get('author_name', 'Unknown Artist').split('、')]
        lyrics = content.get('lyrics')

        try:
            # 处理艺术家
            artists = []
            for artist_name in artist_names:
                artist = Artist.query.filter_by(name=artist_name).first()
                if not artist:
                    artist = Artist(
                        name=artist_name,
                        image_url=images_url if artist_name == artist_names[0] else None
                    )
                    db.session.add(artist)
                artists.append(artist)

            db.session.flush()

            # 处理专辑
            album = Album.query.filter_by(
                name=album_name,
                artist_id=artists[0].id
            ).first()

            if not album:
                album = Album(
                    name=album_name,
                    artist_id=artists[0].id,
                    cover_image_path=images_url
                )
                if images_url:
                    local_cover = save_image(images_url, f'album_{album_name}')
                    if local_cover:
                        album.local_cover_path = local_cover

                db.session.add(album)
                db.session.flush()

            # 处理歌曲
            song = Song.query.filter_by(
                name=name,
                album_id=album.id
            ).first()

            if not song:
                song = Song(
                    name=name,
                    album_id=album.id,
                    duration=duration,
                    image_url=images_url,
                    lyrics=lyrics,
                    download_count=0,
                    file_size=0
                )
                if images_url:
                    local_image = save_image(images_url, f'song_{name}')
                    if local_image:
                        song.local_image_path = local_image

                db.session.add(song)
            else:
                song.duration = duration
                song.image_url = images_url
                song.lyrics = lyrics
                if images_url and not song.local_image_path:
                    local_image = save_image(images_url, f'song_{name}')
                    if local_image:
                        song.local_image_path = local_image

            # 更新艺术家关系
            song.artists = artists

            db.session.commit()
            logger.info(f'歌曲信息已保存到数据库: {name}')
            return song

        except SQLAlchemyError as e:
            logger.error(f'数据库操作失败: {e}')
            db.session.rollback()
            return None

    except Exception as e:
        logger.error(f'处理歌曲信息时发生错误: {e}')
        return None


def download_url(file_name: str, url_mp3: str, song: Song) -> Optional[str]:
    """
    下载MP3文件并更新数据库记录

    Args:
        file_name: 文件名
        url_mp3: 下载链接
        song: Song模型实例

    Returns:
        Optional[str]: 成功返回相对于static目录的路径，失败返回None
    """
    try:
        response = requests.get(url_mp3, stream=True)
        response.raise_for_status()

        # 获取文件大小
        file_size = int(response.headers.get('content-length', 0))

        # 确保目录存在
        upload_folder = Path('app/static/songs')
        upload_folder.mkdir(parents=True, exist_ok=True)

        # 生成安全的文件名
        safe_name = "".join(c for c in file_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        file_path = upload_folder / f"{safe_name}.mp3"

        # 下载文件
        with open(file_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        # 更新数据库中的文件信息
        relative_path = str(file_path.relative_to('app/static'))
        song.file_path = relative_path
        song.file_size = file_size
        db.session.commit()

        logger.info(f'{file_name} - 下载成功，文件路径: {relative_path}')
        return relative_path

    except requests.RequestException as e:
        logger.error(f"下载失败: {e}")
        return None
    except Exception as e:
        logger.error(f"保存文件时发生错误: {e}")
        return None

def download_song(music_name: str, user_id: Optional[int] = None) -> Tuple[bool, str]:
    """
    下载歌曲并记录下载历史

    Args:
        music_name: 歌曲名称
        user_id: 用户ID（可选）

    Returns:
        Tuple[bool, str]: (是否成功, 消息)
    """
    try:
        # 获取歌曲ID列表
        audio_id = audio_id_list(music_name)
        if audio_id is None:
            return False, "未找到该歌曲"

        file_names, emixsong_ids = audio_id
        if not file_names or not emixsong_ids:
            return False, "搜索结果为空"

        file_name = file_names[0]
        emixsong_id = emixsong_ids[0]

        # 获取歌曲信息
        response = images_download(emixsong_id)
        if not response:
            return False, "获取歌曲信息失败"

        # 保存歌曲信息到数据库
        song = song_information_download(response)
        if not song:
            return False, "保存歌曲信息失败"


        # 记录下载历史
        if user_id:
            download = Download(
                song_id=song.id,
                user_id=user_id,
                status='completed',
                source_url=song.file_path
            )
            db.session.add(download)
            song.download_count += 1
            db.session.commit()

            return True, f"歌曲已存在: {song.file_path}"

        # 获取下载链接
        time.sleep(2)  # 避免频繁请求
        url_mp3 = fetch_url(emixsong_id)
        if url_mp3 == '':
            return False, "获取下载链接失败"

        # 下载文件
        result = download_url(file_name, url_mp3, song)
        if not result:
            return False, "下载失败"

        # 更新下载计数并记录下载历史
        if user_id:
            download = Download(
                song_id=song.id,
                user_id=user_id,
                status='completed',
                source_url=url_mp3
            )
            db.session.add(download)
            song.download_count += 1
            db.session.commit()

        return True, f"下载成功: {result}"

    except Exception as e:
        logger.exception(f"下载过程中发生错误: {e}")
        return False, f"发生错误: {str(e)}"

# 实用工具函数
def sanitize_filename(filename: str) -> str:
    """
    清理文件名，移除非法字符

    Args:
        filename: 原始文件名

    Returns:
        str: 清理后的文件名
    """
    return "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_')).rstrip()

def ensure_directories():
    """确保所需的目录结构存在"""
    directories = [
        Path('app/static/songs'),
        Path('app/static/music_images'),
    ]
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

def init_app(app):
    """
    初始化应用配置

    Args:
        app: Flask应用实例
    """
    # 确保目录存在
    ensure_directories()

    # 设置日志级别
    if not app.debug:
        logger.setLevel(logging.INFO)

    # 设置上传文件大小限制
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB