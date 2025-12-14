
import pandas as pd
import sqlite3
import os
import sys
from datetime import datetime

# Adjust path if needed
DB_PATH = os.path.join(os.getcwd(), 'bankedge.db')

def import_csv(csv_path):
    if not os.path.exists(csv_path):
        print(f"Error: File not found at {csv_path}")
        return

    print(f"Reading {csv_path}...")
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    # --- Column Mapping & Cleaning ---
    print("Mapping columns...")
    
    # Map 'processed_at' -> 'processing_decision' if needed
    if 'processing_decision' not in df.columns and 'processed_at' in df.columns:
        print("Renaming 'processed_at' to 'processing_decision'...")
        df.rename(columns={'processed_at': 'processing_decision'}, inplace=True)
        
    # Drop 'ml_prediction' if exists (not in DB anymore)
    if 'ml_prediction' in df.columns:
        print("Dropping 'ml_prediction' (legacy)...")
        df.drop(columns=['ml_prediction'], inplace=True)

    # Ensure all required DB columns exist in DF, fill missing with defaults
    required_cols = {
        'id': 'unknown_id', 
        'amount': 0.0, 
        'stripe_status': 'failed', 
        'processing_decision': 'cloud',
        'timestamp': datetime.now().isoformat()
    }
    
    for col, default in required_cols.items():
        if col not in df.columns:
            print(f"Warning: Missing column '{col}'. Filling with default: {default}")
            df[col] = default

    # Optional columns - fill with None if missing
    optional_cols = [
        'old_balance_org', 'new_balance_org', 'is_fraud', 
        'recipient_account', 'reference', 'merchant_name', 
        'device_id', 'type', 'customer_id', 'confidence', 'latency'
    ]
    
    for col in optional_cols:
        if col not in df.columns:
            df[col] = None

    # Connect to DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Prepare data for insertion
    # We'll use a list of tuples for executemany
    # Ensure column order matches the DB insert statement
    
    # Final list of columns to insert
    db_columns = [
        'id', 'amount', 'stripe_status', 'processing_decision', 'timestamp',
        'old_balance_org', 'new_balance_org', 'is_fraud', 'recipient_account',
        'reference', 'merchant_name', 'device_id', 'type', 'customer_id',
        'confidence', 'latency'
    ]
    
    # Filter DF to only these columns
    df_final = df[db_columns]
    
    records = df_final.values.tolist()
    
    print(f"Importing {len(records)} records into 'transaction' table...")
    
    try:
        cursor.executemany(f'''
            INSERT OR REPLACE INTO "transaction" ({", ".join(db_columns)})
            VALUES ({", ".join(['?']*len(db_columns))})
        ''', records)
        
        conn.commit()
        print("Import successful!")
        
    except Exception as e:
        print(f"Database Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_transactions.py <path_to_csv>")
    else:
        import_csv(sys.argv[1])
