/**
 * Delete Customer API Endpoint
 * 
 * This serverless function handles POST requests to delete a customer and all
 * associated transactions from the MongoDB database.
 * 
 * Vercel Serverless Functions:
 * - Each API route file exports a default handler function
 * - The handler receives (req, res) parameters
 * - Functions use getDb() to access cached MongoDB connections
 * - Responses are sent as JSON using res.json()
 * 
 * Note: This will delete the customer and all their transactions.
 * This action cannot be undone.
 */

import { getDb } from './_db.js';
import { ObjectId } from 'mongodb';

/**
 * Default handler for the deleteCustomer endpoint
 * 
 * @param {Object} req - Request object from Vercel
 * @param {Object} res - Response object from Vercel
 */
export default async function handler(req, res) {
    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        // Only allow POST requests
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                error: 'Method not allowed' 
            });
        }

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
}

