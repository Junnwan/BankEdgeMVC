# This is the full content for app.py

import os
from flask import Flask, render_template
from controllers.api_controller import api_bp
from extensions import db, bcrypt  # <-- NEW: Import extensions
from models import User, Device, Transaction  # <-- NEW: Import models

app = Flask(__name__)

# --- NEW: Database Configuration ---
basedir = os.path.abspath(os.path.dirname(__file__))
# This configures a simple SQLite database file named 'bankedge.db' in your project root
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'bankedge.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- NEW: Initialize Extensions ---
db.init_app(app)
bcrypt.init_app(app)

# Register Blueprints
app.register_blueprint(api_bp)

# --- Routes ---
@app.route('/')
def login():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('index.html', title='Dashboard')

@app.route('/edge-devices')
def edge_devices_route():
    return render_template('edge_devices.html', title='Edge Devices')

@app.route('/ml-insights')
def ml_insights():
    return render_template('ml_insights.html', title='ML Insights')

@app.route('/transactions')
def transactions():
    return render_template('transactions.html', title='Transaction Processing')

@app.route('/system-management')
def system_management():
    return render_template('system_management.html', title='System Management')

# --- NEW: Create database tables ---
# This block checks if the bankedge.db file exists. If not, it creates it.
with app.app_context():
    if not os.path.exists(os.path.join(basedir, 'bankedge.db')):
        print("Creating database tables...")
        db.create_all()
        print("Database created.")

if __name__ == '__main__':
    app.run(debug=True)