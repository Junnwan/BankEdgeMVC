from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt, create_access_token, get_jwt_identity
from models import db, User, Device, Transaction
from datetime import datetime, timedelta, timezone
import random

api_bp = Blueprint('api', __name__)

UTC8 = timezone(timedelta(hours=8))

@api_bp.route('/login', methods=['POST'])
def login():
    username = request.json.get('username', None)
    password = request.json.get('password', None)
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        additional_claims = {"role": user.role}
        if user.role == 'admin':
             # Extract location from username e.g. admin.kl@...
             parts = username.split('@')[0].split('.')
             if len(parts) > 1:
                 # Handle cases like admin2.johor -> johor
                 loc_part = parts[1] if not parts[0][-1].isdigit() else parts[1] 
                 additional_claims["userLocation"] = loc_part.upper()
        
        user.last_login = datetime.now(UTC8)
        db.session.commit()

        access_token = create_access_token(identity=username, additional_claims=additional_claims)
        return jsonify(access_token=access_token, role=user.role, userLocation=additional_claims.get("userLocation", ""))
    return jsonify({"msg": "Bad username or password"}), 401

@api_bp.route('/config', methods=['GET'])
def get_config():
    return jsonify({'publishableKey': current_app.config.get('STRIPE_PUBLISHABLE_KEY', '')})

def get_hybrid_devices(target_device_id=None):
    # Fetch real devices from DB
    if target_device_id:
        devices = Device.query.filter_by(id=target_device_id).all()
    else:
        devices = Device.query.all()

    results = []
    for d in devices:
        # Add mock real-time stats
        results.append({
            "id": d.id,
            "name": d.name,
            "location": d.location,
            "region": d.region,
            "status": d.status,
            "load": random.uniform(10, 90),
            "latency": random.uniform(5, 50),
            "transactionsPerSec": random.uniform(1, 100),
            "lastSync": d.last_sync.isoformat() if d.last_sync else datetime.now(UTC8).isoformat(),
            "syncStatus": "synced" if d.status == 'online' else "pending"
        })
    return results

def generate_latency_history():
    history = []
    now = datetime.now(UTC8)
    for i in range(20):
        t = now - timedelta(minutes=i*5)
        history.append({
            "timestamp": t.isoformat(),
            "edge": random.uniform(5, 15),
            "hybrid": random.uniform(10, 30),
            "cloud": random.uniform(20, 100)
        })
    return list(reversed(history))

# Responsibilities:
# - Authentication (/api/login)
# - Config route to provide STRIPE_PUBLISHABLE_KEY to frontend
# - Device endpoints (hybrid: DB + mock stats)
# - ML and system helper endpoints (mocked data for charts)
# - Dashboard data (real devices + recent transactions from DB)
@api_bp.route('/dashboard-data', methods=['GET'])
@jwt_required()
def dashboard_data():
    try:
        claims = get_jwt()
        user_location = claims.get("userLocation", "").upper()

        # Map region → device id
        locmap = {
            "JOHOR": "edge-1", "KEDAH": "edge-2", "KELANTAN": "edge-3",
            "MALACCA": "edge-4", "NEGERISEMBILAN": "edge-5", "PAHANG": "edge-6",
            "PENANG": "edge-7", "PERAK": "edge-8", "PERLIS": "edge-9",
            "SABAH": "edge-10", "SARAWAK": "edge-11", "SELANGOR": "edge-12",
            "TERENGGANU": "edge-13", "KL": "edge-14", "LABUAN": "edge-15",
            "PUTRAJAYA": "edge-16"
        }

        device_id = locmap.get(user_location, None)
        device = db.session.get(Device, device_id)
        
        # Get User Balance
        username = get_jwt_identity()
        user = User.query.filter_by(username=username).first()
        user_balance = user.balance if user else 0.0

        # Build final device info for dashboard header box
        device_box = None
        if device:
            device_box = {
                "id": device.id,
                "location": device.location,
                "status": (device.status or "").lower(),
                "syncStatus": "synced" if (device.status or "").lower() == "online" else "pending",
            }

        # Filter devices list for bottom panel
        filtered_devices = get_hybrid_devices()
        if claims.get('role') != 'superadmin' and device_id:
            filtered_devices = [d for d in filtered_devices if d['id'] == device_id]

        # Filter transactions
        query = Transaction.query.order_by(Transaction.timestamp.desc())
        if claims.get('role') != 'superadmin' and device_id:
            query = query.filter_by(device_id=device_id)
        
        recent_txns = query.limit(5).all()
        txn_data = []
        for t in recent_txns:
            txn_data.append({
                "id": t.id,
                "amount": t.amount,
                "type": t.type,
                "stripe_status": t.stripe_status,
                "processing_decision": t.processing_decision,
                "latency": t.latency,
                "confidence": t.confidence,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                "merchant_name": t.merchant_name,
                "device_id": t.device_id,
                "device_name": t.device.name if t.device else "Unknown",
                "recipient_account": t.recipient_account,
                "reference": t.reference,
                "customer_id": t.customer_id
            })

        return jsonify({
            "deviceBox": device_box,
            "devices": filtered_devices,
            "transactions": txn_data,
            "latency": generate_latency_history(),
            "userBalance": user_balance
        })

    except Exception as e:
        current_app.logger.exception("Failed dashboard")
        return jsonify({"error": str(e)}), 500

