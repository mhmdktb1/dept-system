import fs from 'fs';
import path from 'path';

/**
 * Helper to load and parse Google Service Account Credentials
 * Handles:
 * 1. Environment Variable (GOOGLE_SERVICE_ACCOUNT_JSON)
 *    - Fixes escaped newlines
 *    - Handles raw JSON
 * 2. Local File (service-account.json) fallback for development
 */
const loadServiceAccount = () => {
    let credentials;
    let rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    console.log('Loading Google Credentials...');

    // 1. Try Environment Variable
    if (rawJson) {
        console.log('Found GOOGLE_SERVICE_ACCOUNT_JSON env var. Length:', rawJson.length);
        try {
            // Clean up the string
            if (rawJson.startsWith('"') && rawJson.endsWith('"')) {
                rawJson = rawJson.slice(1, -1);
            }
            
            rawJson = rawJson.replace(/\\n/g, '\n');
            rawJson = rawJson.trim();

            credentials = JSON.parse(rawJson);
            console.log('Successfully parsed credentials from Env Var.');
        } catch (error) {
            console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON:', error.message);
            console.error('Raw value start:', rawJson.substring(0, 50) + '...');
        }
    } else {
        console.log('GOOGLE_SERVICE_ACCOUNT_JSON env var is missing or empty.');
    }

    // 2. Try Render Secret File (Standard Path)
    if (!credentials) {
        const secretPath = '/etc/secrets/service-account.json';
        if (fs.existsSync(secretPath)) {
            console.log('Found Render secret file at:', secretPath);
            try {
                credentials = JSON.parse(fs.readFileSync(secretPath, 'utf-8'));
                console.log('Successfully parsed credentials from Secret File.');
            } catch (e) {
                console.error('Failed to parse secret file:', e.message);
            }
        }
    }

    // 3. Try Local File (Development fallback)
    if (!credentials) {
        try {
            const localPath = path.join(process.cwd(), 'service-account.json');
            const altPath = path.join(process.cwd(), 'backend', 'service-account.json');
            
            if (fs.existsSync(localPath)) {
                const fileContent = fs.readFileSync(localPath, 'utf-8');
                credentials = JSON.parse(fileContent);
                console.log('Loaded credentials from local service-account.json');
            } else if (fs.existsSync(altPath)) {
                const fileContent = fs.readFileSync(altPath, 'utf-8');
                credentials = JSON.parse(fileContent);
                console.log('Loaded credentials from backend/service-account.json');
            }
        } catch (error) {
            console.warn('Failed to load local service-account.json:', error.message);
        }
    }

    if (!credentials) {
        console.error('Available Environment Variables:', Object.keys(process.env).join(', '));
        throw new Error('Google Service Account credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON env var or provide service-account.json.');
    }

    return credentials;
};

export default loadServiceAccount;
