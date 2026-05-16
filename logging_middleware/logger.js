const axios = require('axios');

const AUTH_API = 'http://4.224.186.213/evaluation-service/auth';
const LOG_API = 'http://4.224.186.213/evaluation-service/logs';

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
        console.error('Can not retrieve auth token:', error.message);
        return null;
    }
}


async function Log(stack, level, packageField, message) {
    const token = await getAuthToken();
    
    if (!token) {
        console.error('Skipping log transmission due to missing auth token.');
        return;
    }

    const payload = {
        stack: String(stack).toLowerCase(),
        level: String(level).toLowerCase(),
        package: String(packageField).toLowerCase(),
        message: message
    };

    try {
        const response = await axios.post(LOG_API, payload, {
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
             },
            timeout: 5000 
        });
    } catch (error) {
        console.error('Connection to log server failed:', error.message);
    }
}

module.exports = { Log };