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

    UPLOAD_FOLDER = os.path.join(basedir, 'app', 'static')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max-limit
    # ... 其他配置 ...

    # Redis 配置
    REDIS_HOST = 'localhost'  # Redis 服务器地址
    REDIS_PORT = 6379  # Redis 端口
    REDIS_DB = 0  # Redis 数据库编号

    # 速率限制配置
    RATE_LIMIT_DEFAULT_LIMIT = 5  # 默认限制次数
    RATE_LIMIT_DEFAULT_PERIOD = 60  # 默认限制时间（秒）

    # 验证码配置
    VERIFICATION_CODE_EXPIRE = 300  # 验证码过期时间（秒）
    VERIFICATION_CODE_LENGTH = 6  # 验证码长度
    VERIFICATION_SEND_LIMIT = 60  # 验证码发送间隔（秒）

    # 登录配置
    LOGIN_ATTEMPT_LIMIT = 5  # 登录尝试次数限制
    LOGIN_ATTEMPT_WINDOW = 300  # 登录尝试窗口期（秒）
    ACCOUNT_LOCK_DURATION = 1800  # 账户锁定时长（秒）

    # 会话配置
    SESSION_TYPE = 'redis'  # 使用 Redis 存储会话
    PERMANENT_SESSION_LIFETIME = 3600  # 会话生命周期（秒）