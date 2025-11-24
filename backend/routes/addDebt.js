/**
 * Add Debt Route
 * 
 * This route handles POST requests to add a new debt transaction
 * for a customer. A debt represents money owed to the store by a customer.
 */

import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
import express from 'express';

const router = express.Router();

/**
 * POST /api/addDebt
 * 
 * @param {Object} req.body - Request body containing:
 *   - customerId: string (required) - MongoDB ObjectId of the customer
 *   - amount: number (required) - Debt amount (must be > 0)
 *   - note: string (optional) - Note about the debt
 *   - invoiceImageUrl: string (optional) - URL to invoice image
 */
router.post('/', async (req, res) => {
    try {
        // Parse and validate request body
        const { customerId, amount, note, invoiceImageUrl } = req.body;

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

        // Prepare debt transaction document
        const transactionDoc = {
            customerId: customerId,
            type: 'debit', // Debt transactions are marked as "debit"
            amount: Number(amount.toFixed(2)), // Ensure 2 decimal places
            note: note || '',
            invoiceImageUrl: invoiceImageUrl || null,
            date: new Date(),
            createdAt: new Date()
        };

        // Insert debt transaction into MongoDB collection
        const result = await db.collection('transactions').insertOne(transactionDoc);

        // Return success response with the inserted transaction ID
        return res.status(200).json({
            success: true,
            message: 'Debt added successfully',
            transactionId: result.insertedId.toString()
        });

    } catch (error) {
        // Handle database errors and other exceptions
        console.error('Error adding debt:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to add debt. Please try again later.'
        });
    }
});

export default router;

