from datetime import datetime, timezone, date
from sqlalchemy import String, Integer, DateTime, Date, ForeignKey, Numeric, Boolean, JSON, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

def now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default='staff')
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)

class Session(Base):
    __tablename__ = 'sessions'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    expires: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class Customer(Base):
    __tablename__ = 'customers'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(40), default='')
    status: Mapped[str] = mapped_column(String(20), default='active')
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Ticket(Base):
    __tablename__ = 'tickets'
    __table_args__ = (CheckConstraint('price >= 0'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Booking(Base):
    __tablename__ = 'bookings'
    __table_args__ = (CheckConstraint('quantity > 0 AND quantity <= 1000'), CheckConstraint('price >= 0'), CheckConstraint("status IN ('confirmed','pending','cancelled')"))
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey('customers.id'), index=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey('tickets.id'), index=True)
    booking_date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    total: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20), default='confirmed', index=True)
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)

class Waiver(Base):
    __tablename__ = 'waivers'
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey('bookings.id', ondelete='CASCADE'), unique=True)
    signed: Mapped[bool] = mapped_column(Boolean, default=False)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class QualityLog(Base):
    __tablename__ = 'data_quality_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    kind: Mapped[str] = mapped_column(String(30))
    source: Mapped[str] = mapped_column(String(255))
    original: Mapped[list] = mapped_column(JSON)
    report: Mapped[dict] = mapped_column(JSON)
    applied: Mapped[bool] = mapped_column(Boolean, default=False)

class IntegrationLog(Base):
    __tablename__ = 'integration_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    integration: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(String(1000))

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'), nullable=True)
    action: Mapped[str] = mapped_column(String(255))
    details: Mapped[dict] = mapped_column(JSON, default=dict)

class SyncLog(Base):
    __tablename__ = 'synchronisation_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    status: Mapped[str] = mapped_column(String(30))
    records: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(String(1000))

class JobRun(Base):
    __tablename__ = 'job_runs'
    __table_args__ = (UniqueConstraint('name', 'day'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    day: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
