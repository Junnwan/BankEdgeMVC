
import sqlite3
import os

DB_PATH = os.path.join(os.getcwd(), 'bankedge.db')

def migrate_robust():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("Starting robust migration (Copy Table Method)...")
        
        # 1. Create new table
        print("Creating 'transaction_new'...")
        cursor.execute('''
            CREATE TABLE transaction_new (
                id VARCHAR(100) NOT NULL, 
                amount FLOAT NOT NULL, 
                stripe_status VARCHAR(20) NOT NULL, 
                processing_decision VARCHAR(20), 
                timestamp DATETIME NOT NULL, 
                old_balance_org FLOAT, 
                new_balance_org FLOAT, 
                is_fraud BOOLEAN, 
                recipient_account VARCHAR(150), 
                reference VARCHAR(200), 
                merchant_name VARCHAR(100), 
                device_id VARCHAR(50), 
                type VARCHAR(50), 
                customer_id VARCHAR(150), 
                confidence FLOAT, 
                latency FLOAT, 
                PRIMARY KEY (id), 
                FOREIGN KEY(device_id) REFERENCES device (id)
            )
        ''')

        # 2. Copy data
        # We need to explicitly map old columns to new ones
        # processed_at -> processing_decision
        # ml_prediction -> DROPPED (not selected)
        print("Copying data...")
        cursor.execute('''
            INSERT INTO transaction_new (
                id, amount, stripe_status, processing_decision, timestamp, 
                old_balance_org, new_balance_org, is_fraud, recipient_account, 
                reference, merchant_name, device_id, type, customer_id, 
                confidence, latency
            )
            SELECT 
                id, amount, stripe_status, processed_at, timestamp, 
                old_balance_org, new_balance_org, is_fraud, recipient_account, 
                reference, merchant_name, device_id, type, customer_id, 
                confidence, latency
            FROM "transaction"
        ''')

        # 3. Drop old table
        print("Dropping old table...")
        cursor.execute('DROP TABLE "transaction"')

        # 4. Rename new table
        print("Renaming new table...")
        cursor.execute('ALTER TABLE transaction_new RENAME TO "transaction"')

        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_robust()
