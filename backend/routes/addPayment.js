/**
 * Add Payment Route
 * 
 * This route handles POST requests to add a new payment transaction
 * for a customer. A payment represents money received from a customer, which
 * reduces their outstanding debt balance.
 */

import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
import express from 'express';

const router = express.Router();

/**
 * POST /api/addPayment
 * 
 * @param {Object} req.body - Request body containing:
 *   - customerId: string (required) - MongoDB ObjectId of the customer
 *   - amount: number (required) - Payment amount (must be > 0)
 *   - note: string (optional) - Note about the payment
 */
router.post('/', async (req, res) => {
    try {
        // Parse and validate request body
        const { customerId, amount, note } = req.body;

        // Validate customerId
        if (!customerId) {
            return res.status(400).json({ 
                error: 'Invalid input' 
            });
        }

        // Validate customerId is a valid MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(customerId);
        } catch (error) {
            return res.status(400).json({ 
                error: 'Invalid input' 
            });
        }

        // Validate amount
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ 
                error: 'Invalid input' 
            });
        }

        // Get database connection
        const db = await getDb();

        // Verify customer exists before creating transaction
        const customer = await db.collection('customers')
            .findOne({ _id: objectId });

        if (!customer) {
            return res.status(404).json({ 
                error: 'Customer not found' 
            });
        }

        // Prepare payment transaction document
        const transactionDoc = {
            customerId: customerId,
            type: 'credit', // Payment transactions are marked as "credit"
            amount: Number(amount.toFixed(2)), // Ensure 2 decimal places
            note: note || '',
            date: new Date(),
            createdAt: new Date()
        };

        // Insert payment transaction into MongoDB collection
        const result = await db.collection('transactions').insertOne(transactionDoc);

        // Return success response with the inserted transaction ID
        return res.status(200).json({
            success: true,
            message: 'Payment added successfully',
            transactionId: result.insertedId.toString()
        });

    } catch (error) {
        // Handle database errors and other exceptions
        console.error('Error adding payment:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to add payment. Please try again later.'
        });
    }
});

export default router;

