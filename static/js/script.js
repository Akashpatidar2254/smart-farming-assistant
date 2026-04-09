// ===== GET LOCATION =====
function getLocation() {
    const status = document.getElementById("status");
    const btn = document.getElementById("locationBtn");

    // Show loading
    status.innerText = "📡 Getting your location...";
    btn.disabled = true;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success, error);
    } else {
        status.innerText = "❌ Geolocation not supported";
        btn.disabled = false;
    }
}

// SUCCESS
function success(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    // ✅ Save location
    localStorage.setItem("lat", lat);
    localStorage.setItem("lon", lon);

    fetch(`/weather?lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                document.getElementById("status").innerText = "❌ Failed to fetch weather";
            } else {
                updateUI(data);

                document.getElementById("status").innerText =
                    "✅ Showing weather for " + data.city;
            }

            document.getElementById("locationBtn").disabled = false;
        })
        .catch(() => {
            document.getElementById("status").innerText =
                "❌ Failed to fetch weather data";
            document.getElementById("locationBtn").disabled = false;
        });
}
// ERROR HANDLING
function error(err) {
    let message = "";

    switch (err.code) {
        case 1:
            message = "❌ Permission denied";
            break;
        case 2:
            message = "❌ Location unavailable";
            break;
        case 3:
            message = "❌ Request timeout";
            break;
        default:
            message = "❌ Unknown error";
    }

    document.getElementById("status").innerText = message;
    document.getElementById("locationBtn").disabled = false;
}

// ===== SEND GPS TO BACKEND =====
function sendLocation(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    fetch(`/weather?lat=${lat}&lon=${lon}`)
        .then(response => response.json())
        .then(updateUI);
}

// ===== MANUAL CITY SEARCH =====
function getWeatherByCity() {
    const city = document.getElementById("cityInput").value.trim();

    if (city === "") {
        alert("Please enter a city name");
        return;
    }

    document.getElementById("status").innerText = "🔍 Fetching weather...";

    fetch(`/weatherByCity?city=${city}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                document.getElementById("status").innerText = "❌ City not found";
            } else {
                updateUI(data);

                // ✅ Save city
            localStorage.setItem("city", data.city);

            // OPTIONAL: Clear GPS if manual used
            localStorage.removeItem("lat");
            localStorage.removeItem("lon");

                document.getElementById("status").innerText =
                    "✅ Showing weather for " + data.city;
            }
        })
        .catch(() => {
            document.getElementById("status").innerText =
                "❌ Error fetching data";
        });
}

// ===== UPDATE UI =====
function getWeatherIcon(condition) {
    condition = condition.toLowerCase();

    if (condition.includes("cloud")) return "fa-cloud";
    if (condition.includes("rain")) return "fa-cloud-rain";
    if (condition.includes("clear")) return "fa-sun";
    if (condition.includes("storm")) return "fa-bolt";
    if (condition.includes("snow")) return "fa-snowflake";

    return "fa-smog";
}
//=== update UI ===
function updateUI(data) {
    if (!data) return;

    const temp = data.temp ?? "--";
    const humidity = data.humidity ?? "--";
    const city = data.city || "Unknown Location";

    // Matches id="temp", id="humidity", and id="city-name" in dashboard.html
    const tempEl = document.getElementById("temp");
    const humEl = document.getElementById("humidity");
    const cityEl = document.getElementById("city-name") || document.getElementById("city");

    if (tempEl) tempEl.innerText = temp + "°C";
    if (humEl) humEl.innerText = humidity + "%";
    if (cityEl) cityEl.innerText = city;

    if (data.condition && document.getElementById("weatherIcon")) {
        const iconClass = getWeatherIcon(data.condition);
        document.getElementById("weatherIcon").className = "fas " + iconClass;
    }
}

// ===== ERROR =====
function showError(error) {
    alert("Location access denied");
}

//======Login redirect to dashboard=====
function loginSuccess() {
    alert("Login successful!");
    window.location.href = "/dashboard";
}


function toggleDropdown() {
    const options = document.getElementById("cropOptions");
    options.style.display = options.style.display === "block" ? "none" : "block";
}

// ==========================================
// 3. EXPERT SYSTEM PREDICTION LOGIC
// ==========================================

