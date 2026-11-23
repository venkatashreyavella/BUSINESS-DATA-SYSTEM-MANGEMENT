import re
from datetime import date
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator

class Registration(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=12, max_length=128)

class Login(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)

class CustomerInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone: str = Field(default='', max_length=40)
    status: Literal['active', 'inactive'] = 'active'

    @field_validator('email')
    @classmethod
    def email_lower(cls, v):
        return v.lower()

    @field_validator('phone')
    @classmethod
    def phone_valid(cls, v):
        if v and not re.fullmatch(r'\+?[\d\s()\-]{7,25}', v):
            raise ValueError('Use a valid phone number')
        return v

class BookingInput(BaseModel):
    customer_id: int = Field(gt=0)
    ticket_id: int = Field(gt=0)
    visit_date: date
    quantity: int = Field(gt=0, le=1000)
    status: Literal['confirmed', 'pending', 'cancelled'] = 'confirmed'
    waiver_signed: bool = False

class TicketInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    price: float = Field(ge=0, le=100000)
    active: bool = True

class CorrectionInput(BaseModel):
    records: list[dict] = Field(max_length=10000)
    confirm: bool

class RoleInput(BaseModel):
    role: Literal['administrator', 'staff']
    active: bool = True
