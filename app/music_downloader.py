# app/music_downloader.py

import hashlib
import os
import time
import requests
import re
import json
import logging
from typing import Tuple, Optional, List, Any
from app.models import Artist, Album, Song
from app import db
from flask import current_app

# 配置 logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def calculate_md5(data: str) -> str:
    return hashlib.md5(data.encode('utf-8')).hexdigest()

def generate_signature(timestamp: int, key: str, params: list) -> str:
    signature_list = [key] + params + [key]
    return calculate_md5("".join(signature_list))

def MD5_sign(timestamp: int, audio_id: str) -> str:
    params = [
        "appid=1014",
        f"clienttime={timestamp}",
        "clientver=20000",
        "dfid=3ewLD22PAhYA49Ohz53I5AJu",
        f"encode_album_audio_id={audio_id}",
        "mid=08e20c779ea827a1cc5cc3995b71f48e",
        "platid=4",
        "srcappid=2919",
        "token=9db06ee5df6575d2c567548362cb837a59efe69df6a4c7a08956789dac7af3bc",
        "userid=1188922775",
        "uuid=08e20c779ea827a1cc5cc3995b71f48e",
]
    return generate_signature(timestamp, 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt', params)

def MD5_sign_login(timestamp: int, audio_id: str) -> str:
    params = ['appid=1014',
              f'clienttime={timestamp}',
              'clientver=20000',
              'dfid=3ewLD22PAhYA49Ohz53I5AJu',
              f'encode_album_audio_id={audio_id}',
              'mid=08e20c779ea827a1cc5cc3995b71f48e',
              'platid=4',
              'srcappid=2919',
              'token=9db06ee5df6575d2c567548362cb837a59efe69df6a4c7a08956789dac7af3bc',
              'userid=1188922775',
              'uuid=08e20c779ea827a1cc5cc3995b71f48e']
    return generate_signature(timestamp, 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt', params)

def MD5_sign_search(timestamp: int, music_name: str) -> str:
    params =[
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
        "token=9db06ee5df6575d2c567548362cb837a59efe69df6a4c7a08956789dac7af3bc",
        "userid=1188922775",
        "uuid=08e20c779ea827a1cc5cc3995b71f48e",
    ]
    return generate_signature(timestamp, 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt', params)

def fetch_url(audio_id: str) -> Optional[str]:
    timestamp = int(time.time() * 1000)
    headers = {
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
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
        "token": "9db06ee5df6575d2c567548362cb837a59efe69df6a4c7a08956789dac7af3bc",
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

def audio_id_list(music_name: str) -> tuple[list[Any], list[Any]] | None:
    timestamp = int(time.time() * 1000)
    headers = {
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
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
    "token": "9db06ee5df6575d2c567548362cb837a59efe69df6a4c7a08956789dac7af3bc",
    "userid": "1188922775",
    "uuid": "08e20c779ea827a1cc5cc3995b71f48e",
    "signature":sign,
}

    try:
        response = requests.get('https://complexsearch.kugou.com/v2/search/song', headers=headers, params=params_dict)
        response.raise_for_status()
        callback_dict = re.findall('callback123\((.*)\)', response.text)[0]
        jsurl = json.loads(callback_dict)
        print(jsurl)
        fileNames = [item['FileName'] for item in jsurl['data']['lists'][0:8]]
        # eMixSongID = jsurl['data']['lists'][0:10]['EMixSongID']
        eMixSongIDs = [item['EMixSongID'] for item in jsurl['data']['lists'][0:8]]
        return fileNames, eMixSongIDs
    except (requests.RequestException, json.JSONDecodeError, IndexError) as e:
        logger.error(f"获取音乐ID失败: {e}")
        return None

def images_download(audio_id: str) -> Optional[requests.Response]:
    timestamp = int(time.time() * 1000)
    headers = {
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
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
        "token": "9db06ee5df6575d2c567548362cb837a59efe69df6a4c7a08956789dac7af3bc",
        "userid": "1188922775",
        "uuid": "08e20c779ea827a1cc5cc3995b71f48e",
        "signature": MD5_sign(timestamp, audio_id)
    }
    try:
        response = requests.get('https://wwwapi.kugou.com/play/songinfo', params=params_dict, headers=headers)
        response.raise_for_status()
        logger.info(f'获取歌曲信息成功: {response.json()}')
        return response
    except requests.RequestException as e:
        logger.error(f"获取歌曲信息失败: {e}")
        return None

def song_informationsdownload(response: requests.Response) -> Optional[Song]:
    try:
        content = response.json()['data']
        name = content['audio_name']
        duration = int(int(content['timelength']) / 1000)
        images_url = content['img']
        album_name = content.get('album_name', 'Unknown Album')
        artist_name = content.get('author_name', 'Unknown Artist')
        lyrics = content.get('lyrics', None)  # 获取歌词

        # 检查艺术家是否存在，如果不存在则创建
        artist = Artist.query.filter_by(name=artist_name).first()
        if not artist:
            artist = Artist(name=artist_name, image_url=images_url)
            db.session.add(artist)
            db.session.flush()

        # 检查专辑是否存在，如果不存在则创建
        album = Album.query.filter_by(name=album_name, artist_id=artist.id).first()
        if not album:
            album = Album(name=album_name, artist_id=artist.id, cover_image_path=images_url)
            db.session.add(album)
            db.session.flush()

        # 创建或更新歌曲信息
        song = Song.query.filter_by(name=name, artist_id=artist.id).first()
        if not song:
            song = Song(name=name, artist_id=artist.id, album_id=album.id, duration=duration, image_url=images_url, lyrics=lyrics)
            db.session.add(song)
        else:
            song.duration = duration
            song.image_url = images_url
            song.album_id = album.id
            song.lyrics = lyrics  # 更新歌词

        db.session.commit()
        logger.info(f'歌曲信息已保存到数据库: {name}')

        try:
            response = requests.get(images_url)
            music_images = 'app/static/music_images/' + str(name) + '.jpg'
            with open(music_images, 'wb') as f:
                f.write(response.content)
        except Exception as e:
            logger.error(e)

        return song
    except Exception as e:
        logger.error(f'保存歌曲信息到数据库时发生错误: {e}')
        db.session.rollback()
        return None


def download_url(file_name: str, url_mp3: str, song: Song) -> Optional[str]:
    try:

        response = requests.get(url_mp3, stream=True)
        response.raise_for_status()

        upload_folder = 'app/static/songs/'
        os.makedirs(upload_folder, exist_ok=True)

        file_path = os.path.join(upload_folder, f"{file_name}.mp3")

        with open(file_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        # 更新数据库中的文件路径
        song.file_path = file_path
        db.session.commit()

        logger.info(f'{file_name} - 下载成功，文件路径已更新到数据库')
        return file_path
    except requests.RequestException as e:
        logger.error(f"下载失败: {e}")
        return None

def download_song(music_name: str) -> Tuple[bool, str]:
    '''
    下载song的mp3文件
    更新后的audio_id_list
    return fileNames, eMixSongIDs 均为列表 名字跟id 是一一对应的
    选eMixSongIDs[0] 则是选择与搜索结果最匹配那个

    '''
    try:

        audio_id = audio_id_list(music_name)
        if audio_id is None:
            return False, "未找到该歌曲"

        file_name, emixsong_id = audio_id
        logger.info(f"找到歌曲: {file_name}")

        file_name = file_name[0]
        emixsong_id = emixsong_id[0]
        response = images_download(emixsong_id)

        if response:
            song = song_informationsdownload(response)
            if not song:
                return False, "保存歌曲信息失败"
        else:
            return False, "获取歌曲信息失败"

        time.sleep(2)  # 稍作延迟，避免频繁请求

        url_mp3 = fetch_url(emixsong_id)
        if url_mp3 is None:
            return False, "获取下载链接失败"

        result = download_url(file_name, url_mp3, song)
        if result:
            return True, f"文件已保存至: {result}"
        else:
            return False, "下载失败"

    except Exception as e:
        logger.exception(f"发生未预期的错误: {e}")
        return False, f"发生错误: {str(e)}"

