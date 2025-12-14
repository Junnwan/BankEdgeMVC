import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '../bankedge.db')

def migrate_db():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Add balance to user table
        try:
            cursor.execute("ALTER TABLE user ADD COLUMN balance FLOAT DEFAULT 100000.0")
            print("Added 'balance' column to 'user' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e):
                print("'balance' column already exists in 'user' table.")
            else:
                print(f"Error adding 'balance' to 'user': {e}")

        # Add old_balance_org to transaction table
        try:
            cursor.execute("ALTER TABLE 'transaction' ADD COLUMN old_balance_org FLOAT DEFAULT 0.0")
            print("Added 'old_balance_org' column to 'transaction' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e):
                print("'old_balance_org' column already exists in 'transaction' table.")
            else:
                print(f"Error adding 'old_balance_org': {e}")

        # Add new_balance_org to transaction table
        try:
            cursor.execute("ALTER TABLE 'transaction' ADD COLUMN new_balance_org FLOAT DEFAULT 0.0")
            print("Added 'new_balance_org' column to 'transaction' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e):
                print("'new_balance_org' column already exists in 'transaction' table.")
            else:
                print(f"Error adding 'new_balance_org': {e}")

        # Add is_fraud to transaction table
        try:
            cursor.execute("ALTER TABLE 'transaction' ADD COLUMN is_fraud BOOLEAN DEFAULT 0")
            print("Added 'is_fraud' column to 'transaction' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e):
                print("'is_fraud' column already exists in 'transaction' table.")
            else:
                print(f"Error adding 'is_fraud': {e}")

        conn.commit()
        print("Database migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_db()
