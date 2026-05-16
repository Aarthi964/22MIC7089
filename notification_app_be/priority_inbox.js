const axios = require('axios');

const AUTH_API = 'http://4.224.186.213/evaluation-service/auth';
const API_URL = "http://4.224.186.213/evaluation-service/notifications";

const AUTH_CRED = {
    email: "aarthi.22mic7089@vitapstudent.ac.in",
    name: "nagelli aarthi",
    rollNo: "22mic7089",
    accessCode: "SfFuWg",
    clientID: "8a2f1fcb-066f-4c2a-a4bd-31071a046252",
    clientSecret: "UFmUNWEQNTTNKxFd"
}

const CATEGORY_WEIGHTS = {
    "Placement": 3,
    "Result": 2,
    "Event": 1
};

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
        console.error('Can not retrieve auth token:', error.message);
        return null;
    }
}

function calculatePriorityScore(notification) {
    const type = notification.Type || "Event";
    const weight = CATEGORY_WEIGHTS[type] || 1;
    
    const epochTime = notification.Timestamp ? new Date(notification.Timestamp).getTime() : 0;
    
    return (weight * 10000000000000) + epochTime;
}

function getTopNNotifications(notifications, n = 10) {
    const scoredNotifications = notifications.map(notif => ({
        ...notif,
        CompositeScore: calculatePriorityScore(notif)
    }));
    return scoredNotifications
        .sort((a, b) => b.CompositeScore - a.CompositeScore)
        .slice(0, n);
}

async function fetchNotifications() {
    console.log(`Connecting to Endpoint via Axios: ${API_URL}...`);
    const token = await getAuthToken();
    
    const config = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        timeout: 10000
    };

    const response = await axios.get(API_URL, config);
    return response.data.notifications || [];
}


async function main() {
    let rawNotifications = [];
    
    try {
        rawNotifications = await fetchNotifications();
    } catch (error) {
        console.log(` [!] Axios Fetch Intercepted: ${error.message}`);
        if (error.response) {
            console.log(`Status Code: ${error.response.status}`);
        }
    }


    const top10 = getTopNNotifications(rawNotifications, 10);

    console.log("\nPRIORITY INBOX TOP NOTIFICATIONS");
    console.log(JSON.stringify(top10, null, 2));
}

main();