import express from 'express';
import { google } from 'googleapis';
import { formidable } from 'formidable';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Initialize Google Auth
const getDriveClient = () => {
    let credentials;
    
    // 1. Try Environment Variable (Production)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
            console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e);
        }
    }
    
    // 2. Try Local File (Development)
    if (!credentials) {
        try {
            // Assuming this file is in backend/routes/, and service-account.json is in backend/
            const keyFilePath = path.join(process.cwd(), 'service-account.json');
            if (fs.existsSync(keyFilePath)) {
                const keyFileContent = fs.readFileSync(keyFilePath, 'utf-8');
                credentials = JSON.parse(keyFileContent);
                console.log('Using local service-account.json');
            }
        } catch (e) {
            console.error('Failed to read local service-account.json:', e);
        }
    }

    if (!credentials) {
        throw new Error('Google Service Account credentials not found (Env Var or File)');
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    return google.drive({ version: 'v3', auth });
};

router.post('/', async (req, res) => {
    const form = formidable({
        maxFileSize: 20 * 1024 * 1024, // 20MB
        keepExtensions: true,
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Form parsing error:', err);
            return res.status(400).json({ error: 'Error parsing file upload' });
        }

        // formidable v3 returns arrays for files. 'image' is the field name from frontend.
        const uploadedFile = Array.isArray(files.image) ? files.image[0] : files.image;

        if (!uploadedFile) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate mime type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(uploadedFile.mimetype)) {
            return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' });
        }

        try {
            const drive = getDriveClient();
            const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

            if (!folderId) {
                throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is missing');
            }

            const fileMetadata = {
                name: `invoice-${Date.now()}`,
                parents: [folderId]
            };

            const media = {
                mimeType: uploadedFile.mimetype,
                body: fs.createReadStream(uploadedFile.filepath)
            };

            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id'
            });

            const fileId = response.data.id;

            // Make file public
            await drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            // Construct public URL
            const imageUrl = `https://drive.google.com/uc?id=${fileId}`;

            res.status(200).json({
                success: true,
                fileId: fileId,
                fileUrl: imageUrl
            });

        } catch (error) {
            console.error('Google Drive upload error:', error);
            res.status(500).json({ error: 'Failed to upload image to Google Drive: ' + error.message });
        }
    });
});

export default router;
