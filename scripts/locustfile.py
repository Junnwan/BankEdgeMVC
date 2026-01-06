import os
import time
import random
from locust import HttpUser, task, between, events
# Open http://localhost:8089 to control the test

import sqlite3

class BankEdgeUser(HttpUser):
    wait_time = between(1, 3) # Simulated user think time
    token = None
    headers = {}

    def get_latest_user_from_db(self):
        """Fetches the most recently logged-in user from the local database."""
        try:
            # Connect to DB (assuming running from project root)
            db_path = "bankedge.db"
            if not os.path.exists(db_path):
                # Fallback if running from scripts folder
                db_path = "../bankedge.db"
            
            if not os.path.exists(db_path):
                print("Warning: bankedge.db not found. Using default user.")
                return None

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Get the user who logged in most recently
            cursor.execute("SELECT username FROM user ORDER BY last_login DESC LIMIT 1")
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return result[0]
        except Exception as e:
            print(f"DB Read Error: {e}")
        return None

    def on_start(self):
        """Login once at the start of the session"""
        
        # --- STRATEGY 1: BEST PRACTICE (Uncomment or use Env Var) ---
        # For AWS testing, it is best to be explicit.
        target_user = "admin.kl@bankedge.com" 
        # target_user = os.environ.get("LOCUST_USER")
        
        # --- STRATEGY 2: CONVENIENCE (DISABLED for Cloud Testing) ---
        if not target_user:
            active_user = self.get_latest_user_from_db()
            if active_user:
                print(f"Auto-detected active dashboard user: {active_user}")
                target_user = active_user
        
        # --- STRATEGY 3: FALLBACK ---
        if not target_user:
            target_user = "admin.johor@bankedge.com"

        try:
            response = self.client.post("/api/login", json={
                "username": target_user,
                "password": "Admin@123"
            })
            if response.status_code == 200:
                self.token = response.json().get('access_token')
                self.headers = {"Authorization": f"Bearer {self.token}"}
                print(f"--> Locust simulating traffic for: {target_user}")
            else:
                print(f"Login failed for {target_user}:", response.text)
        except Exception as e:
            print("Login error:", e)

    @task
    def process_transaction(self):
        if not self.token:
            return

        # Randomize amount to trigger both Cloud (>5k) and Edge (<5k) logic
        # 70% chance of Edge (Low amount), 30% chance of Cloud (High amount)
        if random.random() < 0.7:
             amount = random.randint(100, 4999) # Edge
        else:
             amount = random.randint(5001, 15000) # Cloud

        # Fake PaymentIntent ID
        fake_pi_id = f"pi_sim_{int(time.time()*1000)}_{random.randint(1000,9999)}"

        payload = {
            "amount": amount,
            "merchant": "Locust Load Test",
            "region": "KL",
            "payment_intent": fake_pi_id,
            "recipient_account": "1234567890", 
            "reference": "LoadTest",
            
            # --- UT-07 PROOF: Inject Latency ---
            # 10% of traffic mimics high network delay (>300ms) to trigger Cloud Offloading
            "latency": random.randint(300, 500) if random.random() < 0.1 else random.randint(5, 20)
        }

        # We assume the decision logic (Edge/Cloud) happens on the server 
        # based on the 'amount' and other factors.
        # We just measure how long it takes.
        
        with self.client.post("/api/payment-success", json=payload, headers=self.headers, catch_response=True) as response:
            if response.status_code == 200:
                # You can assert checks here if needed
                pass
            else:
                response.failure(f"Failed with {response.status_code}: {response.text}")
