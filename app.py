from flask import Flask, request, jsonify, render_template
import requests 
import joblib
import pandas as pd
from flask import session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

API_KEY = "7ff447b695e91a3ffe3d964a8a5a8eb3"
app.secret_key = "your_secret_key_123"


#==== signup route====
@app.route('/signup', methods=['POST'])
def signup():
    username = request.form.get('username')
    password = request.form.get('password')

    if username in users:
        return "User already exists"

    hashed = generate_password_hash(password)
    users[username] = hashed

    return "Signup successful"

#===== login route =====
@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    if username in users and check_password_hash(users[username], password):
        session['user'] = username   # 🔥 login success
        return redirect('/dashboard')
    
    return "Invalid credentials"

#=== logout route====
@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect('/')
#======open and parse soil_data file===
soil_df = pd.read_csv("database/soil_data.csv", skiprows=2)

#======train_model======
model = joblib.load("model.pkl")

@app.route('/predictCrop')
def predictCrop():

    # ===== INPUT =====
    state = request.args.get('state', '').strip().lower()
    district = request.args.get('district', '').strip().lower()
    block = request.args.get('block', '').strip().lower()
    village = request.args.get('village', '').strip().lower()

    temp = float(request.args.get('temp', 0))
    humidity = float(request.args.get('humidity', 0))

    # ===== CLEAN DATA =====
    soil_df['State'] = soil_df['State'].str.strip().str.lower()
    soil_df['District'] = soil_df['District'].str.strip().str.lower()
    soil_df['Block'] = soil_df['Block'].str.strip().str.lower()
    soil_df['Village'] = soil_df['Village'].str.strip().str.lower()

    # ===== FILTER =====
    row = soil_df[
        (soil_df['State'] == state) &
        (soil_df['District'] == district) &
        (soil_df['Block'] == block) &
        (soil_df['Village'] == village)
    ]

    if row.empty:
        return jsonify({"error": "Location not found in dataset"})

    row = row.iloc[0]

    # ===== EXTRACT =====
    N = float(row['N'])
    P = float(row['P'])
    K = float(row['K'])
    ph = float(row['ph'])

    # ===== SCALE =====
   # N = (N / 100) * 140
    #P = (P / 100) * 140
    #K = (K / 100) * 140

    rainfall = max(50, humidity * 2)
    print("INPUT:", N, P, K, temp, humidity, rainfall, ph)
    print("Selected:", state, district, block, village)
    print("Row found:", not row.empty)
    
    # ===== ML PROBABILITY (🔥 FIXED POSITION) =====
    probs = model.predict_proba([[N, P, K, temp, humidity, rainfall, ph]])[0]
    classes = model.classes_

    crop_list = []

    for i in range(len(classes)):
        crop_list.append({
            "name": classes[i],
            "prob": round(probs[i] * 100, 2)
        })

    crop_list = sorted(crop_list, key=lambda x: x["prob"], reverse=True)
    print(crop_list[:5])
    # ===== SOIL HEALTH =====
    score = 0
    if 40 <= N <= 100: score += 1
    if 40 <= P <= 100: score += 1
    if 40 <= K <= 100: score += 1
    if 6 <= ph <= 7.5: score += 1

    if score >= 3:
        soil_health = "Good"
    elif score == 2:
        soil_health = "Moderate"
    else:
        soil_health = "Poor"

    # ===== RAIN PREDICTION (SIMPLE) =====
    if humidity > 70:
        rain_prediction = "High"
    elif humidity > 50:
        rain_prediction = "Moderate"
    else:
        rain_prediction = "Low"

    # ===== YIELD ESTIMATE =====
    confidence = max(probs) * 100

    if confidence > 80 and soil_health == "Good":
        yield_estimate = "High"
    elif confidence > 60:
        yield_estimate = "Moderate"
    else:
        yield_estimate = "Low"

    # ===== FERTILIZER =====
    ideal_N, ideal_P, ideal_K = 90, 60, 60

    fertilizers = []

    if ideal_N - N > 10:
        fertilizers.append({"name": "Urea", "reason": "Nitrogen deficiency", "img": "urea.png"})

    if ideal_P - P > 10:
        fertilizers.append({"name": "DAP", "reason": "Phosphorus deficiency", "img": "DAP.png"})

    if ideal_K - K > 10:
        fertilizers.append({"name": "Potash", "reason": "Potassium deficiency", "img": "potash.png"})

    if not fertilizers:
        fertilizers.append({"name": "Balanced Soil", "reason": "No major deficiency", "img": "balanced.png"})
    print("FERTILIZERS:", fertilizers)
    # ===== FINAL RESPONSE =====
    return jsonify({
        "crops": crop_list,
        "soil_health": soil_health,
        "rain_prediction": rain_prediction,
        "yield_estimate": yield_estimate,
        "fertilizers": fertilizers
    })

