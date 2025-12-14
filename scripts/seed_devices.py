import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from models import db, Device, UTC8
from datetime import datetime

def seed_devices():
    with app.app_context():
        # Check if devices exist
        if Device.query.first():
            print("Devices already exist. Skipping seed.")
            return

        devices = [
            Device(id="edge-1", name="Edge Node Johor", location="Johor", region="JOHOR"),
            Device(id="edge-2", name="Edge Node Kedah", location="Kedah", region="KEDAH"),
            Device(id="edge-3", name="Edge Node Kelantan", location="Kelantan", region="KELANTAN"),
            Device(id="edge-4", name="Edge Node Malacca", location="Malacca", region="MALACCA"),
            Device(id="edge-5", name="Edge Node Negeri Sembilan", location="Negeri Sembilan", region="NEGERISEMBILAN"),
            Device(id="edge-6", name="Edge Node Pahang", location="Pahang", region="PAHANG"),
            Device(id="edge-7", name="Edge Node Penang", location="Penang", region="PENANG"),
            Device(id="edge-8", name="Edge Node Perak", location="Perak", region="PERAK"),
            Device(id="edge-9", name="Edge Node Perlis", location="Perlis", region="PERLIS"),
            Device(id="edge-10", name="Edge Node Sabah", location="Sabah", region="SABAH"),
            Device(id="edge-11", name="Edge Node Sarawak", location="Sarawak", region="SARAWAK"),
            Device(id="edge-12", name="Edge Node Selangor", location="Selangor", region="SELANGOR"),
            Device(id="edge-13", name="Edge Node Terengganu", location="Terengganu", region="TERENGGANU"),
            Device(id="edge-14", name="Edge Node KL", location="Kuala Lumpur", region="KL"),
            Device(id="edge-15", name="Edge Node Labuan", location="Labuan", region="LABUAN"),
            Device(id="edge-16", name="Edge Node Putrajaya", location="Putrajaya", region="PUTRAJAYA"),
        ]

        db.session.add_all(devices)
        db.session.commit()
        print(f"Seeded {len(devices)} devices.")

if __name__ == "__main__":
    seed_devices()
