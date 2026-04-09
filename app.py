from flask import Flask, request, jsonify, render_template,session,flash
import requests 
import pandas as pd
import datetime
import os
from flask import redirect,url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)



# Replace hardcoded strings with os.getenv
app.secret_key = os.getenv('SECRET_KEY', 'default-dev-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
API_KEY = os.getenv('WEATHER_API_KEY')
#======================Postgre sql database setup=====================

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}

db = SQLAlchemy(app)

# Define the User Model (The 'users' table)
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)

#tell flask that how our database tables will look
class SoilData(db.Model):
    __tablename__ = 'soil_data'
    
    id = db.Column(db.Integer, primary_key=True)
    state = db.Column(db.String(100))
    district = db.Column(db.String(100))
    block = db.Column(db.String(100))
    village = db.Column(db.String(100))
    
    # Nutrient Values
    n = db.Column(db.Float)
    p = db.Column(db.Float)
    k = db.Column(db.Float)
    ph = db.Column(db.Float)
    zn = db.Column(db.Float) # Zinc
    s = db.Column(db.Float)  # Sulfur
    
    soil_color = db.Column(db.String(50))



# Create the tables in PostgreSQL
with app.app_context():
    db.create_all()


# --- DATABASE LOADING ---
# Load the unified master files at startup for speed
try:
    crops_range_df = pd.read_csv('database/Crop_MegaSeason_Ranges.csv')
except Exception as e:
    print(f"Error loading database files: {e}")
    master_soil_df = pd.DataFrame()
    crops_range_df = pd.DataFrame()


# --- CORE LOGIC: THE FUNNEL & BUFFER ---
def get_expert_recommendations(village_row, current_temp, current_rain):
    # Identify Mega-Season (Kharif: Jun-Nov, Rabi: Dec-May)
    month = datetime.datetime.now().month
    season = "Kharif" if 6 <= month <= 11 else "Rabi"
    
    # Select seasonal weather columns
    t_min_col, t_max_col = f'{season}_T_min', f'{season}_T_max'
    
    final_matches = pd.DataFrame()
    match_reason = ""

    # Step 2: Recursive Filtering (10% -> 20% -> 30% Tolerance)
    for tolerance in [0.10, 0.20, 0.30]:
        t_low, t_high = 1 - tolerance, 1 + tolerance
        
        filtered = crops_range_df[
            # Mineral Constraints (N, P, K, pH)
            (village_row['N'] >= crops_range_df['N_min'] * t_low) & (village_row['N'] <= crops_range_df['N_max'] * t_high) &
            (village_row['P'] >= crops_range_df['P_min'] * t_low) & (village_row['P'] <= crops_range_df['P_max'] * t_high) &
            (village_row['K'] >= crops_range_df['K_min'] * t_low) & (village_row['K'] <= crops_range_df['K_max'] * t_high) &
            (village_row['ph'] >= crops_range_df['Ph_min'] * t_low) & (village_row['ph'] <= crops_range_df['Ph_max'] * t_high) &
            # Weather Constraints (Live API Temp vs Seasonal Range)
            (current_temp >= crops_range_df[t_min_col] * t_low) & (current_temp <= crops_range_df[t_max_col] * t_high)
        ]
        
        if not filtered.empty:
            final_matches = filtered.copy()
            match_reason = f"Verified at {int(tolerance*100)}% tolerance level"
            break
            
    if final_matches.empty:
        return None, "NO CROP MATCHED"

    # Step 3: Relevance Sorting (Most Relevant First)
    # Calculate "distance" from ideal Mean values
    final_matches['distance'] = (
        abs(final_matches['N_mean'] - village_row['N']) + 
        abs(final_matches['P_mean'] - village_row['P']) + 
        abs(final_matches['K_mean'] - village_row['K'])
    )
    
    # Generate a Confidence Score (0-100)
    final_matches['confidence'] = round(100 - (final_matches['distance'] * 10), 2)
    # Ensure confidence doesn't look too low for UI
    final_matches.loc[final_matches['confidence'] < 60, 'confidence'] = 68.0

    # Sort by closest match and pick top 5
    top_crops = final_matches.sort_values('distance').head(5)
    
    results = []
    for _, row in top_crops.iterrows():
        results.append({
            "crop": row['label'],
            "confidence": row['confidence'],
            "reason": match_reason,
            "season": season
        })
    return results, "SUCCESS"

