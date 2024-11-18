"""update song likes_count

Revision ID: e8aaa76f94f5
Revises: 9a151e25287f
Create Date: 2024-11-12 20:21:47.912568

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'e8aaa76f94f5'
down_revision = '9a151e25287f'
branch_labels = None
depends_on = None


def upgrade():
    # 首先更新现有的NULL值为0
    op.execute('UPDATE songs SET likes_count = 0 WHERE likes_count IS NULL')

    # 然后修改列属性
    with op.batch_alter_table('songs') as batch_op:
        batch_op.alter_column('likes_count',
                              existing_type=sa.Integer(),
                              nullable=False,
                              server_default='0')


def downgrade():
    with op.batch_alter_table('songs') as batch_op:
        batch_op.alter_column('likes_count',
                              existing_type=sa.Integer(),
                              nullable=True,
                              server_default=None)
