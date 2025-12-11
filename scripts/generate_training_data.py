import pandas as pd
import numpy as np
import random
import os

# Create Data Directory
if not os.path.exists('ml_data'):
    os.makedirs('ml_data')

def generate_data(num_samples=10000):
    print(f"Generating {num_samples} synthetic transaction records...")
    
    data = []
    
    txn_types = ['Transfer', 'Payment', 'Withdrawal', 'Deposit']
    
    for i in range(num_samples):
        # 1. Feature: Amount (Skewed)
        if random.random() < 0.7:
            amount = round(random.uniform(10.0, 500.0), 2)
        else:
            amount = round(random.uniform(500.0, 10000.0), 2)
            
        # 2. Feature: Transaction Type
        txn_type = random.choice(txn_types)
        
        # 3. Feature: Latency (Network conditions)
        latency = int(np.random.gamma(shape=2.0, scale=10.0))
        
        # 4. Feature: User Pattern (Frequency of similar txns)
        # 0 = New/Rare, 10+ = Frequent/Daily
        txn_count_last_30d = int(np.random.exponential(scale=5))
        
        # 5. Feature: Edge Device Load (0-100%)
        device_load = random.uniform(10, 95)
        
        # --- SOPHISTICATED LABELING LOGIC ---
        
        label = 'edge' # Default preference (Lower latency)
        
        # Rule A: Load Balancing (Traffic)
        # If Edge is overloaded, offload to Cloud regardless of other factors
        if device_load > 85:
            label = 'cloud'
            reason = 'High Edge Load'
            
        # Rule B: Security / Amount Rules
        else:
            # Complex/Secure transactions default to Cloud
            if txn_type == 'Withdrawal' and amount > 1000:
                label = 'cloud'
                reason = 'Large Withdrawal'
            
            elif amount > 3000:
                # Large amount usually Cloud...
                label = 'cloud'
                reason = 'Large Amount'
                
                # ...BUT if User is TRUSTED (Frequent), we keep it at Edge (Pattern Learning)
                if txn_count_last_30d > 15:
                    label = 'edge'
                    reason = 'Trusted Pattern (High Freq)'
            
            # Rule C: Latency Constraints
            # If latency is high, Edge might be unstable? Or Cloud unreachable?
            # Let's say if latency is extremly high, we force Cloud (assuming Edge is struggling)
            if latency > 80:
                label = 'cloud'
                reason = 'High Latency'
                
        # Rule D: Random Fraud Simulation (Flagged)
        # 0.5% chance to be flagged as fraud
        if random.random() < 0.005:
            label = 'flagged'

        data.append({
            'amount': amount,
            'type': txn_type,
            'latency': latency,
            'txn_count_last_30d': txn_count_last_30d,
            'device_load': device_load,
            'processing_decision': label
        })
        
    df = pd.DataFrame(data)
    
    # Save to CSV
    output_path = 'ml_data/synthetic_transactions.csv'
    df.to_csv(output_path, index=False)
    print(f"Data saved to {output_path}")
    print(df.head())
    print("\nClass Distribution:")
    print(df['processing_decision'].value_counts())

if __name__ == "__main__":
    generate_data()