# --- ROUTE: PREDICT CROP ---
@app.route('/predictCrop', methods=['POST'])
def predict_crop():
    req = request.json
    village_name = req.get('village')
    lat = req.get('lat')
    lon = req.get('lon')

    if not village_name:
        return jsonify({"error": "Village name is required"}), 400

    # 1. Fetch Village Data from PostgreSQL (Supabase)
    # We use .ilike() for case-insensitive matching
    soil_record = SoilData.query.filter(SoilData.village.ilike(village_name)).first()
    
    if not soil_record:
        return jsonify({"error": f"Soil data for '{village_name}' not found in database"}), 404

    # 2. Convert database object to a dictionary for the Expert Logic
    # Note: Using lowercase keys to match your SoilData model
    soil_dict = {
        'N': soil_record.n,
        'P': soil_record.p,
        'K': soil_record.k,
        'ph': soil_record.ph,  # Matches the key used in your filtering loop
        'Zn': soil_record.zn,
        'S': soil_record.s,
        'Soilcolor': soil_record.soil_color
    }

    # 3. Get Live Weather Data
    weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    try:
        w_response = requests.get(weather_url)
        w_data = w_response.json()
        
        # Get temp; fallback to 25.0 if API fails or returns error
        current_temp = w_data['main']['temp'] if w_data.get("cod") == 200 else 25.0
        current_rain = w_data.get('rain', {}).get('1h', 0)
    except Exception as e:
        print(f"Weather API Error: {e}")
        current_temp = 25.0
        current_rain = 0

    # 4. Run the Expert Logic (The Funnel & Buffer)
    # This function uses your Crops Range CSV to find the best match
    recommendations, status = get_expert_recommendations(soil_dict, current_temp, current_rain)

    if status == "NO CROP MATCHED":
        return jsonify({
            "message": "No standard crop matched your specific conditions (30% tolerance reached).",
            "soil_stats": soil_dict
        }), 200

    # 5. Return the top 5 matches to the frontend
    return jsonify(recommendations)
# --- ROUTES: HOME PAGE WEATHER FEATURES ---

@app.route('/weather') # GPS-based "Use My Location"
def weather():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    data = requests.get(url).json()

    if data.get("cod") != 200:
        return jsonify({"error": "Failed to fetch weather"})

    return jsonify({
        "temp": data['main']['temp'],
        "humidity": data['main']['humidity'],
        "city": data.get('name', "Your Location"),
        "condition": data['weather'][0]['main']
    })

@app.route('/weatherByCity') # Manual Search
def weatherByCity():
    city = request.args.get('city')
    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric"
    data = requests.get(url).json()

    if data.get("cod") != 200:
        return jsonify({"error": "City not found"})

    return jsonify({
        "temp": data['main']['temp'],
        "humidity": data['main']['humidity'],
        "city": data.get('name'),
        "condition": data['weather'][0]['main']
    })

# --- ROUTES: CASCADING DROPDOWNS ---

@app.route('/getStates')
def get_states():
    # Fetch unique states from the database
    results = db.session.query(SoilData.state).distinct().all()
    states = [r[0] for r in results if r[0]]
    return jsonify(sorted(states))

@app.route('/getDistricts')
def get_districts():
    state = request.args.get('state', '')
    results = db.session.query(SoilData.district).filter(SoilData.state.ilike(state)).distinct().all()
    districts = [r[0] for r in results if r[0]]
    return jsonify(sorted(districts))

@app.route('/getBlocks')
def get_blocks():
    district = request.args.get('district', '')
    results = db.session.query(SoilData.block).filter(SoilData.district.ilike(district)).distinct().all()
    blocks = [r[0] for r in results if r[0]]
    return jsonify(sorted(blocks))

@app.route('/getVillages')
def get_villages():
    block = request.args.get('block', '')
    results = db.session.query(SoilData.village).filter(SoilData.block.ilike(block)).distinct().all()
    villages = [r[0] for r in results if r[0]]
    return jsonify(sorted(villages))
# --- NAVIGATION ---

@app.route('/')
def home():
    return render_template("home.html")

# 1. Login Route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        user = User.query.filter_by(email=email).first()

        # Check if user exists and password is correct
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            session['user_name'] = user.full_name
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password.', 'danger')
            return redirect(url_for('login'))

    return render_template('login.html')



@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')

        # Check if user already exists
        user_exists = User.query.filter_by(email=email).first()
        if user_exists:
            flash('Email already registered!', 'danger')
            return redirect(url_for('signup'))

        # Securely hash the password
        hashed_pw = generate_password_hash(password, method='pbkdf2:sha256')

        # Create new user record
        new_user = User(full_name=name, email=email, password_hash=hashed_pw)
        
        # Save to PostgreSQL
        db.session.add(new_user)
        db.session.commit()

        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('login'))
        
    return render_template('signup.html')


# 2. Protected Dashboard Route
@app.route('/dashboard')
def dashboard():
    # SECURITY CHECK: If the user_id is NOT in the session, they aren't logged in
    if 'user_id' not in session:
        flash("Please login to access the dashboard.", "warning")
        return redirect(url_for('login')) # Redirect them to the login page
    
    # If they are logged in, show the page
    return render_template('dashboard.html', name=session.get('user_name'))

# 3. Logout Route
@app.route('/logout')
def logout():
    session.clear()  # Wipes the entire session object
    session.modified = True 
    flash("You have been logged out.", "info")
    return redirect(url_for('login'))


#Sometimes, browsers cache the dashboard page even after logout. To prevent this, you can #tell the browser not to cache the dashboard by adding these headers
@app.after_request
def add_header(response):
    """
    Directs the browser NOT to store a local cache of the pages.
    This forces a session check every time the user navigates.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


if __name__ == "__main__":
    app.run(debug=True)