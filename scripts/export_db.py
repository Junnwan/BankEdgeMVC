import sys
import os
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from models import db, User, Device, Transaction

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '../migrations/data_dump.json')

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def export_data():
    data = {
        "users": [],
        "devices": [],
        "transactions": []
    }

    with app.app_context():
        # Export Users
        users = User.query.all()
        for u in users:
            data["users"].append({
                "username": u.username,
                "password_hash": u.password_hash,
                "role": u.role,
                "balance": u.balance,
                "last_login": u.last_login
            })
        print(f"Exported {len(users)} users.")

        # Export Devices
        devices = Device.query.all()
        for d in devices:
            data["devices"].append({
                "id": d.id,
                "name": d.name,
                "location": d.location,
                "status": d.status,
                "region": d.region,
                "last_sync": d.last_sync
            })
        print(f"Exported {len(devices)} devices.")

        # Export Transactions
        transactions = Transaction.query.all()
        for t in transactions:
            data["transactions"].append({
                "id": t.id,
                "amount": t.amount,
                "stripe_status": t.stripe_status,
                "processing_decision": t.processing_decision,
                "timestamp": t.timestamp,
                "old_balance_org": t.old_balance_org,
                "new_balance_org": t.new_balance_org,
                "is_fraud": t.is_fraud,
                "recipient_account": t.recipient_account,
                "reference": t.reference,
                "merchant_name": t.merchant_name,
                "device_id": t.device_id,
                "type": t.type,
                "customer_id": t.customer_id,
                "confidence": t.confidence,
                "latency": t.latency
            })
        print(f"Exported {len(transactions)} transactions.")

    # Write to file
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(data, f, default=json_serial, indent=2)
    
    print(f"Data successfully exported to {OUTPUT_FILE}")

if __name__ == "__main__":
    export_data()
