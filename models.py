from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime, timezone

db = SQLAlchemy()
bcrypt = Bcrypt()

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='admin')  # 'admin' or 'superadmin'

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


class Device(db.Model):
    __tablename__ = 'device'
    id = db.Column(db.String(50), primary_key=True)  # e.g., 'edge-1'
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='online')  # 'online' or 'offline'
    region = db.Column(db.String(50))

    transactions = db.relationship('Transaction', backref='device', lazy=True)


class Transaction(db.Model):
    __tablename__ = 'transaction'
    id = db.Column(db.String(100), primary_key=True)  # Stripe session id or generated id
    amount = db.Column(db.Float, nullable=False)
    stripe_status = db.Column(db.String(50), nullable=False, default='pending')
    ml_prediction = db.Column(db.String(50), default='pending')
    processed_at = db.Column(db.String(20), default='cloud')  # 'edge' or 'cloud'
    timestamp = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    merchant_name = db.Column(db.String(100))
    device_id = db.Column(db.String(50), db.ForeignKey('device.id'), nullable=True)
    
    # New fields
    type = db.Column(db.String(50), default='Transfer')
    latency = db.Column(db.Float, default=0.0)
    confidence = db.Column(db.Float, default=0.0)
    customer_id = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'amount': self.amount,
            'stripe_status': self.stripe_status,
            'ml_prediction': self.ml_prediction,
            'processed_at': self.processed_at,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'merchant_name': self.merchant_name,
            'device_id': self.device_id,
            'type': self.type,
            'latency': self.latency,
            'confidence': self.confidence,
            'customer_id': self.customer_id
        }


def get_all_transactions():
    """
    Return list of Transaction objects ordered by newest first.
    Use these directly in templates (Jinja can access attributes).
    """
    return Transaction.query.order_by(Transaction.timestamp.desc()).all()
