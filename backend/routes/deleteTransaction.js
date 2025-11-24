/**
 * Delete Transaction Route
 * 
 * This route handles POST requests to delete a single transaction
 * from the database. This endpoint is useful for fixing mistakes in debts/payments
 * that were incorrectly recorded.
 */

import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
import express from 'express';

const router = express.Router();

/**
 * POST /api/deleteTransaction
 * 
 * @param {Object} req.body - Request body containing:
 *   - transactionId: string (required) - MongoDB ObjectId of the transaction to delete
 */
router.post('/', async (req, res) => {
    try {
        // Parse and validate request body
        const { transactionId } = req.body;

        // Validate transactionId exists
        if (!transactionId) {
            return res.status(400).json({ 
                error: 'Invalid transactionId' 
            });
        }

        // Validate transactionId is a valid MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(transactionId);
        } catch (error) {
            return res.status(400).json({ 
                error: 'Invalid transactionId' 
            });
        }

        // Get database connection
        const db = await getDb();

        // First check if the transaction exists
        const transaction = await db.collection('transactions')
            .findOne({ _id: objectId });

        if (!transaction) {
            return res.status(404).json({ 
                error: 'Transaction not found' 
            });
        }

        // Delete the transaction
        await db.collection('transactions').deleteOne({ _id: objectId });

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Transaction deleted successfully'
        });

    } catch (error) {
        // Handle database errors and other exceptions
        console.error('Error deleting transaction:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to delete transaction. Please try again later.'
        });
    }
});

export default router;

