from flask import Flask, render_template, request, redirect, url_for, session, flash, get_flashed_messages
from datetime import datetime, timedelta, timezone
import random
import re

# Import Blueprints (controllers)
from controllers.edge_controller import edge_bp
from controllers.transaction_controller import transaction_bp
from controllers.ml_controller import ml_bp
# We still import generate_edge_devices here, which is fine as it's used below
from controllers.edge_controller import generate_edge_devices

app = Flask(__name__)
app.secret_key = 'your_super_secret_key' # Needed for session management, flash messages

# --- GLOBAL CONSTANTS & MOCK DATA ---
VALID_CREDENTIALS = [
    {'username': 'superadmin@bankedge.com', 'password': 'SuperAdmin@123', 'role': 'superadmin'},
    {'username': 'admin.johor@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.kedah@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.kelantan@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.malacca@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.negerisembilan@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.pahang@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.penang@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.perak@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.perlis@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.sabah@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.sarawak@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.selangor@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.terengganu@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.kl@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.labuan@bankedge.com', 'password': 'Admin@123', 'role': 'admin'},
    {'username': 'admin.putrajaya@bankedge.com', 'password': 'Admin@123', 'role': 'admin'}
]

LOCATIONS = [
    'johor', 'kedah', 'kelantan', 'malacca', 'negerisembilan', 'pahang',
    'penang', 'perak', 'perlis', 'sabah', 'sarawak', 'selangor',
    'terengganu', 'kl', 'labuan', 'putrajaya'
]

# --- JINJA2 FILTERS ---
def time_format(value):
    return value.strftime('%I:%M %p')

def from_iso(value):
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return datetime.strptime(value.split('.')[0], "%Y-%m-%dT%H:%M:%S")
    return value

def format_currency(value):
    return f"{value:,.2f}"

app.jinja_env.filters['time_format'] = time_format
app.jinja_env.filters['from_iso'] = from_iso
app.jinja_env.filters['format_currency'] = format_currency
# ----------------------------------------------------

# --- MOCK DATA GENERATORS (for /settings page) ---
def generate_admins():
    return [
        {
            'id': 'adm_001',
            'username': 'admin.kl@bankedge.com',
            'role': 'admin',
            'email': 'admin.kl@bankedge.com',
            'createdAt': '2025-01-15T08:00:00Z',
            'lastLogin': '2025-10-28T09:30:00Z',
            'status': 'active',
            'apiKey': 'sk_live_abc123xyz789'
        },
        {
            'id': 'adm_002',
            'username': 'superadmin@bankedge.com',
            'role': 'superadmin',
            'email': 'superadmin@bankedge.com',
            'createdAt': '2025-01-01T08:00:00Z',
            'lastLogin': '2025-10-28T10:15:00Z',
            'status': 'active',
            'apiKey': 'sk_live_def456uvw012'
        },
        {
            'id': 'adm_003',
            'username': 'admin.penang@bankedge.com',
            'role': 'admin',
            'email': 'admin.penang@bankedge.com',
            'createdAt': '2025-02-20T08:00:00Z',
            'lastLogin': '2025-10-27T16:45:00Z',
            'status': 'active',
            'apiKey': 'sk_live_ghi789rst345'
        }
    ]

