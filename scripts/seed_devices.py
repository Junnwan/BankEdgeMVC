import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from models import db, Device, User, UTC8
from datetime import datetime

def seed_devices():
    with app.app_context():
        # --- 1. Seed Devices ---
        if not Device.query.first():
            print("Seeding Devices...")
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
        else:
            print("Devices already exist. Skipping device seed.")

        # --- 2. Seed Users (Admins for each Region) ---
        print("Checking/Seeding Users...")
        devices = Device.query.all()
        user_count = 0
        
        for d in devices:
            # Create a standard email: admin.kl@bankedge.com, admin.johor@bankedge.com
            # We map "JOHOR" -> "johor", "KL" -> "kl"
            region_slug = d.region.lower()
            email = f"admin.{region_slug}@bankedge.com"

            if not User.query.filter_by(username=email).first():
                user = User(username=email, role='admin', balance=100000.0)
                user.set_password("Admin@123")
                db.session.add(user)
                user_count += 1
                print(f"Created user: {email}")

        # --- 3. Seed SuperAdmin ---
        if not User.query.filter_by(username="superadmin@bankedge.com").first():
            sa = User(username="superadmin@bankedge.com", role="superadmin", balance=500000.0)
            sa.set_password("Admin@123")
            db.session.add(sa)
            user_count += 1
            print("Created SuperAdmin")

        if user_count > 0:
            db.session.commit()
            print(f"Seeded {user_count} new users.")
        else:
            print("All users already exist.")

if __name__ == "__main__":
    seed_devices()