def seed_edge_devices():
    """Returns list of 16 predefined Edge Nodes for Malaysia."""
    return [
        {"id": "edge-1", "name": "Edge Node Johor",         "location": "Johor, Malaysia",          "region": "State"},
        {"id": "edge-2", "name": "Edge Node Kedah",         "location": "Kedah, Malaysia",          "region": "State"},
        {"id": "edge-3", "name": "Edge Node Kelantan",      "location": "Kelantan, Malaysia",       "region": "State"},
        {"id": "edge-4", "name": "Edge Node Malacca",       "location": "Malacca, Malaysia",        "region": "State"},
        {"id": "edge-5", "name": "Edge Node NegeriSembilan","location": "NegeriSembilan, Malaysia", "region": "State"},
        {"id": "edge-6", "name": "Edge Node Pahang",        "location": "Pahang, Malaysia",         "region": "State"},
        {"id": "edge-7", "name": "Edge Node Penang",        "location": "Penang, Malaysia",         "region": "State"},
        {"id": "edge-8", "name": "Edge Node Perak",         "location": "Perak, Malaysia",          "region": "State"},
        {"id": "edge-9", "name": "Edge Node Perlis",        "location": "Perlis, Malaysia",         "region": "State"},
        {"id": "edge-10","name": "Edge Node Sabah",         "location": "Sabah, Malaysia",          "region": "State"},
        {"id": "edge-11","name": "Edge Node Sarawak",       "location": "Sarawak, Malaysia",        "region": "State"},
        {"id": "edge-12","name": "Edge Node Selangor",      "location": "Selangor, Malaysia",       "region": "State"},
        {"id": "edge-13","name": "Edge Node Terengganu",    "location": "Terengganu, Malaysia",     "region": "State"},
        {"id": "edge-14","name": "Edge Node KL",            "location": "KL, Malaysia",             "region": "Federal Territory"},
        {"id": "edge-15","name": "Edge Node Labuan",        "location": "Labuan, Malaysia",         "region": "Federal Territory"},
        {"id": "edge-16","name": "Edge Node Putrajaya",     "location": "Putrajaya, Malaysia",      "region": "Federal Territory"},
    ]

