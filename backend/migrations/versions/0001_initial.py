"""Initial relational schema.

Revision ID: 0001
"""
from alembic import op
import sqlalchemy as sa
revision='0001'
down_revision=None
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('users',sa.Column('id',sa.Integer,primary_key=True),sa.Column('email',sa.String(255),nullable=False,unique=True),sa.Column('name',sa.String(160),nullable=False),sa.Column('password_hash',sa.String(255),nullable=False),sa.Column('role',sa.String(20),nullable=False),sa.Column('active',sa.Boolean,nullable=False),sa.Column('demo',sa.Boolean,nullable=False))
    op.create_index('ix_users_email','users',['email'])
    op.create_table('sessions',sa.Column('id',sa.String(64),primary_key=True),sa.Column('user_id',sa.Integer,sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),sa.Column('expires',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_sessions_user_id','sessions',['user_id'])
    op.create_table('customers',sa.Column('id',sa.Integer,primary_key=True),sa.Column('name',sa.String(160),nullable=False),sa.Column('email',sa.String(255),nullable=False,unique=True),sa.Column('phone',sa.String(40),nullable=False),sa.Column('status',sa.String(20),nullable=False),sa.Column('registered_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_customers_email','customers',['email'])
    op.create_table('tickets',sa.Column('id',sa.Integer,primary_key=True),sa.Column('name',sa.String(100),nullable=False,unique=True),sa.Column('price',sa.Numeric(10,2),nullable=False),sa.Column('active',sa.Boolean,nullable=False),sa.CheckConstraint('price >= 0'))
    op.create_table('bookings',sa.Column('id',sa.Integer,primary_key=True),sa.Column('customer_id',sa.Integer,sa.ForeignKey('customers.id'),nullable=False),sa.Column('ticket_id',sa.Integer,sa.ForeignKey('tickets.id'),nullable=False),sa.Column('booking_date',sa.Date,nullable=False),sa.Column('visit_date',sa.Date,nullable=False),sa.Column('quantity',sa.Integer,nullable=False),sa.Column('price',sa.Numeric(10,2),nullable=False),sa.Column('total',sa.Numeric(12,2),nullable=False),sa.Column('status',sa.String(20),nullable=False),sa.Column('external_id',sa.String(100),unique=True),sa.CheckConstraint('quantity > 0 AND quantity <= 1000'),sa.CheckConstraint('price >= 0'),sa.CheckConstraint("status IN ('confirmed','pending','cancelled')"))
    for col in ['customer_id','ticket_id','booking_date','visit_date','status']:
        op.create_index('ix_bookings_'+col,'bookings',[col])
    op.create_table('waivers',sa.Column('id',sa.Integer,primary_key=True),sa.Column('booking_id',sa.Integer,sa.ForeignKey('bookings.id',ondelete='CASCADE'),nullable=False,unique=True),sa.Column('signed',sa.Boolean,nullable=False),sa.Column('signed_at',sa.DateTime(timezone=True)))
    op.create_table('data_quality_logs',sa.Column('id',sa.Integer,primary_key=True),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('kind',sa.String(30),nullable=False),sa.Column('source',sa.String(255),nullable=False),sa.Column('original',sa.JSON,nullable=False),sa.Column('report',sa.JSON,nullable=False),sa.Column('applied',sa.Boolean,nullable=False))
    op.create_table('integration_logs',sa.Column('id',sa.Integer,primary_key=True),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('integration',sa.String(80),nullable=False),sa.Column('status',sa.String(30),nullable=False),sa.Column('message',sa.String(1000),nullable=False))
    op.create_table('audit_logs',sa.Column('id',sa.Integer,primary_key=True),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('user_id',sa.Integer,sa.ForeignKey('users.id')),sa.Column('action',sa.String(255),nullable=False),sa.Column('details',sa.JSON,nullable=False))
    op.create_table('synchronisation_logs',sa.Column('id',sa.Integer,primary_key=True),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('status',sa.String(30),nullable=False),sa.Column('records',sa.Integer,nullable=False),sa.Column('message',sa.String(1000),nullable=False))
    op.create_table('job_runs',sa.Column('id',sa.Integer,primary_key=True),sa.Column('name',sa.String(80),nullable=False),sa.Column('day',sa.Date,nullable=False),sa.Column('status',sa.String(30),nullable=False),sa.Column('completed_at',sa.DateTime(timezone=True)),sa.UniqueConstraint('name','day'))
    if op.get_bind().dialect.name=='postgresql':
        # Supabase exposes public-schema tables through its Data API. With no
        # browser policies, only the table owner/backend connection may use them.
        for table in ['users','sessions','customers','tickets','bookings','waivers','data_quality_logs','integration_logs','audit_logs','synchronisation_logs','job_runs']:
            op.execute(sa.text(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY'))

def downgrade():
    for table in ['job_runs','synchronisation_logs','audit_logs','integration_logs','data_quality_logs','waivers','bookings','tickets','customers','sessions','users']:
        op.drop_table(table)
