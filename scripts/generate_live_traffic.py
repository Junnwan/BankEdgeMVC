import requests
import random
import time
import sys

# Usage: python scripts/generate_live_traffic.py <ALB_URL>
# Example: python scripts/generate_live_traffic.py http://bankedge-alb-....amazonaws.com


def generate_traffic(base_url, count=50):
    print(f"🚀 Targeting: {base_url}")
    print(f"generating {count} transactions...")

    # 1. Login to get Token
    session = requests.Session()
    try:
        login_resp = session.post(f"{base_url}/api/login", json={
            "username": "admin.kl@bankedge.com",
            "password": "Admin@123"
        })
        if login_resp.status_code != 200:
            print("❌ Login Failed:", login_resp.text)
            return
            
        token = login_resp.json().get('access_token')
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login Successful")

    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return

    # 2. Generate Transactions
    success = 0
    for i in range(count):
        amount = random.randint(10, 5000)
        
        # Simulate different scenarios
        if i % 10 == 0:
            amount = 9999 # High value (Likely Cloud)
        
        payload = {
            "amount": amount,
            "merchant": "Test Merchant AWS",
            "region": "KL"
        }

        try:
            # We use payment-success to actually SAVE the data to the DB
            # We generate a fake PaymentIntent ID since we are simulating
            fake_pi_id = f"pi_sim_{int(time.time())}_{i}"
            
            payload["payment_intent"] = fake_pi_id
            
            r = session.post(f"{base_url}/api/payment-success", json=payload, headers=headers)
            
            if r.status_code == 200:
                print(f"[{i+1}/{count}] 💰 ${amount} -> SAVED ✅")
                success += 1
            else:
                print(f"[{i+1}/{count}] ❌ Failed: {r.status_code} {r.text}")
                
        except Exception as e:
            print(f"Error: {e}")
            
        time.sleep(0.2) # Fast burst

    print(f"\n✨ Done! Generated {success} transactions.")
    print("Go check your Dashboard now!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate_live_traffic.py <URL>")
        sys.exit(1)
    
    url = sys.argv[1].rstrip('/')
    generate_traffic(url)