def generate_audit_logs():
    return [
        {
            'id': 'log_001',
            'timestamp': '2025-10-28T10:15:32Z',
            'user': 'superadmin@bankedge.com',
            'action': 'LOGIN',
            'resource': 'Authentication',
            'status': 'success',
            'ipAddress': '203.106.94.23'
        },
        {
            'id': 'log_002',
            'timestamp': '2025-10-28T10:14:18Z',
            'user': 'admin.kl@bankedge.com',
            'action': 'UPDATE_MODEL',
            'resource': 'ML Model v2.4.1',
            'status': 'success',
            'ipAddress': '118.107.46.89'
        },
        {
            'id': 'log_003',
            'timestamp': '2025-10-28T10:10:05Z',
            'user': 'admin.penang@bankedge.com',
            'action': 'TRIGGER_SYNC',
            'resource': 'Edge Node PENANG-01',
            'status': 'success',
            'ipAddress': '60.53.218.142'
        },
        {
            'id': 'log_004',
            'timestamp': '2025-10-28T09:58:23Z',
            'user': 'superadmin@bankedge.com',
            'action': 'CREATE_ADMIN',
            'resource': 'User: admin.johor@bankedge.com',
            'status': 'success',
            'ipAddress': '203.106.94.23'
        },
        {
            'id': 'log_005',
            'timestamp': '2025-10-28T09:45:12Z',
            'user': 'admin.kl@bankedge.com',
            'action': 'FAILED_LOGIN',
            'resource': 'Authentication',
            'status': 'failed',
            'ipAddress': '118.107.46.89'
        }
    ]

def generate_ml_models():
    return [
        {
            'id': 'model_001',
            'version': 'v2.4.1',
            'uploadedAt': '2025-10-28T08:00:00Z',
            'uploadedBy': 'superadmin@bankedge.com',
            'size': '4.2 MB',
            'status': 'active',
            'accuracy': 96.8,
            'deployedNodes': 16
        },
        {
            'id': 'model_002',
            'version': 'v2.4.0',
            'uploadedAt': '2025-10-20T08:00:00Z',
            'uploadedBy': 'admin.kl@bankedge.com',
            'size': '4.1 MB',
            'status': 'archived',
            'accuracy': 95.2,
            'deployedNodes': 0
        },
        {
            'id': 'model_003',
            'version': 'v2.5.0-beta',
            'uploadedAt': '2025-10-27T14:30:00Z',
            'uploadedBy': 'superadmin@bankedge.com',
            'size': '4.5 MB',
            'status': 'pending',
            'accuracy': 97.1,
            'deployedNodes': 3
        }
    ]

def generate_transactions_index(count=5, all_devices=None):
    transactions = []
    transaction_types = ['transfer', 'withdrawal', 'purchase']
    predictions = ['approved', 'flagged']
    device_ids = [d['id'] for d in all_devices] if all_devices else [f"NODE-EDGE-{i:03d}" for i in range(len(LOCATIONS))]

    for i in range(count):
        prediction = random.choice(predictions)
        latency = random.randint(10, 50) if prediction == 'approved' else random.randint(50, 150)
        transactions.append({
            'id': f"TXN-{i:03d}",
            'amount': random.randint(100, 10000),
            'type': random.choice(transaction_types),
            'mlPrediction': prediction,
            'latency': latency,
            'deviceId': random.choice(device_ids)
        })
    return transactions

def generate_latency_history(count=30):
    """MOCK function for latency data, used on the dashboard."""
    latency_data = []
    base_time = datetime.now(timezone.utc) - timedelta(minutes=count * 5)
    for i in range(count):
        t = base_time + timedelta(minutes=i * 5)
        # Values based on Overview.tsx mock data
        latency_data.append({
            'timestamp': t.isoformat(),
            'edge': random.randint(10, 25),
            'cloud': random.randint(80, 120),
            'hybrid': random.randint(35, 55)
        })
    return latency_data

# --------------------------------------------------------------------

# --- AUTHENTICATION FUNCTIONS ---
def validate_email(email):
    return email.endswith('@bankedge.com')

def validate_password(password):
    has_capital = re.search(r'[A-Z]', password)
    has_small = re.search(r'[a-z]', password)
    has_symbol = re.search(r'[^A-Za-z0-9]', password)
    return bool(has_capital and has_small and has_symbol)
# --------------------------------

