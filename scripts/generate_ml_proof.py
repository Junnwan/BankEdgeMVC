import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

# Set up directories
OUTPUT_DIR = 'ml_proof'
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def generate_proof():
    input_file = os.path.join('ml_data', 'transactions_dataset_10000.csv')
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    print("1. Loading Data...")
    df = pd.read_csv(input_file)

    # Feature Engineering (Replicating logic to ensure consistency)
    print("2. Preparing Features...")
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values(['customer_id', 'timestamp'])
    df_indexed = df.set_index('timestamp')
    df['txn_count_last_30d'] = df_indexed.groupby('customer_id')['amount'].rolling('30D', closed='left').count().values
    df['txn_count_last_30d'] = df['txn_count_last_30d'].fillna(0)

    features = ['amount', 'type', 'latency', 'txn_count_last_30d']
    target = 'processing_decision'
    X = df[features]
    y = df[target]

    # Preprocessing
    numerical_features = ['amount', 'latency', 'txn_count_last_30d']
    categorical_features = ['type']

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', 'passthrough', numerical_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ])

    print("3. Training Model (Random Forest)...")
    clf = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
    ])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)

    # --- ARTIFACT 1: Classification Report (Text) ---
    print("4. Generating Text Report...")
    report = classification_report(y_test, y_pred)
    with open(os.path.join(OUTPUT_DIR, 'accuracy_report.txt'), 'w') as f:
        f.write("BankEdge ML Model Validation Report\n")
        f.write("===================================\n\n")
        f.write(f"Model: Random Forest Classifier (n_estimators=100)\n")
        f.write(f"Test Set Size: {len(y_test)} samples\n")
        f.write(f"Features: {features}\n\n")
        f.write("Performance Metrics:\n")
        f.write(report)
    print(f"   -> Saved to {OUTPUT_DIR}/accuracy_report.txt")

    # --- ARTIFACT 2: Confusion Matrix (Image) ---
    print("5. Generating Confusion Matrix...")
    plt.figure(figsize=(8, 6))
    cm = confusion_matrix(y_test, y_pred, labels=clf.classes_)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=clf.classes_)
    disp.plot(cmap=plt.cm.Blues)
    plt.title('Model Confusion Matrix\n(Truth vs Prediction)')
    plt.savefig(os.path.join(OUTPUT_DIR, 'confusion_matrix.png'))
    plt.close()
    print(f"   -> Saved to {OUTPUT_DIR}/confusion_matrix.png")

    # --- ARTIFACT 3: Feature Importance (Image) ---
    print("6. Generating Feature Importance Plot...")
    
    # Extract feature names from preprocessor
    # OneHotEncoder creates new columns, need to track them
    ohe = clf.named_steps['preprocessor'].transformers_[1][1]
    ohe_feature_names = list(ohe.get_feature_names_out(categorical_features))
    all_feature_names = numerical_features + ohe_feature_names
    
    importances = clf.named_steps['classifier'].feature_importances_
    indices = np.argsort(importances)[::-1]

    plt.figure(figsize=(10, 6))
    plt.title("Feature Importance\n(What drives the ML decision?)")
    plt.bar(range(len(importances)), importances[indices], align="center")
    plt.xticks(range(len(importances)), [all_feature_names[i] for i in indices], rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'feature_importance.png'))
    plt.close()
    print(f"   -> Saved to {OUTPUT_DIR}/feature_importance.png")

if __name__ == "__main__":
    generate_proof()
