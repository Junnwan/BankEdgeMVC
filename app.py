import os
import stripe
from flask import Flask, render_template
from flask_jwt_extended import JWTManager
from models import db, bcrypt
from controllers.api_controller import api_bp
from controllers.transactions_controller import transactions_bp

app = Flask(__name__)

# --- Configuration ---
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'bankedge.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET', 'dev-secret-key')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')

# Stripe Config
app.config['STRIPE_PUBLISHABLE_KEY'] = os.environ.get('STRIPE_PUBLISHABLE_KEY', '') # Example placeholder if env not set, but better to rely on env
app.config['STRIPE_SECRET_KEY'] = os.environ.get('STRIPE_SECRET_KEY', '')

stripe.api_key = app.config['STRIPE_SECRET_KEY']

# --- Initialize Extensions ---
db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)

# --- Register Blueprints ---
app.register_blueprint(api_bp)
app.register_blueprint(transactions_bp)

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

@app.route("/transactions")
def transactions_page():
    return render_template("transactions.html")

@app.route('/system-management')
def system_management():
    return render_template('system_management.html', title='System Management')

# --- Create DB if missing ---
with app.app_context():
    if not os.path.exists(os.path.join(basedir, 'bankedge.db')):
        print("Creating database and tables...")
        db.create_all()
        print("Database created.")

if __name__ == '__main__':
    app.run(debug=True)
