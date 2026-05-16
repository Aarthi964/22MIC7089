const AUTH_API = 'http://4.2.24.186.213/evaluation-service/auth';
const LOG_API = 'http://4.2.24.186.213/evaluation-service/logs';

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
        const response = await fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(AUTH_CRED)
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.status}`);
        }

        const data = await response.json();
        
        cachedToken = data.token;
        
        const expiresInSeconds = data.expiresIn || 3600; 
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
        console.error('[Logger Error] Skipping log transmission due to missing auth token.');
        return;
    }

    const payload = {
        stack: String(stack).toLowerCase(),
        level: String(level).toLowerCase(),
        package: String(packageField).toLowerCase(),
        message: message
    };

    try {
        const response = await fetch(LOG_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Failed to send log. Status: ${response.status}`);
        }
    } catch (error) {
        console.error('Connection to log server failed:', error.message);
    }
}

module.exports = { Log };