function getCropPrediction() {
    const district = document.getElementById('district').value;
    const village = document.getElementById('village').value;
    const latValue = document.getElementById('lat').value;
    const lonValue = document.getElementById('lon').value;

    const resultDiv = document.getElementById('prediction-result');

    // 1. Validation: Ensure user has selected the village
    if (!village || !district) {
        alert("Please select both District and Village to proceed.");
        return;
    }

    // 2. UI Loader: Feedback that the DB is being queried
    resultDiv.innerHTML = `
        <div class="spinner-container" style="text-align:center; padding:20px;">
            <div class="spinner"></div>
            <p style="color:#28a745; font-weight:600; margin-top:10px;">
                <i class="fas fa-database"></i> Querying Soil Intelligence...
            </p>
        </div>
    `;

    // 3. Fetch Request to Flask Backend
    fetch('/predictCrop', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            district: district,
            village: village,
            // Ensure values are numbers for PostgreSQL compatibility
            lat: parseFloat(latValue) || 23.25,
            lon: parseFloat(lonValue) || 77.41 
        }),
    })
    .then(async response => {
        const data = await response.json();
        // If the server returns 404 or 500, trigger the .catch()
        if (!response.ok) {
            throw new Error(data.error || "Server error occurred");
        }
        return data;
    })
    .then(data => {
        resultDiv.innerHTML = ""; // Clear loader

        // Case A: No specific crop matched (even with tolerance)
        if (data.message) {
            resultDiv.innerHTML = `
                <div class="alert-warning" style="background:#fff3cd; padding:20px; border-radius:10px; border-left:5px solid #ffc107;">
                    <h3><i class="fas fa-exclamation-triangle"></i> Recommendation Note</h3>
                    <p>${data.message}</p>
                </div>`;
            return;
        }

        // Case B: Success - Build Results Grid
        let htmlOutput = `
            <h2 style="text-align:center; margin-bottom:25px; color:#2c3e50;">
                <i class="fas fa-leaf"></i> Optimal Crops for Your Land
            </h2>
            <div class="crop-grid">
        `;

        data.forEach(item => {
            htmlOutput += `
                <div class="crop-card">
                    <div class="crop-header">
                        <span class="crop-name">${item.crop}</span>
                        <span class="confidence-badge">${item.confidence}% Match</span>
                    </div>
                    <div class="crop-body">
                        <p><i class="fas fa-calendar-alt"></i> Season: <strong>${item.season}</strong></p>
                        <span class="reason-text"><i class="fas fa-info-circle"></i> ${item.reason}</span>
                    </div>
                </div>
            `;
        });

        htmlOutput += `</div>`;
        resultDiv.innerHTML = htmlOutput;
    })
    .catch(error => {
        console.error('Prediction Error:', error);
        // Display specific error message from the backend
        resultDiv.innerHTML = `
            <div style="text-align:center; color:#d9534f; padding:20px; border:1px dashed #d9534f; border-radius:10px;">
                <i class="fas fa-server" style="font-size:2rem;"></i>
                <p><strong>Failed to get prediction:</strong> ${error.message}</p>
                <small>Check if the selected village exists in the database.</small>
            </div>`;
    });
}





function analyzeFarm() {
    console.log("Analyze clicked");
    getCropPrediction();
}

function showCrop(crop) {
    document.querySelector(".crop-selected").innerText = "🌾 " + crop;
}



async function getCitySuggestions(query) {
    if (query.length < 2) return [];

    const API_KEY = "YOUR_API_KEY";

    const res = await fetch(
        `http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${API_KEY}`
    );

    const data = await res.json();
    return data;
}

async function handleTyping() {
    const query = document.getElementById("cityInput").value;

    const results = await getCitySuggestions(query);

    const box = document.getElementById("suggestions");
    box.innerHTML = "";

    results.forEach(loc => {
        const div = document.createElement("div");
        div.innerText = `${loc.name}, ${loc.state || ""}, ${loc.country}`;

        div.onclick = () => selectCity(loc);

        box.appendChild(div);
    });
}

function selectCity(loc) {
    document.getElementById("cityInput").value = loc.name;

    localStorage.setItem("city", loc.name);
    localStorage.setItem("lat", loc.lat);
    localStorage.setItem("lon", loc.lon);

    document.getElementById("suggestions").innerHTML = "";

    getWeatherByCoords(loc.lat, loc.lon);
}

async function loadStates() {
    const res = await fetch('/getStates');
    const states = await res.json();

    const stateSelect = document.getElementById("state");
    states.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.innerText = s;
        stateSelect.appendChild(opt);
    });
}

async function loadStates() {
    const res = await fetch('/getStates');
    const states = await res.json();

    const stateSelect = document.getElementById("state");
    stateSelect.innerHTML = "<option value=''>Select State</option>";

    states.forEach(s => {
        let opt = document.createElement("option");
        opt.value = s;
        opt.innerText = s;
        stateSelect.appendChild(opt);
    });
}



