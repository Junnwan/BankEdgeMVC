import stripe
from flask import Blueprint, jsonify, request
from datetime import datetime
from flask_jwt_extended import jwt_required
from models import db, Transaction

transactions_bp = Blueprint('transactions_api', __name__, url_prefix='/api')

@transactions_bp.route("/transactions", methods=["GET"])
@jwt_required()
def get_transactions():
    transactions = Transaction.query.order_by(Transaction.timestamp.desc()).all()

    result = []
    for t in transactions:
        result.append({
            "id": t.id,
            "amount": t.amount,
            "type": t.type,
            "stripe_status": t.stripe_status,
            "ml_prediction": t.ml_prediction,
            "processed_at": t.processed_at,
            "merchant_name": t.merchant_name,
            "device_id": t.device_id,
            "latency": t.latency,
            "confidence": t.confidence,
            "customer_id": t.customer_id,
            "timestamp": t.timestamp.isoformat() if t.timestamp else None
        })

    return jsonify(result)

@transactions_bp.route("/create-payment-intent", methods=["POST"])
@jwt_required()
def create_payment_intent():
    try:
        data = request.get_json()
        amount = int(float(data.get("amount")) * 100)  # RM→sen

        # Create PaymentIntent with multiple payment methods
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="myr",
            payment_method_types=["card", "fpx", "grabpay"]
        )

        return jsonify({
            "clientSecret": intent.client_secret
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@transactions_bp.route("/payment-success", methods=["POST"])
@jwt_required()
def payment_success():
    data = request.get_json()

    txn = Transaction(
        amount=data.get("amount"),
        type="Card Payment",
        status="succeeded",
        customer_id=data.get("payment_intent"),
        timestamp=datetime.utcnow()
    )

    db.session.add(txn)
    db.session.commit()

    return jsonify({"message": "Transaction saved"})
