import random
import os
import stripe
from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta, timezone
from flask_jwt_extended import create_access_token

try:
    # New versions (v7+)
    StripeError = stripe.error.StripeError
except AttributeError:
    # Old versions (v5 and below)
    StripeError = stripe.StripeError

from extensions import db, bcrypt
from models import User, Device, Transaction

from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, create_access_token

api_bp = Blueprint('api', __name__, url_prefix='/api')

# --- NEW: Stripe API Key Configuration ---
# IMPORTANT: Set this as an environment variable.
# For testing, you can temporarily hardcode your Stripe TEST key here.
# DO NOT commit your real secret key to GitHub.
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')

# # --- In-Memory Database ---
# persisted_transactions = []

# --- Data Generation Logic (Translated to Python) ---

locations = ["Johor", "Kedah", "Kelantan", "Malacca", "NegeriSembilan", "Pahang", "Penang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "KL", "Labuan", "Putrajaya"]
merchants = ['Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'GrabPay', 'FPX Payment']

def generate_edge_devices_mock_stats():
    devices = []
    for i, loc in enumerate(locations):
        # This function NOW ONLY generates dynamic stats
        # The 'status' is now controlled by the database
        devices.append({
            'id': f'edge-{i + 1}',
            'name': f'Edge Node {loc}',
            'location': f'{loc}, Malaysia',
            # 'status': 'online', # <-- This is now in the DB
            'latency': random.uniform(10, 40),
            'load': random.uniform(10, 90),
            'transactionsPerSec': random.uniform(50, 250),
            'region': 'Federal Territory' if loc in ['KL', 'Labuan', 'Putrajaya'] else 'State',
            'lastSync': (datetime.now(timezone.utc) - timedelta(minutes=random.uniform(1, 10))).isoformat(),
            'syncStatus': 'pending' if random.random() < 0.2 else 'synced'
        })
    return devices

def generate_transactions(count=5):
    transactions = []
    now = datetime.now(timezone.utc)
    for i in range(count):
        ml_prediction = random.random()

        # --- MODIFIED: Added stripeStatus ---
        if ml_prediction < 0.8:
            ml_status, stripe_status = 'approved', 'succeeded'
        elif ml_prediction < 0.95:
            ml_status, stripe_status = 'flagged', 'failed'
        else:
            ml_status, stripe_status = 'pending', 'processing'

        processed_at = 'edge' if random.random() > 0.3 else 'cloud'

        transactions.append({
            'id': f'txn-{int(now.timestamp()) - i * 10}',
            'amount': random.uniform(50, 5000),
            'type': 'Withdrawal' if random.random() > 0.5 else 'Transfer',
            'mlPrediction': ml_status,
            'stripeStatus': stripe_status, # <-- NEW FIELD
            'confidence': 0.8 + random.random() * 0.2,
            'timestamp': (now - timedelta(minutes=i*random.uniform(1, 5))).isoformat(),
            'deviceId': f'edge-{random.randint(1, 16)}',
            'processedAt': processed_at,
            'latency': random.uniform(10, 30) if processed_at == 'edge' else random.uniform(70, 120),
            'customerId': f'cus_{random.randint(10000, 99999)}',
            'merchantName': random.choice(merchants)
        })
    return transactions

def generate_latency_history(points=15):
    data = []
    now = datetime.now(timezone.utc)
    for i in range(points):
        data.append({
            'timestamp': (now - timedelta(seconds=(points - i) * 5)).isoformat(),
            'edge': random.uniform(10, 25),
            'cloud': random.uniform(80, 120),
            'hybrid': random.uniform(35, 55)
        })
    return data

def generate_ml_metrics(points=20):
    data = []
    now = datetime.now(timezone.utc)
    for i in range(points):
        data.append({
            'timestamp': (now - timedelta(seconds=(points - i) * 10)).isoformat(),
            'accuracy': 0.85 + random.random() * 0.12,
            'precision': 0.82 + random.random() * 0.15,
            'recall': 0.88 + random.random() * 0.1,
            'f1Score': 0.85 + random.random() * 0.12
        })
    return data

def generate_processing_decisions(count=10):
    data = []
    reasons = {
        'edge': ["Real-time fraud check", "Simple validation", "Low latency required", "Cached data sufficient"],
        'cloud': ["Historical analysis needed", "Complex pattern recognition", "Regulatory compliance check", "Cross-account analysis"]
    }
    types = ["Transaction", "Authentication", "Balance Inquiry", "New Account Flag"]
    now = datetime.now(timezone.utc)
    for i in range(count):
        decision = 'edge' if random.random() > 0.3 else 'cloud'
        data.append({
            'id': f'dec-{int(now.timestamp()) - i}',
            'dataType': random.choice(types),
            'decision': decision,
            'reason': random.choice(reasons[decision]),
            'priority': random.choice(['high', 'medium', 'low']),
            'size': f'{random.uniform(5, 105):.1f}',
            'timestamp': (now - timedelta(minutes=i)).isoformat()
        })
    return data

def get_system_admins():
    return [
        {'id': 'adm_001', 'username': 'admin.kl@bankedge.com', 'role': 'admin', 'email': 'admin.kl@bankedge.com', 'createdAt': '2025-01-15T08:00:00Z', 'lastLogin': '2025-10-28T09:30:00Z', 'status': 'active', 'apiKey': 'sk_live_abc123xyz789'},
        {'id': 'adm_002', 'username': 'superadmin@bankedge.com', 'role': 'superadmin', 'email': 'superadmin@bankedge.com', 'createdAt': '2025-01-01T08:00:00Z', 'lastLogin': '2025-10-28T10:15:00Z', 'status': 'active', 'apiKey': 'sk_live_def456uvw012'},
        {'id': 'adm_003', 'username': 'admin.penang@bankedge.com', 'role': 'admin', 'email': 'admin.penang@bankedge.com', 'createdAt': '2025-02-20T08:00:00Z', 'lastLogin': '2025-10-27T16:45:00Z', 'status': 'active', 'apiKey': 'sk_live_ghi789rst345'}
    ]

def get_ml_models():
    return [
        {'id': 'model_001', 'version': 'v2.4.1', 'uploadedAt': '2025-10-28T08:00:00Z', 'uploadedBy': 'superadmin@bankedge.com', 'size': '4.2 MB', 'status': 'active', 'accuracy': 96.8, 'deployedNodes': 16},
        {'id': 'model_002', 'version': 'v2.4.0', 'uploadedAt': '2025-10-20T08:00:00Z', 'uploadedBy': 'admin.kl@bankedge.com', 'size': '4.1 MB', 'status': 'archived', 'accuracy': 95.2, 'deployedNodes': 0},
        {'id': 'model_003', 'version': 'v2.5.0-beta', 'uploadedAt': '2025-10-27T14:30:00Z', 'uploadedBy': 'superadmin@bankedge.com', 'size': '4.5 MB', 'status': 'pending', 'accuracy': 97.1, 'deployedNodes': 3}
    ]

def get_audit_logs():
    return [
        {'id': 'log_001', 'timestamp': '2025-10-28T10:15:32Z', 'user': 'superadmin@bankedge.com', 'action': 'LOGIN', 'resource': 'Authentication', 'status': 'success', 'ipAddress': '203.106.94.23'},
        {'id': 'log_002', 'timestamp': '2025-10-28T10:14:18Z', 'user': 'admin.kl@bankedge.com', 'action': 'UPDATE_MODEL', 'resource': 'ML Model v2.4.1', 'status': 'success', 'ipAddress': '118.107.46.89'},
        {'id': 'log_003', 'timestamp': '2025-10-28T10:10:05Z', 'user': 'admin.penang@bankedge.com', 'action': 'TRIGGER_SYNC', 'resource': 'Edge Node PENANG-01', 'status': 'success', 'ipAddress': '60.53.218.142'},
        {'id': 'log_004', 'timestamp': '2025-10-28T09:58:23Z', 'user': 'superadmin@bankedge.com', 'action': 'CREATE_ADMIN', 'resource': 'User: admin.johor@bankedge.com', 'status': 'success', 'ipAddress': '203.106.94.23'},
        {'id': 'log_005', 'timestamp': '2025-10-28T09:45:12Z', 'user': 'admin.kl@bankedge.com', 'action': 'FAILED_LOGIN', 'resource': 'Authentication', 'status': 'failed', 'ipAddress': '118.107.46.89'}
    ]

# --- In-Memory Database (to fix "fake data" problem) ---
persisted_transactions = []

# --- API Routes ---

# --- NEW: Secure Login Route ---
@api_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    # 1. Find the user in the database
    user = User.query.filter_by(username=username).first()

    # 2. Check if user exists and password is correct
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid username or password"}), 401 # 401 Unauthorized

    # 3. Create and return a new access token (JWT)
    # We add the user's role and location to the token
    # This is much more secure than getting it from the username in JS

    # Re-create the getLocation logic from JS
    user_location = 'Global HQ'
    if user.role == 'admin':
        match = username.split('@')[0].split('.')
        if len(match) > 1:
            user_location = match[1].upper() # 'kl' -> 'KL'
        else:
            user_location = 'Unknown' # Fallback

    additional_claims = {
        "role": user.role,
        "userLocation": user_location
    }

    access_token = create_access_token(
        identity=username,
        additional_claims=additional_claims
    )

    return jsonify(
        access_token=access_token,
        role=user.role,
        userLocation=user_location
    ), 200

# NEW route to send publishable key to frontend
@api_bp.route('/config')
@jwt_required()
def get_config():
    return jsonify({
        'publishableKey': STRIPE_PUBLISHABLE_KEY
    })

# Dashboard Page
@api_bp.route('/dashboard-data')
@jwt_required()
def dashboard_data():
    # --- MODIFIED: Use the new hybrid data function ---
    devices_list = get_hybrid_devices()
    return jsonify({
        'devices': devices_list,
        'latency': generate_latency_history(),
        'transactions': generate_transactions(5) # This will be replaced in Phase 4
    })

# --- NEW: Helper function to get DB data + mock stats ---
def get_hybrid_devices():
    # 1. Get mock stats (latency, load, etc.)
    mock_stats_list = generate_edge_devices_mock_stats()
    mock_stats_map = {d['id']: d for d in mock_stats_list}

    # 2. Get persistent data from DB (id, name, status, etc.)
    db_devices = Device.query.all()

    final_devices_list = []
    for device in db_devices:
        mock_data = mock_stats_map.get(device.id, {})
        final_devices_list.append({
            'id': device.id,
            'name': device.name,
            'location': device.location,
            'status': device.status,  # <-- The REAL status from the DB
            'region': device.region,
            # Merge mock data
            'latency': mock_data.get('latency', 0),
            'load': mock_data.get('load', 0),
            'transactionsPerSec': mock_data.get('transactionsPerSec', 0),
            'lastSync': mock_data.get('lastSync', datetime.now(timezone.utc).isoformat()),
            'syncStatus': mock_data.get('syncStatus', 'unknown')
        })
    return final_devices_list

# Edge Devices Page
@api_bp.route('/devices')
@jwt_required()
def devices():
    # This route now returns our hybrid data
    devices_list = get_hybrid_devices()
    return jsonify(devices_list)

# ML Insights Page
@api_bp.route('/ml-data')
@jwt_required()
def ml_data():
    return jsonify({
        'metrics': generate_ml_metrics(),
        'transactions': generate_transactions(20),
        'decisions': generate_processing_decisions()
    })

# Transactions Page
@api_bp.route('/transactions')
@jwt_required()
def transactions_route():
    mock_count = 30 - len(persisted_transactions)
    mock_transactions = generate_transactions(mock_count) if mock_count > 0 else []
    return jsonify(persisted_transactions + mock_transactions)

# System Management Page
@api_bp.route('/system-data')
@jwt_required()
def system_data():
    # Only allow SuperAdmins to access this
    claims = get_jwt()
    if claims.get('role') != 'superadmin':
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({
        'admins': get_system_admins(),
        'auditLogs': get_audit_logs(),
        'mlModels': get_ml_models(),
        'edgeNodes': get_hybrid_devices() # Use real status
    })

# Single Device Sync (for Edge Devices Page)
@api_bp.route('/devices/sync/<device_id>', methods=['POST'])
@jwt_required()
def sync_device(device_id):
    # (This is still a mock, but it's protected)
    all_devices = generate_edge_devices_mock_stats()
    original_device = next((d for d in all_devices if d['id'] == device_id), None)
    if not original_device:
        return jsonify({'error': 'Device not found'}), 404
    synced_device = {
        **original_device,
        'status': 'online', # This should update the DB, but we'll do that in the toggle route
        'latency': random.uniform(10, 40),
        'load': random.uniform(10, 90),
        'transactionsPerSec': random.uniform(50, 250),
        'lastSync': datetime.now(timezone.utc).isoformat(),
        'syncStatus': 'synced'
    }
    return jsonify(synced_device)

# --- NEW: Stripe Checkout Session Endpoint ---
@api_bp.route('/create-checkout-session', methods=['POST'])
@jwt_required()
def create_checkout_session():
    data = request.get_json()
    try:
        amount_str = data.get('amount')
        if not amount_str:
            return jsonify({'error': 'Amount is required'}), 400

        amount_in_cents = int(float(amount_str) * 100)

        base_url = request.host_url.rstrip('/')
        success_url = f"{base_url}/transactions?status=success&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{base_url}/transactions?status=cancel"

        session = stripe.checkout.Session.create(
            payment_method_types=[ 'card', 'fpx', 'grabpay', 'shopeepay' ],
            line_items=[{
                'price_data': {
                    'currency': 'myr',
                    'product_data': {
                        'name': 'BankEdge Transfer',
                        'description': data.get('reference', 'Demo Payment'),
                        'metadata': { 'recipient_account': data.get('recipientAccount') }
                    },
                    'unit_amount': amount_in_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={ 'recipient_account': data.get('recipientAccount') }
        )

        new_txn = {
            'id': session.id,
            'amount': float(amount_str),
            'type': 'Transfer',
            'mlPrediction': 'pending',
            'stripeStatus': 'processing',
            'confidence': 1.0,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'deviceId': 'edge-13',
            'processedAt': 'cloud',
            'latency': random.uniform(70, 120),
            'customerId': f'cus_demo_{random.randint(1000,9999)}',
            'merchantName': data.get('recipientAccount', 'Stripe Payment')
        }
        persisted_transactions.insert(0, new_txn)

        return jsonify({'sessionId': session.id})

    except StripeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# NEW (Simulated) Webhook Endpoint
@api_bp.route('/webhook/stripe', methods=['POST'])
def stripe_webhook():
    data = request.get_json()
    session_id = data.get('session_id')

    global persisted_transactions
    for txn in persisted_transactions:
        if txn['id'] == session_id:
            txn['stripeStatus'] = 'succeeded'
            txn['mlPrediction'] = 'approved'
            break

    return jsonify({'status': 'success'}), 200

@api_bp.route('/init-db', methods=['GET'])
def init_db():
    try:
        db.drop_all()
        db.create_all()

        superadmin = User(username='superadmin@bankedge.com', role='superadmin')
        superadmin.set_password('SuperAdmin@123')
        db.session.add(superadmin)

        all_admin_usernames = [
            'admin.johor@bankedge.com', 'admin.kedah@bankedge.com', 'admin.kelantan@bankedge.com',
            'admin.malacca@bankedge.com', 'admin.negerisembilan@bankedge.com', 'admin.pahang@bankedge.com',
            'admin.penang@bankedge.com', 'admin.perak@bankedge.com', 'admin.perlis@bankedge.com',
            'admin.sabah@bankedge.com', 'admin.sarawak@bankedge.com', 'admin.selangor@bankedge.com',
            'admin.terengganu@bankedge.com', 'admin.kl@bankedge.com', 'admin.labuan@bankedge.com',
            'admin.putrajaya@bankedge.com'
        ]

        for username in all_admin_usernames:
            admin = User(username=username, role='admin')
            admin.set_password('Admin@123')
            db.session.add(admin)

        devices_data = generate_edge_devices_mock_stats() # Use renamed function
        for dev_data in devices_data:
            device = Device(
                id=dev_data['id'],
                name=dev_data['name'],
                location=dev_data['location'],
                status='online', # All devices start online
                region=dev_data['region']
            )
            db.session.add(device)

        transactions_data = generate_transactions(50)
        for txn_data in transactions_data:
            device = db.session.get(Device, txn_data['deviceId'])
            if device:
                txn = Transaction(
                    id=txn_data['id'],
                    amount=txn_data['amount'],
                    stripe_status=txn_data['stripeStatus'],
                    ml_prediction=txn_data['mlPrediction'],
                    processed_at=txn_data['processedAt'],
                    timestamp=datetime.fromisoformat(txn_data['timestamp']),
                    merchant_name=txn_data['merchantName'],
                    device_id=device.id
                )
                db.session.add(txn)

        db.session.commit()

        return jsonify({'message': 'Database initialized and seeded successfully!'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --- NEW: Persistent Device Status Toggle ---
@api_bp.route('/devices/toggle-status/<device_id>', methods=['POST'])
@jwt_required()
def toggle_device_status(device_id):
    # 1. Find the device in the database
    device = db.session.get(Device, device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404

    # 2. Check permissions
    claims = get_jwt()
    role = claims.get('role')
    user_location = claims.get('userLocation')

    # FIX: Allow partial match (e.g., "KL" is in "KL, Malaysia")
    # This allows Admin KL to toggle their own node.
    is_authorized = False
    if role == 'superadmin':
        is_authorized = True
    elif user_location and user_location in device.location.upper():
        is_authorized = True

    if not is_authorized:
        return jsonify({"error": "Forbidden: You can only manage your own node"}), 403

    # 3. Toggle the status
    try:
        device.status = 'offline' if device.status == 'online' else 'online'
        db.session.commit()

        # 4. Return the updated device data
        return jsonify({
            'id': device.id,
            'name': device.name,
            'location': device.location,
            'status': device.status,
            'region': device.region
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500