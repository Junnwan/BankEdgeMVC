from flask import Blueprint, render_template, session, redirect, url_for
import random
from datetime import datetime, timedelta, timezone

edge_bp = Blueprint('edge', __name__)

# --- Mock Data Generation Functions (Based on EdgeDevices.tsx) ---
def generate_device_id(i):
    return f"NODE-EDGE-{i:03d}"

REGIONS = ['Malaysia']
LOCATIONS = [
    'johor', 'kedah', 'kelantan', 'malacca', 'negerisembilan', 'pahang',
    'penang', 'perak', 'perlis', 'sabah', 'sarawak', 'selangor',
    'terengganu', 'kl', 'labuan', 'putrajaya'
]
STATUS_CHOICES = ['online', 'warning', 'offline']
SYNC_STATUS_CHOICES = ['synced', 'outdated', 'pending']

def generate_edge_devices(num_devices=16):
    """Generates a list of mock edge device data."""
    devices = []

    # Ensure one device is guaranteed to be 'offline' for visualization
    offline_index = random.randint(0, num_devices - 1)

    for i in range(num_devices):
        location = LOCATIONS[i]
        device_id = generate_device_id(i)

        # Determine status and derived metrics
        status = 'offline' if i == offline_index else random.choice(STATUS_CHOICES)
        load = random.randint(10, 95)

        if status == 'offline':
            load = 0
            latency = 999
            tps = 0
            sync_status = 'outdated'
            last_sync_delta = random.randint(30, 120)
        else:
            latency = random.randint(10, 50)
            tps = random.randint(100, 500)
            sync_status = random.choice(SYNC_STATUS_CHOICES)
            # Ensure last sync time is reasonable (1 to 15 minutes ago)
            last_sync_delta = random.randint(1, 15)

        # Calculate time relative to current moment
        last_sync = datetime.now(timezone.utc) - timedelta(minutes=last_sync_delta)

        device = {
            'id': device_id,
            'name': f"Edge Node {location.capitalize()}",
            'location': location.capitalize(),
            'region': random.choice(REGIONS),
            'status': status,
            'load': load,
            'latency': latency,
            'transactionsPerSec': tps,
            'lastSync': last_sync.isoformat(), # Use ISO format for Jinja filter
            'syncStatus': sync_status
        }
        devices.append(device)

    return devices

def get_device_summary(devices):
    """Calculates summary statistics for the displayed devices."""
    if not devices:
        return {'online_nodes': 0, 'avg_load': 0, 'regions': 0}

    online_nodes = sum(1 for d in devices if d['status'] == 'online')
    active_devices = [d for d in devices if d['status'] != 'offline']

    avg_load = sum(d['load'] for d in active_devices) / len(active_devices) if active_devices else 0
    regions = len(set(d['region'] for d in devices))

    return {
        'online_nodes': online_nodes,
        'avg_load': round(avg_load, 1),
        'regions': regions
    }
# -------------------------------------------------------------

@edge_bp.route('/edge-devices')
def edge_devices():
    # Enforce authentication
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    # Generate fresh mock data every time the page is loaded
    all_devices = generate_edge_devices(num_devices=16)

    user_role = session.get('role')
    user_username = session.get('username', '')
    devices = []
    user_location = None

    # Role-based filtering logic
    if user_role == 'admin':
        # Extract location from username (e.g., admin.johor@bankedge.com -> johor)
        try:
            location_part = user_username.split('@')[0].split('.')[-1]
            user_location = location_part.capitalize()
            # Filter devices for the specific location
            devices = [d for d in all_devices if d['location'].lower() == location_part]
        except:
            devices = all_devices # Fallback if username format is unexpected

    else: # superadmin or any other role
        user_location = 'All Regions'
        devices = all_devices

    summary = get_device_summary(devices)

    return render_template('edge_devices.html', devices=devices, summary=summary, user_location=user_location)