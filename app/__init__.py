from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_mail import Mail
from config import Config
import os
from flask_login import LoginManager

db = SQLAlchemy()
migrate = Migrate()
mail = Mail()
login_manager = LoginManager()


def create_app(config_class=Config, debug=False):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 设置debug模式
    app.debug = debug

    # 初始化各个扩展
    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)
    login_manager.init_app(app)

    login_manager.login_view = 'main.login'

    @login_manager.user_loader
    def load_user(user_id):
        from app.models import User
        return User.query.get(int(user_id))

    # 确保上传文件夹存在
    if 'UPLOAD_FOLDER' in app.config and not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])

    # 注册蓝图
    from app.routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    # 创建数据库表
    with app.app_context():
        db.create_all()

    return app