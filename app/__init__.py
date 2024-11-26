from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_mail import Mail
from config import Config
import os
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from .utils.redis_client import RedisClient

db = SQLAlchemy()
migrate = Migrate()
mail = Mail()
login_manager = LoginManager()
redis_client = RedisClient()
csrf = CSRFProtect()  # 移到这里


def create_app(config_class=Config, debug=False):
    app = Flask(__name__)
    app.config.from_object(config_class)

    csrf.init_app(app)
    redis_client.init_app(app)

    app.debug = debug

    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)
    login_manager.init_app(app)

    login_manager.login_view = 'main.login'

    @login_manager.user_loader
    def load_user(user_id):
        from app.models import User
        return User.query.get(int(user_id))

    if 'UPLOAD_FOLDER' in app.config and not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])

    from app.routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    with app.app_context():
        db.create_all()

    return app