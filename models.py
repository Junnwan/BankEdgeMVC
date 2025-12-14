from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime, timezone, timedelta

db = SQLAlchemy()
bcrypt = Bcrypt()

UTC8 = timezone(timedelta(hours=8))

# ==========================
# User Model
# ==========================
class User(db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='admin')  # admin / superadmin
    balance = db.Column(db.Float, default=100000.0)  # NEW: Initial balance RM 100,000
    last_login = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


# ==========================
# Device Model
# ==========================
class Device(db.Model):
    __tablename__ = 'device'

    id = db.Column(db.String(50), primary_key=True)     # e.g., edge-14
    name = db.Column(db.String(100), nullable=False)    # e.g., Edge Node KL
    location = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='online')
    region = db.Column(db.String(50))
    last_sync = db.Column(db.DateTime, default=lambda: datetime.now(UTC8))

    transactions = db.relationship('Transaction', backref='device', lazy=True)


# ==========================
# Transaction Model (UPDATED)
# ==========================
class Transaction(db.Model):
    __tablename__ = 'transaction'

    id = db.Column(db.String(100), primary_key=True)
    amount = db.Column(db.Float, nullable=False)

    stripe_status = db.Column(db.String(20), nullable=False, default='failed')
    processing_decision = db.Column(db.String(20), default='cloud') # Renamed from processed_at

    timestamp = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(UTC8))

    # NEW: Balance & ML Fields
    old_balance_org = db.Column(db.Float, default=0.0)
    new_balance_org = db.Column(db.Float, default=0.0)
    is_fraud = db.Column(db.Boolean, default=False)

    # NEW
    recipient_account = db.Column(db.String(150), nullable=True)
    reference = db.Column(db.String(200), nullable=True)

    merchant_name = db.Column(db.String(100))
    device_id = db.Column(db.String(50), db.ForeignKey('device.id'), nullable=True)
    type = db.Column(db.String(50), default='Transfer')
    customer_id = db.Column(db.String(150), nullable=True)

    # Keep for dashboard
    confidence = db.Column(db.Float, default=0.0)
    latency = db.Column(db.Float, default=0.0)

    def to_dict(self):
        return {
            'id': self.id,
            'amount': self.amount,
            'stripe_status': self.stripe_status,
            'processing_decision': self.processing_decision,
            'timestamp': self.timestamp.isoformat(),
            'recipient_account': self.recipient_account,
            'reference': self.reference,
            'merchant_name': self.merchant_name,
            'device_id': self.device_id,
            'type': self.type,
            'customer_id': self.customer_id,
            'confidence': self.confidence,
            'latency': self.latency,
        }

def get_all_transactions():
    return Transaction.query.order_by(Transaction.timestamp.desc()).all()
