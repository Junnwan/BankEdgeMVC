from flask import Blueprint, render_template, session, redirect, url_for
import random
from datetime import datetime, timedelta, timezone

transaction_bp = Blueprint('transaction', __name__) # CHANGED: Blueprint name to 'transaction'

# --- Mock Data Generation Dependencies ---
LOCATIONS = [
    'johor', 'kedah', 'kelantan', 'malacca', 'negerisembilan', 'pahang',
    'penang', 'perak', 'perlis', 'sabah', 'sarawak', 'selangor',
    'terengganu', 'kl', 'labuan', 'putrajaya'
]
# -------------------------------------------

def generate_device_id(i):
    return f"NODE-EDGE-{i:03d}"

def generate_edge_devices(num_devices=16):
    devices = []
    for i in range(num_devices):
        location = LOCATIONS[i]
        device_id = generate_device_id(i)
        devices.append({'id': device_id, 'name': f"Edge Node {location.capitalize()}", 'location': location.capitalize()})
    return devices

def generate_transactions_sync(count=30, all_devices=None):
    transactions = []
    transaction_types = ['transfer', 'withdrawal', 'purchase', 'deposit']
    ml_predictions = ['approved', 'flagged', 'pending']
    stripe_statuses = ['succeeded', 'failed', 'processing']
    processed_at_options = ['edge', 'cloud']
    device_ids = [d['id'] for d in all_devices] if all_devices else [f"NODE-EDGE-{i:03d}" for i in range(len(LOCATIONS))]

    for i in range(count):
        processed_at = random.choice(processed_at_options)

        if processed_at == 'edge':
            latency = random.randint(10, 30)
        else:
            latency = random.randint(70, 150)

        transactions.append({
            'id': f"TXN-SYNC-{i:05d}",
            'type': random.choice(transaction_types),
            'amount': random.randint(100, 10000),
            'timestamp': (datetime.now(timezone.utc) - timedelta(minutes=random.randint(1, 60))).isoformat(),
            'deviceId': random.choice(device_ids),
            'latency': latency,
            'mlPrediction': random.choice(ml_predictions),
            'confidence': round(0.7 + random.random() * 0.29, 4),
            'processedAt': processed_at,
            'stripeStatus': random.choice(stripe_statuses),
            'customerId': f"cus_{random.getrandbits(64)}",
            'merchantName': f"Merchant-{random.randint(100, 999)}"
        })
    return transactions


@transaction_bp.route('/transactions') # CHANGED: Route URL to '/transactions'
def data_sync():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    all_devices = generate_edge_devices(num_devices=16)
    all_transactions = generate_transactions_sync(count=30, all_devices=all_devices)

    user_role = session.get('role')
    user_username = session.get('username', '')
    user_location = None
    transactions = all_transactions

    if user_role == 'admin':
        try:
            location_part = user_username.split('@')[0].split('.')[-1].capitalize()
            user_location = location_part

            location_device_ids = [d['id'] for d in all_devices if d.get('location') == user_location]
            transactions = [t for t in all_transactions if t.get('deviceId') in location_device_ids]
        except:
            pass

    total_volume = sum(t['amount'] for t in transactions)
    successful_txns = sum(1 for t in transactions if t['stripeStatus'] == 'succeeded')
    total_txns = len(transactions)

    edge_processed = sum(1 for t in transactions if t['processedAt'] == 'edge')
    cloud_processed = total_txns - edge_processed

    avg_latency = sum(t['latency'] for t in transactions) / total_txns if total_txns else 0

    transaction_flow = [
        {'stage': 'Initiated', 'count': total_txns},
        {'stage': 'ML Validated', 'count': sum(1 for t in transactions if t['mlPrediction'] != 'pending')},
        {'stage': 'Stripe Processing', 'count': sum(1 for t in transactions if t['stripeStatus'] != 'processing')},
        {'stage': 'Completed', 'count': successful_txns}
    ]

    data = {
        'userLocation': user_location,
        'transactions': transactions,
        'totalVolume': round(total_volume, 2),
        'successfulTxns': successful_txns,
        'totalTxns': total_txns,
        'edgeProcessed': edge_processed,
        'cloudProcessed': cloud_processed,
        'avgLatency': round(avg_latency, 0),
        'transactionFlow': transaction_flow
    }

    return render_template('transactions.html', **data) # CHANGED: Template name to 'transactions.html'