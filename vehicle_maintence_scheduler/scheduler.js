const axios = require('axios');
const { Log } = require('../logging_middleware/logger');

const BASE_URL = 'http://4.224.186.213/evaluation-service';
const AUTH_API = 'http://4.224.186.213/evaluation-service/auth';
const AUTH_CRED = {
    email: "aarthi.22mic7089@vitapstudent.ac.in",
    name: "nagelli aarthi",
    rollNo: "22mic7089",
    accessCode: "SfFuWg",
    clientID: "8a2f1fcb-066f-4c2a-a4bd-31071a046252",
    clientSecret: "UFmUNWEQNTTNKxFd"
}

let cachedToken = null;
let tokenExpiresAt = 0; 

async function getAuthToken() {
    const currentTime = Date.now();

    if (cachedToken && currentTime < (tokenExpiresAt - 10000)) {
        return cachedToken;
    }

    try {
        const targetUrl = new URL(AUTH_API.trim());
        const response = await axios.post(AUTH_API, AUTH_CRED, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000 
        });

        const data = await response.data;
        
        cachedToken = data.access_token;
        
        const expiresInSeconds = data.expires_in || 3600; 
        tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);

        return cachedToken;
    } catch (error) {
        Log("backend", "error", "handler", "Error fetching token");
        return null;
    }
}

function optimizeGlobalMaintenance(depots, vehicles) {
    const numDepots = depots.length;
    const numVehicles = vehicles.length;
    const depotCapacities = depots.map(d => d.MechanicHours);
    let globalTotalImpact = 0;
    const vehicleAssignments = new Map(); 
    const depotSchedules = Array.from({ length: numDepots }, () => []);
    const sortedVehicles = vehicles
        .map((v, originalIdx) => ({ ...v, originalIdx, ratio: v.Impact / v.Duration }))
        .sort((a, b) => b.ratio - a.ratio);

    for (const vehicle of sortedVehicles) {
        let bestDepotIdx = -1;
        let maxRemainingCapacity = -1;

        for (let j = 0; j < numDepots; j++) {
            if (vehicle.Duration <= depotCapacities[j]) {
                if (depotCapacities[j] > maxRemainingCapacity) {
                    maxRemainingCapacity = depotCapacities[j];
                    bestDepotIdx = j;
                }
            }
        }
        if (bestDepotIdx !== -1) {
            depotCapacities[bestDepotIdx] -= vehicle.Duration;
            globalTotalImpact += vehicle.Impact;
            vehicleAssignments.set(vehicle.originalIdx, bestDepotIdx);
            depotSchedules[bestDepotIdx].push(vehicles[vehicle.originalIdx]);
        }
    }

    return {
        globalTotalImpact,
        depotSchedules: depots.map((depot, idx) => ({
            id: depot.ID,
            allocatedBudget: depot.MechanicHours,
            remainingBudget: depotCapacities[idx],
            totalImpact: depotSchedules[idx].reduce((sum, v) => sum + v.Impact, 0),
            tasks: depotSchedules[idx]
        }))
    };
}

async function generateGlobalVehicleSchedules() {
    try {
        const token = await getAuthToken();
        if (!token) {
            Log("backend", "error", "handler", "Token not found");
            return;
        }
        const apiConfig = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        const [depotsResponse, vehiclesResponse] = await Promise.all([
            axios.get(`${BASE_URL}/depots`, apiConfig),
            axios.get(`${BASE_URL}/vehicles`, apiConfig)
        ]);

        const depots = depotsResponse.data.depots;
        const vehicles = vehiclesResponse.data.vehicles;

        const results = optimizeGlobalMaintenance(depots, vehicles);

        console.log(`Total Impact: ${results.globalTotalImpact}`);

        results.depotSchedules.forEach(depot => {
            console.log(`Depot ID: ${depot.id}`);
            console.log(`-Total Time: ${depot.allocatedBudget} hours`);
            console.log(`-Time Used: ${depot.allocatedBudget - depot.remainingBudget} hours`);
            console.log(`-Depot Impact: ${depot.totalImpact}`);
            console.log(`-No.of Assigned Tasks (${depot.tasks.length}):`);
            
            depot.tasks.forEach(task => {
                console.log(`* Task ID: ${task.TaskID} | Duration: ${task.Duration} hrs | Impact: ${task.Impact}`);
            });
            console.log('\n--------------------------------------------------\n');
        });

    } catch (error) {
        Log("backend", "error", "handler", "Error generating vehicle schedules");
    }
}

generateGlobalVehicleSchedules();