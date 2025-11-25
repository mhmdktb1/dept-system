import express from 'express';
import { google } from 'googleapis';
import { formidable } from 'formidable';
import fs from 'fs';
import { PassThrough } from 'stream';
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
            return res.status(400).json({ error: 'Error parsing file upload: ' + err.message });
        }

        try {
            const uploadedFile = Array.isArray(files.image) ? files.image[0] : files.image;

            if (!uploadedFile) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Read file into buffer manually
            const fileData = await fs.promises.readFile(uploadedFile.filepath);
            const buffer = Buffer.from(fileData);

            // Delete temp file immediately after reading
            try {
                await fs.promises.unlink(uploadedFile.filepath);
            } catch (unlinkErr) {
                console.warn('Failed to delete temp file:', unlinkErr);
            }

            // Convert buffer to stream for Google Drive API
            const bufferStream = new PassThrough();
            bufferStream.end(buffer);

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
                body: bufferStream
            };

            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id'
            });

            await drive.permissions.create({
                fileId: response.data.id,
                requestBody: { role: "reader", type: "anyone" }
            });

            res.json({
                success: true,
                googleFileId: response.data.id,
                imageUrl: `https://drive.google.com/uc?id=${response.data.id}`
            });

        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Upload failed: ' + error.message });
        }
    });
});

export default router;
