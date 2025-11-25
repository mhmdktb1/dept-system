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

    // 1. Try Environment Variable
    if (rawJson) {
        try {
            // Clean up the string
            // Remove surrounding quotes if they exist (sometimes added by shell)
            if (rawJson.startsWith('"') && rawJson.endsWith('"')) {
                rawJson = rawJson.slice(1, -1);
            }
            
            // Handle escaped newlines (common in some env var editors)
            // Replace literal "\n" with actual newline character
            rawJson = rawJson.replace(/\\n/g, '\n');
            
            // Trim whitespace
            rawJson = rawJson.trim();

            credentials = JSON.parse(rawJson);
        } catch (error) {
            console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON environment variable:', error.message);
            console.error('Raw value start:', rawJson.substring(0, 20));
            throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. Ensure it is valid JSON.');
        }
    }

    // 2. Try Local File (Development fallback)
    if (!credentials) {
        try {
            // Look for service-account.json in the backend root (parent of routes)
            // process.cwd() in Render is usually the root of the repo or the backend folder depending on start command.
            // Assuming start command is "node server.js" inside backend/ or "node backend/server.js" from root.
            // Let's try to find it relative to this file.
            
            // This file is in backend/routes/
            // service-account.json is likely in backend/
            
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
        throw new Error('Google Service Account credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON env var or provide service-account.json.');
    }

    return credentials;
};

export default loadServiceAccount;
