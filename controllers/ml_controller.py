from flask import Blueprint, render_template, session, redirect, url_for
import random
from datetime import datetime, timedelta, timezone
import math

ml_bp = Blueprint('ml', __name__)

# --- Data Generation Dependencies (Reused from edge_controller logic) ---
# NOTE: These are simplified mocks to support transaction filtering logic.
LOCATIONS = [
    'johor', 'kedah', 'kelantan', 'malacca', 'negerisembilan', 'pahang',
    'penang', 'perak', 'perlis', 'sabah', 'sarawak', 'selangor',
    'terengganu', 'kl', 'labuan', 'putrajaya'
]

def generate_device_id(i):
    return f"NODE-EDGE-{i:03d}"

def generate_edge_devices(num_devices=16):
    devices = []
    for i in range(num_devices):
        location = LOCATIONS[i]
        device_id = generate_device_id(i)
        devices.append({'id': device_id, 'name': f"Edge Node {location.capitalize()}", 'location': location.capitalize()})
    return devices
# --------------------------------------------------------------------------

def generate_ml_metrics(count=15):
    """Generates mock time-series data for ML metrics."""
    metrics = []
    base_time = datetime.now(timezone.utc) - timedelta(minutes=count * 2)
    for i in range(count):
        t = base_time + timedelta(minutes=i * 2)
        metrics.append({
            'timestamp': t.isoformat(),
            'accuracy': round(0.85 + random.random() * 0.12, 4), # 85% to 97%
            'precision': round(0.82 + random.random() * 0.15, 4),
            'recall': round(0.88 + random.random() * 0.1, 4),
            'f1Score': round(0.85 + random.random() * 0.12, 4)
        })
    return metrics

def generate_transactions(count=50):
    """Generates mock transaction data with ML predictions."""
    transactions = []
    transaction_types = ['transfer', 'withdrawal', 'purchase', 'deposit']
    predictions = ['approved', 'flagged', 'pending']
    device_ids = [generate_device_id(i) for i in range(len(LOCATIONS))]

    for i in range(count):
        transactions.append({
            'id': f"TXN-{i:05d}",
            'amount': random.randint(10, 5000),
            'type': random.choice(transaction_types),
            'mlPrediction': random.choice(predictions),
            'confidence': round(0.7 + random.random() * 0.29, 4),
            'deviceId': random.choice(device_ids)
        })
    return transactions

def generate_processing_decisions(count=30):
    """Generates mock data on where processing occurred (Edge vs. Cloud)."""
    decisions = []
    data_types = ['Transaction Log', 'User Activity', 'Model Update']
    reasons = {
        'edge': ['Low latency required', 'Standard transaction', 'Local cache hit'],
        'cloud': ['Complex risk score needed', 'Model retraining data', 'Large batch data']
    }
    priorities = ['high', 'medium', 'low']

    for i in range(count):
        decision_type = random.choice(['edge', 'cloud'])
        decisions.append({
            'id': f"DEC-{i:04d}",
            'dataType': random.choice(data_types),
            'decision': decision_type,
            'reason': random.choice(reasons[decision_type]),
            'priority': random.choice(priorities),
            'size': round(random.uniform(5, 500), 1),
            'timestamp': (datetime.now(timezone.utc) - timedelta(seconds=random.randint(1, 3600))).isoformat()
        })
    return decisions
# -------------------------------------------------------------

@ml_bp.route('/ml-insights')
def ml_insights():
    # Enforce authentication
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    all_ml_metrics = generate_ml_metrics(count=15)
    all_transactions = generate_transactions(count=50)
    all_decisions = generate_processing_decisions(count=30)

    user_role = session.get('role')
    user_username = session.get('username', '')
    user_location = None
    transactions = all_transactions

    # 1. Determine user location for filtering
    if user_role == 'admin':
        try:
            # Extract location part (e.g., admin.johor@bankedge.com -> Johor)
            location_part = user_username.split('@')[0].split('.')[-1].capitalize()
            user_location = location_part

            # 2. Filter transactions if a specific location is determined
            all_devices = generate_edge_devices()
            location_devices = [d['id'] for d in all_devices if d.get('location') == user_location]
            transactions = [t for t in all_transactions if t.get('deviceId') in location_devices]
        except:
            # Fallback to show all transactions if username parsing fails
            user_location = None

    # 3. Calculate summary data (based on MLPerformance.tsx logic)
    latest_metrics = all_ml_metrics[-1] if all_ml_metrics else {'accuracy': 0, 'precision': 0, 'recall': 0, 'f1Score': 0}

    approved = sum(1 for t in transactions if t['mlPrediction'] == 'approved')
    flagged = sum(1 for t in transactions if t['mlPrediction'] == 'flagged')
    pending = sum(1 for t in transactions if t['mlPrediction'] == 'pending')
    total_transactions = len(transactions)

    # Prepare data for rendering
    data = {
        'mlMetrics': all_ml_metrics,
        'latestMetrics': latest_metrics,
        'transactions': transactions,
        'processingDecisions': all_decisions,
        'userLocation': user_location,
        'predictionDist': {
            'approved': approved,
            'flagged': flagged,
            'pending': pending,
            'total': total_transactions
        }
    }

    return render_template('ml_insights.html', **data)