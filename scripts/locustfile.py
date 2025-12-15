import os
import time
import random
from locust import HttpUser, task, between, events
# Open http://localhost:8089 to control the test

class BankEdgeUser(HttpUser):
    wait_time = between(1, 3) # Simulated user think time
    token = None
    headers = {}

    def on_start(self):
        """Login once at the start of the session"""
        
        # Allow user to target specific region via env var
        # e.g. $env:LOCUST_USER="admin.pahang@bankedge.com"; locust ...
        target_user = os.environ.get("LOCUST_USER", "admin.kl@bankedge.com")
        
        try:
            response = self.client.post("/api/login", json={
                "username": target_user,
                "password": "Admin@123"
            })
            if response.status_code == 200:
                self.token = response.json().get('access_token')
                self.headers = {"Authorization": f"Bearer {self.token}"}
                print(f"Logged in as {target_user}")
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
            "reference": "LoadTest"
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
