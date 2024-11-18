from dotenv import load_dotenv
import os
from admin import init_admin

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

from app import create_app, db

app = create_app()

# 配置 Flask-Admin
app.config['FLASK_ADMIN_SWATCH'] = 'cerulean'
app.config['FLASK_ADMIN_FLUID_LAYOUT'] = True

# 只传入 app 参数
admin = init_admin(app)  # 移除 db 参数

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.config['DEBUG'] = True
    app.run()