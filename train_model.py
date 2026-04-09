import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib

# Load dataset (download from Kaggle: Crop Recommendation)
df = pd.read_csv("Crop_recommendation.csv")

X = df[['N','P','K','temperature','humidity','rainfall','ph']]
y = df['label']

# Train model
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    random_state=42
)
model.fit(X, y)

# Save model
joblib.dump(model, "model.pkl")

print("✅ Model trained & saved")