window.onload = function () {

    console.log("Dashboard Loaded ✅");

    // ===== LOAD STATES =====
    loadStates();

    // ===== WEATHER =====
    const lat = localStorage.getItem("lat");
    const lon = localStorage.getItem("lon");
    const city = localStorage.getItem("city");

    if (lat && lon) {
        fetch(`/weather?lat=${lat}&lon=${lon}`)
            .then(res => res.json())
            .then(data => {
                console.log("Weather data:", data);
                updateUI(data);
            })
            .catch(err => console.error("Weather error:", err));
    } 
    else if (city) {
        fetch(`/weatherByCity?city=${city}`)
            .then(res => res.json())
            .then(data => {
                console.log("City weather:", data);
                updateUI(data);
            })
            .catch(err => console.error("City weather error:", err));
    }

    // ===== STATE → DISTRICT =====
    document.getElementById("state").addEventListener("change", async function () {

        const state = this.value;

        const res = await fetch(`/getDistricts?state=${state}`);
        const districts = await res.json();

        const districtSelect = document.getElementById("district");
        districtSelect.innerHTML = "<option value=''>Select District</option>";

        districts.forEach(d => {
            let opt = document.createElement("option");
            opt.value = d;
            opt.innerText = d;
            districtSelect.appendChild(opt);
        });

        document.getElementById("block").innerHTML = "";
        document.getElementById("village").innerHTML = "";
    });

    // ===== DISTRICT → BLOCK =====
    document.getElementById("district").addEventListener("change", async function () {

        const district = this.value;

        const res = await fetch(`/getBlocks?district=${district}`);
        const blocks = await res.json();

        const blockSelect = document.getElementById("block");
        blockSelect.innerHTML = "<option value=''>Select Block</option>";

        blocks.forEach(b => {
            let opt = document.createElement("option");
            opt.value = b;
            opt.innerText = b;
            blockSelect.appendChild(opt);
        });

        document.getElementById("village").innerHTML = "";
    });

    // ===== BLOCK → VILLAGE =====
    document.getElementById("block").addEventListener("change", async function () {

        const block = this.value;

        const res = await fetch(`/getVillages?block=${block}`);
        const villages = await res.json();

        const villageSelect = document.getElementById("village");
        villageSelect.innerHTML = "<option value=''>Select Village</option>";

        villages.forEach(v => {
            let opt = document.createElement("option");
            opt.value = v;
            opt.innerText = v;
            villageSelect.appendChild(opt);
        });
    });

};

function showFertilizers(fertilizers) {

    console.log("Rendering fertilizers:", fertilizers);

    const container = document.getElementById("fertilizers");

    if (!container) {
        console.log("❌ fertilizers div not found");
        return;
    }

    container.innerHTML = "";

    fertilizers.forEach(fert => {

        const div = document.createElement("div");
        div.className = "fertilizer-card";

        div.innerHTML = `
            <h4>🌿 ${fert.name}</h4>
            <p>${fert.reason}</p>
        `;

        container.appendChild(div);
    });

    console.log("Rendering fertilizers:", fertilizers);
}

function updateInsights(data) {

    const soil = document.getElementById("soilHealth");
    const rain = document.getElementById("rainPrediction");
    const yieldEl = document.getElementById("yieldEstimate");

    if (soil) soil.innerText = data.soil_health || "--";
    if (rain) rain.innerText = data.rain_prediction || "--";
    if (yieldEl) yieldEl.innerText = data.yield_estimate || "--";
}

function showCrops(crops) {

    const container = document.getElementById("cropOptions");
    container.innerHTML = "";

    crops.forEach(crop => {

        const div = document.createElement("div");
        div.className = "crop-item-option";

        div.innerHTML = `
            <span>🌾 ${crop.name}</span>
            <span class="crop-percent">${crop.prob}%</span>
        `;

        div.onclick = () => {
            document.querySelector(".crop-selected").innerText =
                `🌾 ${crop.name} (${crop.prob}%)`;

            container.style.display = "none";
        };

        container.appendChild(div);
    });
}

function updateWeatherByGPS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            
            // Update hidden inputs
            document.getElementById('lat').value = lat;
            document.getElementById('lon').value = lon;
            
            fetch(`/weather?lat=${lat}&lon=${lon}`)
                .then(res => res.json())
                .then(data => updateUI(data));
        });
    }
}