# ===== HOME =====
@app.route('/')
def home():
    return render_template("home.html")


# ===== DASHBOARD =====
@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect('/')   # go to home/login
    
    return render_template("dashboard.html")


# ===== GPS WEATHER =====
@app.route('/weather')
def weather():
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"

    data = requests.get(url).json()

    # ✅ SAFE ERROR HANDLING
    if data.get("cod") != 200 or "main" not in data:
        return jsonify({"error": "Failed to fetch weather"})

    return jsonify({
        "temp": data.get('main', {}).get('temp', 0),
        "humidity": data.get('main', {}).get('humidity', 0),
        "city": data.get('name', "Unknown"),
        "condition": data.get('weather', [{}])[0].get('main', "Clear")
    })


# ===== CITY WEATHER =====
@app.route('/weatherByCity')
def weatherByCity():
    city = request.args.get('city')

    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric"

    data = requests.get(url).json()

    # ✅ SAFE ERROR HANDLING
    if data.get("cod") != 200 or "main" not in data:
        return jsonify({"error": "City not found"})

    return jsonify({
        "temp": data.get('main', {}).get('temp', 0),
        "humidity": data.get('main', {}).get('humidity', 0),
        "city": data.get('name', "Unknown"),
        "condition": data.get('weather', [{}])[0].get('main', "Clear")
    })


# ===== OPTIONAL (FUTURE READY API) =====
@app.route('/analyzeFarm')
def analyzeFarm():
    soil = request.args.get('soil')
    season = request.args.get('season')

    if soil == "Loamy" and season == "Kharif":
        crops = ["Rice", "Cotton"]
    elif soil == "Sandy":
        crops = ["Millet", "Groundnut"]
    else:
        crops = ["Wheat"]

    return jsonify({"crops": crops})

#=======dashboard input section routes========

#===cascading fetching of field data=====

@app.route('/getStates')
def get_states():
    states = soil_df['State'].dropna().unique().tolist()
    return jsonify(states)


@app.route('/getDistricts')
def get_districts():
    state = request.args.get('state', '').strip().lower()

    df = soil_df.copy()
    df['State'] = df['State'].str.strip().str.lower()

    districts = df[df['State'] == state]['District'].dropna().unique().tolist()
    return jsonify(districts)


@app.route('/getBlocks')
def get_blocks():
    district = request.args.get('district', '').strip().lower()

    df = soil_df.copy()
    df['District'] = df['District'].str.strip().str.lower()

    blocks = df[df['District'] == district]['Block'].dropna().unique().tolist()
    return jsonify(blocks)


@app.route('/getVillages')
def get_villages():
    block = request.args.get('block', '').strip().lower()

    df = soil_df.copy()
    df['Block'] = df['Block'].str.strip().str.lower()

    villages = df[df['Block'] == block]['Village'].dropna().unique().tolist()
    return jsonify(villages)

# ===== RUN APP =====
if __name__ == "__main__":
    app.run(debug=True)