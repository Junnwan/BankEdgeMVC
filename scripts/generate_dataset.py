import pandas as pd
import random
import uuid
from datetime import datetime, timedelta

# --- Configuration ---
NUM_RECORDS = 100000  # <--- Updated to 100,000
OUTPUT_FILE = "bankedge_ml_dataset_100k.csv"

# --- Reference Data (Aligned with your Database) ---
DEVICE_IDS = [f"edge-{i}" for i in range(1, 17)] # edge-1 to edge-16
PAYMENT_METHODS = ['card', 'fpx_maybank2u', 'fpx_cimb', 'grabpay', 'tng_ewallet']
TXN_TYPES = ['Transfer', 'Payment', 'Withdrawal', 'Debit', 'Balance_Check']
ADMIN_EMAILS = [
    "admin.johor@bankedge.com", "admin.kedah@bankedge.com", "admin.kl@bankedge.com",
    "admin.penang@bankedge.com", "admin.sabah@bankedge.com", "superadmin@bankedge.com"
]

def generate_data():
    data = []
    print(f"Generating {NUM_RECORDS} records... This may take a moment.")

    # Using a loop is fine for 100k, but for millions we'd use vectorization.
    # This is simple and easy to understand/modify.
    for i in range(NUM_RECORDS):
        if i % 10000 == 0:
            print(f"Progress: {i}/{NUM_RECORDS}")

        # 1. Generate Basic Transaction Features
        txn_id = f"pi_{uuid.uuid4().hex[:24]}"
        
        # Transaction Amount: Skewed towards smaller amounts
        if random.random() < 0.7:
            amount = round(random.uniform(10.0, 4999.0), 2) # Small
        else:
            amount = round(random.uniform(5000.0, 50000.0), 2) # Large

        txn_type = random.choices(TXN_TYPES, weights=[35, 30, 10, 5, 20])[0]
        merchant = random.choice(PAYMENT_METHODS)
        device_id = random.choice(DEVICE_IDS)
        customer_id = random.choice(ADMIN_EMAILS)

        # 2. Simulate Fraud Logic
        fraud_threshold = 0.98 if amount < 10000 else 0.90
        is_fraud = 1 if random.random() > fraud_threshold else 0

        # 3. Simulate Account Balances
        old_balance = round(amount + random.uniform(1000, 50000), 2)
        new_balance = old_balance if txn_type == 'Balance_Check' else round(old_balance - amount, 2)

        # 4. CORE LOGIC: Determine Processing Decision
        decision = 'cloud' # Default fallback
        latency = 0.0
        stripe_status = 'succeeded' # Default
        
        if is_fraud == 1:
            decision = 'flagged'
            latency = 0.0
            stripe_status = 'failed'
        
        elif txn_type == 'Balance_Check':
            decision = 'edge'
            latency = random.uniform(5.0, 30.0)
            stripe_status = 'succeeded'
            
        elif amount < 5000 and txn_type != 'Withdrawal':
            decision = 'edge'
            latency = random.uniform(20.0, 60.0)
            stripe_status = 'succeeded'
            
        else:
            decision = 'cloud'
            latency = random.uniform(100.0, 400.0)
            stripe_status = 'succeeded'

        # 5. Create Record Dictionary
        record = {
            "id": txn_id,
            "amount": amount,
            "stripe_status": stripe_status,
            "processing_decision": decision,   # TARGET variable
            "timestamp": (datetime.now() - timedelta(days=random.randint(0, 90), minutes=random.randint(0, 1440))).isoformat(), # Spread over 90 days
            "recipient_account": str(random.randint(1000000000, 9999999999)),
            "reference": f"ref_{uuid.uuid4().hex[:8]}",
            "merchant_name": merchant,
            "device_id": device_id,
            "type": txn_type,
            "customer_id": customer_id,
            "confidence": round(random.uniform(0.85, 0.99), 4),
            "latency": round(latency, 2),
            "old_balance_org": old_balance,
            "new_balance_org": new_balance,
            "is_fraud": is_fraud
        }
        data.append(record)

    # Convert to DataFrame and Save
    print("Converting to CSV...")
    df = pd.DataFrame(data)
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"Success! Dataset with {NUM_RECORDS} rows saved to {OUTPUT_FILE}")
    print("\nClass Distribution:")
    print(df['processing_decision'].value_counts())

if __name__ == "__main__":
    generate_data()