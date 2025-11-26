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

        // Validate invoiceImageUrl (optional)
        if (invoiceImageUrl && typeof invoiceImageUrl !== 'string') {
            return res.status(400).json({ 
                error: 'Invalid invoice image URL' 
            });
        }

        // Get database connection
        const db = await getDb();

        // Check if customer exists
        const customer = await db.collection('customers').findOne({ _id: objectId });
        if (!customer) {
            return res.status(404).json({ 
                error: 'Customer not found' 
            });
        }

        // Create transaction object
        const transaction = {
            customerId: customerId, // Store as string to match addPayment.js
            type: 'debit', // Standardize on 'debit'
            amount: amount, // Positive amount for debt
            note: note || '',
            invoiceImageUrl: invoiceImageUrl || null,
            date: new Date(),
            createdAt: new Date()
        };

        // Insert transaction into "transactions" collection
        const result = await db.collection('transactions').insertOne(transaction);

        // Return success response
        res.status(201).json({ 
            message: 'Debt added successfully',
            transactionId: result.insertedId
        });

    } catch (error) {
        console.error('Error adding debt:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

