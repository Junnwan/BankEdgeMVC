import sys
import os
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from models import db, User, Device, Transaction

INPUT_FILE = os.path.join(os.path.dirname(__file__), '../migrations/data_dump.json')

def import_data():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        sys.exit(1)

    with open(INPUT_FILE, 'r') as f:
        data = json.load(f)

    with app.app_context():
        # Import Devices
        print("Importing Devices...")
        for d_data in data.get("devices", []):
            existing = Device.query.get(d_data['id'])
            if not existing:
                device = Device(
                    id=d_data['id'],
                    name=d_data['name'],
                    location=d_data['location'],
                    status=d_data['status'],
                    region=d_data['region'],
                    last_sync=datetime.fromisoformat(d_data['last_sync']) if d_data['last_sync'] else None
                )
                db.session.add(device)
            else:
                print(f"Skipping existing device {d_data['id']}")
        
        # Import Users
        print("Importing Users...")
        for u_data in data.get("users", []):
            existing = User.query.filter_by(username=u_data['username']).first()
            if not existing:
                user = User(
                    username=u_data['username'],
                    password_hash=u_data['password_hash'], # HASH IS ALREADY GENERATED
                    role=u_data['role'],
                    balance=u_data.get('balance', 100000.0),
                    last_login=datetime.fromisoformat(u_data['last_login']) if u_data['last_login'] else None
                )
                # DO NOT CALL set_password(), use the hash directly
                db.session.add(user)
            else:
                # OPTIONAL: Overwrite existing user data with migration data
                # This ensures if seed_devices ran first, we update with the "real" local data
                existing.balance = u_data.get('balance', 100000.0)
                existing.password_hash = u_data['password_hash']
                existing.role = u_data['role']
                # existing.last_login = ... (Optional)
                print(f"Updated existing user {u_data['username']}")

        # Import Transactions
        print("Importing Transactions...")
        for t_data in data.get("transactions", []):
            existing = Transaction.query.get(t_data['id'])
            if not existing:
                txn = Transaction(
                    id=t_data['id'],
                    amount=t_data['amount'],
                    stripe_status=t_data['stripe_status'],
                    processing_decision=t_data['processing_decision'],
                    timestamp=datetime.fromisoformat(t_data['timestamp']),
                    old_balance_org=t_data.get('old_balance_org', 0.0),
                    new_balance_org=t_data.get('new_balance_org', 0.0),
                    is_fraud=t_data.get('is_fraud', False),
                    recipient_account=t_data.get('recipient_account'),
                    reference=t_data.get('reference'),
                    merchant_name=t_data.get('merchant_name'),
                    device_id=t_data.get('device_id'),
                    type=t_data.get('type'),
                    customer_id=t_data.get('customer_id'),
                    confidence=t_data.get('confidence', 0.0),
                    latency=t_data.get('latency', 0.0)
                )
                db.session.add(txn)
            else:
                # Optional: Update existing transaction? Usually immutable history.
                pass

        try:
            db.session.commit()
            print("Import completed successfully.")
        except Exception as e:
            db.session.rollback()
            print(f"Import failed: {e}")

if __name__ == "__main__":
    import_data()