# --- ROUTES ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        error = None

        if not validate_email(username):
            error = 'Email must end with @bankedge.com'
        elif not validate_password(password):
            error = 'Password must contain at least one capital letter, one small letter, and one symbol'
        else:
            valid_user = next((cred for cred in VALID_CREDENTIALS if cred['username'] == username and cred['password'] == password), None)

            if valid_user:
                session['logged_in'] = True
                session['username'] = valid_user['username']
                session['role'] = valid_user['role']
                return redirect(url_for('index'))
            else:
                error = 'Invalid credentials. Please check your username and password.'

        return render_template('login.html', error=error)

    if 'logged_in' in session and session['logged_in']:
        return redirect(url_for('index'))

    return render_template('login.html')

@app.route('/')
def index():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    user_role = session.get('role')
    user_username = session.get('username', '')

    from controllers.edge_controller import generate_edge_devices # Imports generate_edge_devices

    all_devices = generate_edge_devices(num_devices=16)
    latency_history = generate_latency_history(count=30) # Calls local function
    all_transactions = generate_transactions_index(count=5, all_devices=all_devices)

    user_location = None
    devices = []
    recent_transactions = []

    # Filtering logic based on user role
    if user_role == 'admin':
        try:
            location_part = user_username.split('@')[0].split('.')[-1].capitalize()
            user_location = location_part

            devices = [d for d in all_devices if d['location'] == user_location]
            location_device_ids = [d['id'] for d in devices]
            recent_transactions = [t for t in all_transactions if t.get('deviceId') in location_device_ids]
        except:
            devices = all_devices
            recent_transactions = all_transactions

    else: # superadmin
        devices = all_devices
        recent_transactions = all_transactions

    # Calculate Summary Metrics
    active_devices = [d for d in devices if d['status'] != 'offline']

    avg_latency = sum(d['latency'] for d in active_devices) / len(active_devices) if active_devices else 0
    total_tps = sum(d['transactionsPerSec'] for d in devices)
    online_devices = sum(1 for d in devices if d['status'] == 'online')

    baseline_latency = 120
    latency_reduction = ((baseline_latency - avg_latency) / baseline_latency * 100) if avg_latency < baseline_latency else 0

    data = {
        'userLocation': user_location if devices and user_location and user_role == 'admin' else None,
        'devices': devices,
        'latencyData': latency_history,
        'recentTransactions': recent_transactions,
        'avgLatency': round(avg_latency, 2),
        'totalTPS': round(total_tps, 2),
        'onlineDevices': online_devices,
        'totalDevices': len(devices),
        'latencyReduction': round(latency_reduction, 2),
        'mlAccuracy': 96.88,
        'current_time': datetime.now() # Passes current datetime object to template
    }

    return render_template('index.html', **data)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    session.pop('username', None)
    session.pop('role', None)
    return redirect(url_for('login'))


@app.route('/settings')
def settings():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    # RBAC check: Only SuperAdmin can view
    if session.get('role') != 'superadmin':
        flash('Access Denied: Only SuperAdmins can view System Management.', 'error')
        return redirect(url_for('index'))

    # Import locally to avoid circular dependency
    from controllers.edge_controller import generate_edge_devices

    # Generate data
    admins = generate_admins()
    audit_logs = generate_audit_logs()
    ml_models = generate_ml_models()
    edge_nodes = generate_edge_devices(num_devices=16)

    data = {
        'admins': admins,
        'audit_logs': audit_logs,
        'ml_models': ml_models,
        'edge_nodes': edge_nodes,
        'total_nodes': len(edge_nodes),
        'online_nodes': sum(1 for n in edge_nodes if n['status'] == 'online'),
        'total_admins': len(admins),
        'active_admins': sum(1 for a in admins if a['status'] == 'active'),
        'total_models': len(ml_models),
        'active_models': sum(1 for m in ml_models if m['status'] == 'active'),
        'total_logs': len(audit_logs)
    }
    return render_template('system_management.html', **data)


# Register Blueprints (controllers)
app.register_blueprint(edge_bp)
app.register_blueprint(transaction_bp)
app.register_blueprint(ml_bp)

if __name__ == '__main__':
    app.run(debug=True)