# ---------------------------
# DB init (seed) — for dev only
# ---------------------------
@api_bp.route('/init-db', methods=['GET'])
def init_db():
    try:
        db.drop_all()
        db.create_all()

        # ---- Create Superadmin ----
        superadmin = User(username='superadmin@bankedge.com', role='superadmin')
        superadmin.set_password('SuperAdmin@123')
        db.session.add(superadmin)

        # ---- Create 16 admins (one per device/location) ----
        admin_usernames = [
            'admin.johor@bankedge.com', 'admin.kedah@bankedge.com', 'admin.kelantan@bankedge.com',
            'admin.malacca@bankedge.com', 'admin.negerisembilan@bankedge.com', 'admin.pahang@bankedge.com',
            'admin.penang@bankedge.com', 'admin.perak@bankedge.com', 'admin.perlis@bankedge.com',
            'admin.sabah@bankedge.com', 'admin.sarawak@bankedge.com', 'admin.selangor@bankedge.com',
            'admin.terengganu@bankedge.com', 'admin.kl@bankedge.com', 'admin.labuan@bankedge.com',
            'admin.putrajaya@bankedge.com'
        ]

        for username in admin_usernames:
            u = User(username=username, role='admin')
            u.set_password('Admin@123')
            db.session.add(u)

        # ---- Seed Edge Devices ----
        devs = seed_edge_devices()
        for d in devs:
            device = Device(
                id=d['id'],
                name=d['name'],
                location=d['location'],
                status='online',
                region=d['region'],
                last_sync=datetime.now(UTC8)
            )
            db.session.add(device)

        db.session.commit()

        return jsonify({'message': 'Database initialized and seeded successfully!'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("init-db failed")
        return jsonify({'error': str(e)}), 500

# ---------------------------
# System Management Data
# ---------------------------
@api_bp.route('/system-data', methods=['GET'])
@jwt_required()
def system_data():
    try:
        claims = get_jwt()
        if claims.get('role') != 'superadmin':
            return jsonify({'error': 'Unauthorized'}), 403

        # 1. Admins
        users = User.query.all()
        admins_data = []
        for u in users:
            admins_data.append({
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "status": "Active", # Mock status
                "lastLogin": u.last_login.isoformat() if u.last_login else "Never"
            })

        # 2. Edge Nodes
        nodes_data = get_hybrid_devices()

        # 3. ML Models (Mock)
        ml_models = [
            {"id": "model-001", "name": "FraudDetection_v1", "version": "1.0.0", "accuracy": "98.5%", "status": "Active"},
            {"id": "model-002", "name": "CreditScoring_v2", "version": "2.1.0", "accuracy": "96.2%", "status": "Staging"},
            {"id": "model-003", "name": "TxnClassifier_v3", "version": "3.0.1", "accuracy": "99.1%", "status": "Training"}
        ]

        # 4. Audit Logs (Mock)
        audit_logs = [
            {"id": 1, "action": "User Login", "user": "admin.kl@bankedge.com", "timestamp": "2023-10-27 09:15:00", "details": "Successful login from IP 192.168.1.10"},
            {"id": 2, "action": "Update Device", "user": "superadmin@bankedge.com", "timestamp": "2023-10-27 09:30:00", "details": "Updated firmware for edge-1"},
            {"id": 3, "action": "Create User", "user": "superadmin@bankedge.com", "timestamp": "2023-10-27 10:05:00", "details": "Created user admin.test@bankedge.com"}
        ]

        return jsonify({
            "admins": admins_data,
            "edgeNodes": nodes_data,
            "mlModels": ml_models,
            "auditLogs": audit_logs
        })

    except Exception as e:
        current_app.logger.exception("Failed to fetch system data")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/devices', methods=['GET'])
@jwt_required()
def get_devices():
    try:
        claims = get_jwt()
        role = claims.get('role')
        user_location = claims.get("userLocation", "").upper()

        target_device_id = None
        
        if role != 'superadmin':
            # Map region -> device id (Same logic as dashboard_data)
            locmap = {
                "JOHOR": "edge-1", "KEDAH": "edge-2", "KELANTAN": "edge-3",
                "MALACCA": "edge-4", "NEGERISEMBILAN": "edge-5", "PAHANG": "edge-6",
                "PENANG": "edge-7", "PERAK": "edge-8", "PERLIS": "edge-9",
                "SABAH": "edge-10", "SARAWAK": "edge-11", "SELANGOR": "edge-12",
                "TERENGGANU": "edge-13", "KL": "edge-14", "LABUAN": "edge-15",
                "PUTRAJAYA": "edge-16"
            }
            target_device_id = locmap.get(user_location)
            
            # If admin has no valid location mapping, return empty or error? 
            # Returning empty list is safer.
            if not target_device_id:
                return jsonify([])

        results = get_hybrid_devices(target_device_id)
        return jsonify(results)
    except Exception as e:
        current_app.logger.exception("Failed to fetch devices")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/devices/<string:device_id>/power', methods=['POST'])
@jwt_required()
def toggle_device_power(device_id):
    try:
        claims = get_jwt()
        role = claims.get('role')
        user_location = claims.get("userLocation", "").upper()

        # Authorization check
        if role != 'superadmin':
            locmap = {
                "JOHOR": "edge-1", "KEDAH": "edge-2", "KELANTAN": "edge-3",
                "MALACCA": "edge-4", "NEGERISEMBILAN": "edge-5", "PAHANG": "edge-6",
                "PENANG": "edge-7", "PERAK": "edge-8", "PERLIS": "edge-9",
                "SABAH": "edge-10", "SARAWAK": "edge-11", "SELANGOR": "edge-12",
                "TERENGGANU": "edge-13", "KL": "edge-14", "LABUAN": "edge-15",
                "PUTRAJAYA": "edge-16"
            }
            allowed_device_id = locmap.get(user_location)
            if device_id != allowed_device_id:
                return jsonify({'error': 'Unauthorized access to this device'}), 403

        device = db.session.get(Device, device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404

        # Toggle status
        new_status = 'offline' if device.status == 'online' else 'online'
        device.status = new_status
        db.session.commit()

        return jsonify({
            'message': f'Device {device.name} is now {new_status}',
            'status': new_status,
            'id': device.id
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Failed to toggle power")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/devices/<string:device_id>/sync', methods=['POST'])
@jwt_required()
def sync_device(device_id):
    try:
        claims = get_jwt()
        role = claims.get('role')
        user_location = claims.get("userLocation", "").upper()

        # Authorization check
        if role != 'superadmin':
            locmap = {
                "JOHOR": "edge-1", "KEDAH": "edge-2", "KELANTAN": "edge-3",
                "MALACCA": "edge-4", "NEGERISEMBILAN": "edge-5", "PAHANG": "edge-6",
                "PENANG": "edge-7", "PERAK": "edge-8", "PERLIS": "edge-9",
                "SABAH": "edge-10", "SARAWAK": "edge-11", "SELANGOR": "edge-12",
                "TERENGGANU": "edge-13", "KL": "edge-14", "LABUAN": "edge-15",
                "PUTRAJAYA": "edge-16"
            }
            allowed_device_id = locmap.get(user_location)
            if device_id != allowed_device_id:
                return jsonify({'error': 'Unauthorized access to this device'}), 403

        device = db.session.get(Device, device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404

        # Update last_sync
        device.last_sync = datetime.now(UTC8)
        db.session.commit()

        return jsonify({
            'message': f'Device {device.name} synced successfully',
            'lastSync': device.last_sync.isoformat(),
            'id': device.id
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Failed to sync device")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/ml-data', methods=['GET'])
@jwt_required()
def ml_data():
    try:
        # Real ML Metrics from DB
        metrics = []
        now = datetime.now(UTC8)
        
        # Calculate recent accuracy/confidence (Mock logic on real data)
        # In a real system, you'd compare prediction vs label.
        # Here we just aggregate what we saved.
        recent_txns = Transaction.query.order_by(Transaction.timestamp.desc()).limit(100).all()
        
        avg_confidence = 0.0
        if recent_txns:
            avg_confidence = sum([t.confidence for t in recent_txns if t.confidence]) / len(recent_txns)
            
        metrics.append({
            "timestamp": now.isoformat(),
            "accuracy": 0.95, 
            "avgConfidence": avg_confidence,
            "fraudDetected": len([t for t in recent_txns if t.processing_decision == 'flagged']),
            "processingTime": int(sum([t.latency for t in recent_txns]) / len(recent_txns)) if recent_txns else 0
        })

        # Transactions List
        transactions = []
        for t in recent_txns[:20]: # Limit to 20
            transactions.append({
                "id": t.id,
                "amount": t.amount,
                "type": t.type,
                "decision": t.processing_decision, # Renamed from mlPrediction
                "confidence": t.confidence,
                "deviceId": t.device_id
            })

        # Decisions (Edge vs Cloud)
        decisions = []
        for t in recent_txns[:20]:
            decisions.append({
                "decision": t.processing_decision, # Real value from ML model
                "dataType": "Transaction",
                "reason": "ML Model Inference",
                "size": 1, 
                "priority": "high" if t.amount > 1000 else "medium",
                "timestamp": t.timestamp.isoformat()
            })

        # Filter mock transactions based on role
        claims = get_jwt()
        role = claims.get('role')
        user_location = claims.get("userLocation", "").upper()
        
        locmap = {
            "JOHOR": "edge-1", "KEDAH": "edge-2", "KELANTAN": "edge-3",
            "MALACCA": "edge-4", "NEGERISEMBILAN": "edge-5", "PAHANG": "edge-6",
            "PENANG": "edge-7", "PERAK": "edge-8", "PERLIS": "edge-9",
            "SABAH": "edge-10", "SARAWAK": "edge-11", "SELANGOR": "edge-12",
            "TERENGGANU": "edge-13", "KL": "edge-14", "LABUAN": "edge-15",
            "PUTRAJAYA": "edge-16"
        }
        target_device_id = locmap.get(user_location)

        if role != 'superadmin' and target_device_id:
            # Filter transactions to only include those for the user's device
            transactions = [t for t in transactions if t['deviceId'] == target_device_id]

        return jsonify({
            "metrics": metrics,
            "transactions": transactions,
            "decisions": decisions
        })
    except Exception as e:
        current_app.logger.exception("Failed to fetch ML data")
        return jsonify({"error": str(e)}), 500

# ---------------------------
# User Management Endpoints
# ---------------------------

@api_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    try:
        claims = get_jwt()
        if claims.get('role') != 'superadmin':
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        location = data.get('location')
        password = data.get('password')
        
        # Hardcode role to 'admin' (Edge Admin) as per requirement
        role = 'admin'

        if not location or not password:
            return jsonify({'error': 'Location and password are required'}), 400

        # Generate base username
        base_username = f"admin.{location.lower()}@bankedge.com"
        username = base_username
        
        # Check for existence and auto-increment
        counter = 1
        while User.query.filter_by(username=username).first():
            counter += 1
            username = f"admin{counter}.{location.lower()}@bankedge.com"

        new_user = User(username=username, role=role)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'User created successfully', 'id': new_user.id, 'username': username}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Create user failed")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    try:
        claims = get_jwt()
        if claims.get('role') != 'superadmin':
            return jsonify({'error': 'Unauthorized'}), 403

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        password = data.get('password')
        role = data.get('role')

        if password:
            user.set_password(password)
        if role:
            user.role = role

        db.session.commit()
        return jsonify({'message': 'User updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Update user failed")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    try:
        claims = get_jwt()
        if claims.get('role') != 'superadmin':
            return jsonify({'error': 'Unauthorized'}), 403

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.role == 'superadmin':
             return jsonify({'error': 'Cannot delete superadmin'}), 400

        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Delete user failed")
        return jsonify({'error': str(e)}), 500