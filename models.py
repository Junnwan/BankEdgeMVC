from extensions import db, bcrypt
from datetime import datetime, timezone

# Model for our Admin/SuperAdmin users
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='admin') # 'admin' or 'superadmin'

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

# Model for our Edge Devices
class Device(db.Model):
    id = db.Column(db.String(50), primary_key=True) # Use our "edge-1" style IDs
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='online') # 'online' or 'offline'
    region = db.Column(db.String(50))

    # This creates a "one-to-many" relationship
    # We can now access 'device.transactions' to get all transactions for a device
    transactions = db.relationship('Transaction', backref='device', lazy=True)

# Model for our Transactions
class Transaction(db.Model):
    id = db.Column(db.String(100), primary_key=True) # For Stripe's 'txn_...' or 'cs_test_...' IDs
    amount = db.Column(db.Float, nullable=False)
    stripe_status = db.Column(db.String(50), nullable=False, default='pending') # 'succeeded', 'failed', 'pending'
    ml_prediction = db.Column(db.String(50), default='pending') # 'approved', 'flagged', 'pending'
    processed_at = db.Column(db.String(20), default='cloud') # 'edge' or 'cloud'
    timestamp = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    merchant_name = db.Column(db.String(100))

    # This links the transaction to a device
    device_id = db.Column(db.String(50), db.ForeignKey('device.id'), nullable=True)