/**
 * Delete Customer Route
 * 
 * This route handles POST requests to delete a customer and all
 * associated transactions from the MongoDB database.
 */

import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
import express from 'express';

const router = express.Router();

/**
 * POST /api/deleteCustomer
 * 
 * @param {Object} req.body - Request body containing:
 *   - customerId: string (required) - MongoDB ObjectId of the customer to delete
 */
router.post('/', async (req, res) => {
    try {
        // Parse and validate request body
        const { customerId } = req.body;

        // Validate customerId
        if (!customerId) {
            return res.status(400).json({ 
                error: 'Customer ID is required' 
            });
        }

        // Validate customerId is a valid MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(customerId);
        } catch (error) {
            return res.status(400).json({ 
                error: 'Invalid customer ID format' 
            });
        }

        // Get database connection
        const db = await getDb();

        // Verify customer exists
        const customer = await db.collection('customers')
            .findOne({ _id: objectId });

        if (!customer) {
            return res.status(404).json({ 
                error: 'Customer not found' 
            });
        }

        // Delete all transactions for this customer first
        await db.collection('transactions').deleteMany({ 
            customerId: customerId 
        });

        // Delete the customer
        await db.collection('customers').deleteOne({ _id: objectId });

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Customer deleted successfully'
        });

    } catch (error) {
        // Handle database errors and other exceptions
        console.error('Error deleting customer:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to delete customer. Please try again later.'
        });
    }
});

export default router;

