/**
 * Add Customer Route
 * 
 * This route handles POST requests to add a new customer
 * to the MongoDB database. It validates the input data and inserts
 * a new customer document into the "customers" collection.
 */

import { getDb } from '../db.js';
import express from 'express';

const router = express.Router();

/**
 * POST /api/addCustomer
 * 
 * @param {Object} req.body - Request body containing:
 *   - name: string (required) - Customer name
 *   - phone: string (optional) - Phone number
 *   - note: string (optional) - Notes about the customer
 */
router.post('/', async (req, res) => {
    try {
        // Parse and validate request body
        const { name, phone, note } = req.body;

        // Validate required field: name
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Customer name is required.' 
            });
        }

        // Get database connection
        const db = await getDb();

        // Prepare customer document
        const customerDoc = {
            name: name.trim(),
            phone: phone || '',
            note: note || '',
            createdAt: new Date()
        };

        // Insert customer into MongoDB collection
        const result = await db.collection('customers').insertOne(customerDoc);

        // Return success response with the inserted customer ID
        return res.status(200).json({
            success: true,
            message: 'Customer added successfully',
            customerId: result.insertedId.toString()
        });

    } catch (error) {
        // Handle database errors and other exceptions
        console.error('Error adding customer:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to add customer. Please try again later.'
        });
    }
});

export default router;

