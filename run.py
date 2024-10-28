from dotenv import load_dotenv
import os

# 显式指定 .env 文件路径并加载
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

from app import create_app, db

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.config['DEBUG'] = True
    app.run()
