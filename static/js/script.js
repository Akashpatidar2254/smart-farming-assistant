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

    // ===== SAFETY CHECK =====
    if (!data) return;

    const temp = data.temp ?? "--";
    const humidity = data.humidity ?? "--";
    const city = data.city && data.city !== "" ? data.city : "Unknown Location";

    // ===== MAIN WEATHER CARD =====
    document.getElementById("temp").innerText = temp + "°C";
    document.getElementById("humidity").innerText = humidity + "%";
    document.getElementById("city").innerText = city;

    // ===== WEATHER ICON =====
    if (data.condition) {
        const iconClass = getWeatherIcon(data.condition);
        document.getElementById("weatherIcon").className = "fas " + iconClass;
    }

    // ===== TEMPERATURE CARD =====
    const tempCard = document.getElementById("tempCard");
    if (tempCard) {
        tempCard.innerText = temp + "°C";
    }

    // ===== HUMIDITY CARD =====
    const humidityCard = document.getElementById("humidityCard");
    if (humidityCard) {
        humidityCard.innerText = humidity + "%";
    }

    // ===== AUTO-FILL INPUTS =====
    const tempInput = document.getElementById("tempInput");
    const humidityInput = document.getElementById("humidityInput");

    if (tempInput) tempInput.value = temp;
    if (humidityInput) humidityInput.value = humidity;

    // ===== DEBUG (OPTIONAL) =====
    console.log("Updated UI:", { temp, humidity, city });
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



function getCropPrediction() {
    console.log("Calling API...");
    const district = document.getElementById("district").value;
    const temp = document.getElementById("tempInput").value;
    const humidity = document.getElementById("humidityInput").value;
    if (!temp || !humidity) {
    alert("Please enter temperature and humidity");
    return;
}   
    
    const state = document.getElementById("state").value;
const block = document.getElementById("block").value;
const village = document.getElementById("village").value;
    
    if (!state || !district || !block || !village) {
    alert("Please select complete location (State → District → Block → Village)");
    return;
}
    fetch(`/predictCrop?state=${state}&district=${district}&block=${block}&village=${village}&temp=${temp}&humidity=${humidity}`)
        .then(res => res.json())
        .then(data => {

    console.log("Prediction data:", data);
    console.log("Response received:", data);
    if (data.error) {
        alert(data.error);
        return;
    }

    // 🌾 SHOW ALL CROPS IN DROPDOWN (🔥 NEW)
    showCrops(data.crops);

    // 🌾 AUTO-SELECT TOP CROP
    if (data.crops && data.crops.length > 0) {
        document.querySelector(".crop-selected").innerText =
            `🌾 ${data.crops[0].name} (${data.crops[0].prob}%)`;
    }

    // 🌿 INSIGHTS
    updateInsights(data);

    // 🧪 FERTILIZERS
    showFertilizers(data.fertilizers);
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