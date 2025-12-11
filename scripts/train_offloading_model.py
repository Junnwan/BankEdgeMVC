import pandas as pd
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

def train_model():
    input_file = 'ml_data/transactions_dataset_10000.csv'
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    print(f"Loading data from {input_file}...")
    df = pd.read_csv(input_file)

    # --- Feature Engineering ---
    print("Calculating engineered features (txn_count_last_30d)...")
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Sort by customer and time
    df = df.sort_values(['customer_id', 'timestamp'])
    
    # Calculate rolling count per user (past 30 days)
    # Using 'amount' as a dummy column to count
    df_indexed = df.set_index('timestamp')
    df['txn_count_last_30d'] = df_indexed.groupby('customer_id')['amount'].rolling('30D', closed='left').count().values
    
    # Fill defaults
    df['txn_count_last_30d'] = df['txn_count_last_30d'].fillna(0)

    # Features (X) and Target (y)
    # Note: 'device_load' is removed as it is not in the new dataset.
    features = ['amount', 'type', 'latency', 'txn_count_last_30d']
    target = 'processing_decision'
    
    print(f"Features: {features}")
    
    X = df[features]
    y = df[target]
    
    # Define Preprocessing
    numerical_features = ['amount', 'latency', 'txn_count_last_30d']
    categorical_features = ['type']
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', 'passthrough', numerical_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ])
    
    # Define Pipeline
    clf = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
    ])
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train
    print("Training Random Forest Classifier...")
    clf.fit(X_train, y_train)
    
    # Evaluate
    print("Evaluating...")
    y_pred = clf.predict(X_test)
    print("Accuracy:", accuracy_score(y_test, y_pred))
    print("\nClassification Report:\n", classification_report(y_test, y_pred))
    
    # Save Model
    if not os.path.exists('ml_models'):
        os.makedirs('ml_models')
        
    model_path = 'ml_models/offloading_model.pkl'
    with open(model_path, 'wb') as f:
        pickle.dump(clf, f)
        
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_model()
