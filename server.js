const express = require('express');
const cors = require('cors');
const axios = require('axios');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- 1. GEOCODING (Find Lat/Lon from Name) ---
async function getCoordinates(locationName) {
    try {
        console.log(`🔎 Looking up: "${locationName}"...`);
        
        // FIX: We must send a User-Agent or OSM will block us
        const url = `https://nominatim.openstreetmap.org/search`;
        const response = await axios.get(url, {
            params: { q: locationName, format: 'json', limit: 1 },
            headers: { 'User-Agent': 'CityCommuteApp_Project/1.0' } 
        });

        if (response.data && response.data.length > 0) {
            const data = response.data[0];
            console.log(`✅ Found: ${data.lat}, ${data.lon}`);
            return { lat: data.lat, lon: data.lon, name: data.display_name };
        } else {
            console.log(`❌ Map could not find: "${locationName}"`);
            return null;
        }
    } catch (error) {
        console.error("⚠️ Geocoding Error:", error.message);
        return null;
    }
}

// --- 2. ROUTING (Find Distance/Time) ---
async function getRouteData(startLat, startLon, endLat, endLon) {
    try {
        const url = `http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false`;
        const response = await axios.get(url);

        if (response.data.routes && response.data.routes.length > 0) {
            const route = response.data.routes[0];
            return {
                distanceKm: (route.distance / 1000).toFixed(1), // Meters to KM
                durationMins: Math.round(route.duration / 60)   // Seconds to Minutes
            };
        }
        return null;
    } catch (error) {
        console.error("⚠️ Routing Error:", error.message);
        return null;
    }
}

// --- 3. MAIN API ENDPOINT ---
app.post('/api/get-routes', async (req, res) => {
    const { fromLoc, toLoc } = req.body;

    // A. Find Coordinates
    const startCoords = await getCoordinates(fromLoc);
    const endCoords = await getCoordinates(toLoc);

    if (!startCoords || !endCoords) {
        return res.status(404).json({ error: "One or both locations could not be found on the map." });
    }

    // B. Calculate Route
    const routeData = await getRouteData(startCoords.lat, startCoords.lon, endCoords.lat, endCoords.lon);

    if (!routeData) {
        return res.status(500).json({ error: "Could not calculate a driving path." });
    }

    // C. Save to DB & Reply
    db.run(`INSERT INTO search_history (from_loc, to_loc) VALUES (?, ?)`, [fromLoc, toLoc]);

    // D. Price Logic
    const dist = parseFloat(routeData.distanceKm);
    const time = routeData.durationMins;

    // Bus: Cheap, Slower
    const busPrice = 10 + (dist * 2); 
    const busTime = time + 20; 

    // Cab: Expensive, Faster
    const cabPrice = 40 + (dist * 12);

    res.json({
        routes: [
            {
                type: "lowest_cost",
                label: "Lowest Cost",
                cost: `₹${Math.floor(busPrice)}`,
                duration: `${busTime} mins`,
                steps: [
                    { icon: "walk", text: "Walk to Stop", sub: "5 mins", time: "5m" },
                    { icon: "bus", text: "Public Bus", sub: "Direct", time: `${busTime - 10}m` }
                ]
            },
            {
                type: "fastest",
                label: "Fastest",
                cost: `₹${Math.floor(cabPrice)}`,
                duration: `${time} mins`,
                steps: [
                    { icon: "taxi", text: "Uber / Ola", sub: `${dist} km`, time: `${time}m`, isBooking: true }
                ]
            }
        ]
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});