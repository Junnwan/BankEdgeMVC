import random
import os
import stripe
from flask import Blueprint, jsonify, request, current_app
from datetime import datetime, timedelta, timezone
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from models import db, bcrypt
from models import User, Device, Transaction


try:
    # New versions (v7+)
    StripeError = stripe.error.StripeError
except AttributeError:
    # Old versions (v5 and below)
    StripeError = stripe.StripeError

api_bp = Blueprint('api', __name__, url_prefix='/api')

# --- Data Generation Logic ---
locations = ["Johor", "Kedah", "Kelantan", "Malacca", "NegeriSembilan", "Pahang", "Penang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "KL", "Labuan", "Putrajaya"]
merchants = ['Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'GrabPay', 'FPX Payment']

def generate_edge_devices_mock_stats():
    devices = []
    for i, loc in enumerate(locations):
        devices.append({
            'id': f'edge-{i + 1}',
            'name': f'Edge Node {loc}',
            'location': f'{loc}, Malaysia',
            'status': 'online', 
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
            'stripeStatus': stripe_status,
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

# --- API Routes ---

@api_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid username or password"}), 401

    user_location = 'Global HQ'
    if user.role == 'admin':
        match = username.split('@')[0].split('.')
        if len(match) > 1:
            user_location = match[1].upper()
        else:
            user_location = 'Unknown'

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

@api_bp.route('/config')
@jwt_required()
def get_config():
    return jsonify({
        'publishableKey': current_app.config["STRIPE_PUBLISHABLE_KEY"]
    })

def get_hybrid_devices():
    mock_stats_list = generate_edge_devices_mock_stats()
    mock_stats_map = {d['id']: d for d in mock_stats_list}
    db_devices = Device.query.all()
    final_devices_list = []
    for device in db_devices:
        mock_data = mock_stats_map.get(device.id, {})
        final_devices_list.append({
            'id': device.id,
            'name': device.name,
            'location': device.location,
            'status': device.status,
            'region': device.region,
            'latency': mock_data.get('latency', 0),
            'load': mock_data.get('load', 0),
            'transactionsPerSec': mock_data.get('transactionsPerSec', 0),
            'lastSync': mock_data.get('lastSync', datetime.now(timezone.utc).isoformat()),
            'syncStatus': mock_data.get('syncStatus', 'synced')
        })
    return final_devices_list

@api_bp.route('/devices')
@jwt_required()
def devices():
    devices_list = get_hybrid_devices()
    return jsonify(devices_list)

@api_bp.route('/ml-data')
@jwt_required()
def ml_data():
    return jsonify({
        'metrics': generate_ml_metrics(),
        'transactions': generate_transactions(20),
        'decisions': generate_processing_decisions()
    })

@api_bp.route('/system-data')
@jwt_required()
def system_data():
    claims = get_jwt()
    if claims.get('role') != 'superadmin':
        return jsonify({"error": "Forbidden"}), 403
    return jsonify({
        'admins': get_system_admins(),
        'auditLogs': get_audit_logs(),
        'mlModels': get_ml_models(),
        'edgeNodes': get_hybrid_devices()
    })

@api_bp.route('/dashboard-data')
@jwt_required()
def dashboard_data():
    """Combined dashboard data endpoint"""
    devices_list = get_hybrid_devices()
    latency_data = generate_latency_history()
    transactions = generate_transactions(10)
    
    return jsonify({
        'devices': devices_list,
        'latency': latency_data,
        'transactions': transactions
    })


@api_bp.route('/devices/sync/<device_id>', methods=['POST'])
@jwt_required()
def sync_device(device_id):
    all_devices = generate_edge_devices_mock_stats()
    original_device = next((d for d in all_devices if d['id'] == device_id), None)
    if not original_device:
        return jsonify({'error': 'Device not found'}), 404
    synced_device = {
        **original_device,
        'status': 'online',
        'latency': random.uniform(10, 40),
        'load': random.uniform(10, 90),
        'transactionsPerSec': random.uniform(50, 250),
        'lastSync': datetime.now(timezone.utc).isoformat(),
        'syncStatus': 'synced'
    }
    return jsonify(synced_device)

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

        devices_data = generate_edge_devices_mock_stats()
        for dev_data in devices_data:
            device = Device(
                id=dev_data['id'],
                name=dev_data['name'],
                location=dev_data['location'],
                status='online',
                region=dev_data['region']
            )
            db.session.add(device)

        db.session.commit()

        return jsonify({'message': 'Database initialized and seeded successfully!'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/devices/toggle-status/<device_id>', methods=['POST'])
@jwt_required()
def toggle_device_status(device_id):
    device = db.session.get(Device, device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404

    claims = get_jwt()
    role = claims.get('role')
    user_location = claims.get('userLocation')

    is_authorized = False
    if role == 'superadmin':
        is_authorized = True
    elif user_location and user_location in device.location.upper():
        is_authorized = True

    if not is_authorized:
        return jsonify({"error": "Forbidden: You can only manage your own node"}), 403

    try:
        device.status = 'offline' if device.status == 'online' else 'online'
        db.session.commit()

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