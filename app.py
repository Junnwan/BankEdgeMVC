import os
from flask import Flask, render_template
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from datetime import timedelta
from models import db, bcrypt
from controllers.api_controller import api_bp
from controllers.transactions_controller import transactions_bp

# -------------------------------------------------
# Load environment variables
# -------------------------------------------------
load_dotenv()

app = Flask(__name__)

# -------------------------------------------------
# Flask Configuration
# -------------------------------------------------
basedir = os.path.abspath(os.path.dirname(__file__))

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///' + os.path.join(basedir, 'bankedge.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Secrets
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET', 'dev-secret-key')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')

# Stripe (keys only stored – logic handled fully inside transactions_controller)
app.config['STRIPE_PUBLISHABLE_KEY'] = os.environ.get('STRIPE_PUBLISHABLE_KEY')
app.config['STRIPE_SECRET_KEY'] = os.environ.get('STRIPE_SECRET_KEY')

# JWT Token Expiry
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=30)

# -------------------------------------------------
# Initialize Extensions
# -------------------------------------------------
db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)

# -------------------------------------------------
# Register Blueprints
# -------------------------------------------------
app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(transactions_bp)

# -------------------------------------------------
# Routes (Template Rendering Only)
# -------------------------------------------------
@app.route('/')
def login_page():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('index.html', title='Dashboard')

@app.route('/edge-devices')
def edge_devices_page():
    return render_template('edge_devices.html', title='Edge Devices')

@app.route('/ml-insights')
def ml_insights_page():
    return render_template('ml_insights.html', title='ML Insights')

@app.route('/transactions')
def transactions_page():
    return render_template('transactions.html', title="Transactions")

@app.route('/system-management')
def system_management_page():
    return render_template('system_management.html', title='System Management')

# -------------------------------------------------
# Database Auto-Creation (First Run Only)
# -------------------------------------------------
with app.app_context():
    db_path = os.path.join(basedir, 'bankedge.db')
    if not os.path.exists(db_path):
        print("Database not found. Creating bankedge.db...")
        db.create_all()
        print("Database created successfully.")

# -------------------------------------------------
# Start Server
# -------------------------------------------------
if __name__ == '__main__':
    app.run(debug=True)
