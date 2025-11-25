import express from 'express';
import { google } from 'googleapis';
import { formidable } from 'formidable';
import fs from 'fs';
import loadServiceAccount from './_loadServiceAccount.js';

const router = express.Router();

// Initialize Google Drive Client
const getDriveClient = () => {
    const credentials = loadServiceAccount();
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
        allowEmptyFiles: false,
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Form parsing error:', err);
            if (err.code === 1009 || err.toString().includes('maxFileSize')) {
                return res.status(400).json({ error: 'File is too large. Max size is 20MB.' });
            }
            return res.status(400).json({ error: 'Error parsing file upload: ' + err.message });
        }

        // formidable v3 returns arrays for files. 'image' is the field name from frontend.
        const uploadedFile = Array.isArray(files.image) ? files.image[0] : files.image;

        if (!uploadedFile) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate mime type strictly
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
