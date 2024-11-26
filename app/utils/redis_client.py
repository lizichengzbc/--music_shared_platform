# utils/redis_client.py
from flask import current_app
import redis
from functools import wraps
import time


class RedisClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisClient, cls).__new__(cls)
            cls._instance.client = None
        return cls._instance

    def init_app(self, app):
        """初始化 Redis 客户端"""
        try:
            self.client = redis.Redis(
                host=app.config['REDIS_HOST'],
                port=app.config['REDIS_PORT'],
                db=app.config['REDIS_DB'],
                decode_responses=True  # 自动将字节解码为字符串
            )
            # 测试连接
            self.client.ping()
            print("Redis connection successful")
        except redis.ConnectionError as e:
            print(f"Redis connection failed: {e}")
            self.client = None

    def get_client(self):
        """获取 Redis 客户端实例"""
        if self.client is None:
            raise Exception("Redis client not initialized")
        return self.client


class RateLimit:
    """速率限制装饰器"""

    def __init__(self, key_prefix, limit=5, period=60):
        self.key_prefix = key_prefix
        self.limit = limit
        self.period = period
        self.redis_client = RedisClient()

    def __call__(self, f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                client = self.redis_client.get_client()
                key = f"{self.key_prefix}:{time.time() // self.period}"

                # 使用管道来保证操作的原子性
                pipe = client.pipeline()
                pipe.incr(key)
                pipe.expire(key, self.period)
                current_requests = pipe.execute()[0]

                if current_requests > self.limit:
                    return {'error': '请求过于频繁，请稍后再试'}, 429

                return f(*args, **kwargs)
            except Exception as e:
                print(f"Rate limit error: {e}")
                # 如果 Redis 出错，允许请求通过
                return f(*args, **kwargs)

        return decorated_function


# Redis 键的前缀常量
class RedisKeys:
    # 验证码相关
    VERIFICATION_CODE = "verification_code:{email}:{purpose}"  # 验证码存储
    VERIFICATION_SEND_LIMIT = "verification_send_limit:{email}"  # 发送频率限制

    # 登录相关
    LOGIN_ATTEMPTS = "login_attempts:{ip}"  # 登录尝试次数
    LOGIN_FAILURES = "login_failures:{email}"  # 登录失败次数
    ACCOUNT_LOCK = "account_lock:{email}"  # 账户锁定状态

    # 会话相关
    USER_SESSIONS = "user_sessions:{user_id}"  # 用户会话记录

    @staticmethod
    def get_verification_code_key(email, purpose='login'):
        return RedisKeys.VERIFICATION_CODE.format(email=email, purpose=purpose)

    @staticmethod
    def get_verification_send_limit_key(email):
        return RedisKeys.VERIFICATION_SEND_LIMIT.format(email=email)

    @staticmethod
    def get_login_attempts_key(ip):
        return RedisKeys.LOGIN_ATTEMPTS.format(ip=ip)

    @staticmethod
    def get_login_failures_key(email):
        return RedisKeys.LOGIN_FAILURES.format(email=email)

    @staticmethod
    def get_account_lock_key(email):
        return RedisKeys.ACCOUNT_LOCK.format(email=email)

    @staticmethod
    def get_user_sessions_key(user_id):
        return RedisKeys.USER_SESSIONS.format(user_id=user_id)


# Redis 助手类，提供常用的操作方法
class RedisHelper:
    def __init__(self):
        self.redis_client = RedisClient()

    def set_verification_code(self, email, code, purpose='login', expire=300):
        """设置验证码，默认5分钟过期"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_verification_code_key(email, purpose)
        client.setex(key, expire, code)

    def get_verification_code(self, email, purpose='login'):
        """获取验证码"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_verification_code_key(email, purpose)
        return client.get(key)

    def check_send_limit(self, email, limit_seconds=60):
        """检查发送频率限制"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_verification_send_limit_key(email)
        return client.get(key) is not None

    def set_send_limit(self, email, limit_seconds=60):
        """设置发送频率限制"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_verification_send_limit_key(email)
        client.setex(key, limit_seconds, '1')

    def increment_login_attempts(self, ip, window=300):
        """增加登录尝试次数"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_login_attempts_key(ip)
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        return pipe.execute()[0]

    def increment_login_failures(self, email, window=3600):
        """增加登录失败次数"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_login_failures_key(email)
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        return pipe.execute()[0]

    def lock_account(self, email, duration=1800):
        """锁定账户"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_account_lock_key(email)
        client.setex(key, duration, '1')

    def is_account_locked(self, email):
        """检查账户是否被锁定"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_account_lock_key(email)
        return client.get(key) is not None

    def clear_login_failures(self, email):
        """清除登录失败记录"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_login_failures_key(email)
        client.delete(key)

    def record_user_session(self, user_id, session_id):
        """记录用户会话"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_user_sessions_key(user_id)
        client.sadd(key, session_id)

    def remove_user_session(self, user_id, session_id):
        """移除用户会话"""
        client = self.redis_client.get_client()
        key = RedisKeys.get_user_sessions_key(user_id)
        client.srem(key, session_id)

    def clear_user_sessions(self, id):
        pass