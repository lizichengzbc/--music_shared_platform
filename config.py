import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    DEBUG = True
    SECRET_KEY = 'lizicheng'  # 建议使用一个复杂的随机字符串
    SQLALCHEMY_DATABASE_URI = 'mysql://root:asd357896214@localhost/jj20_music_sharing'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MAIL_SERVER = 'smtp.qq.com'
    MAIL_PORT = 465
    MAIL_USE_SSL = True
    MAIL_USE_TLS = False
    MAIL_USERNAME = '2471569585@qq.com'  # 替换为您的QQ邮箱
    MAIL_PASSWORD = 'dplgpbucymmqdigb'  # 替换为您的QQ邮箱授权码
    MAIL_DEFAULT_SENDER = ('JJ20音乐分享', '2471569585@qq.com')  # 替换为您的QQ邮箱

    UPLOAD_FOLDER = os.path.join(basedir, 'app', 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max-limit
    # ... 其他配置 ...