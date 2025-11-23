/**
 * Delete Transaction API Endpoint
 * 
 * This serverless function handles POST requests to delete a single transaction
 * from the database. This endpoint is useful for fixing mistakes in debts/payments
 * that were incorrectly recorded.
 * 
 * Vercel Serverless Functions:
 * - Each API route file exports a default handler function
 * - The handler receives (req, res) parameters
 * - Functions use getDb() to access cached MongoDB connections
 * - Responses are sent as JSON using res.json()
 * 
 * Use Cases:
 * - Removing incorrectly entered debt transactions
 * - Removing incorrectly entered payment transactions
 * - Fixing data entry errors
 * - Cleaning up test/duplicate transactions
 */

import { getDb } from './_db.js';
import { ObjectId } from 'mongodb';

/**
 * Default handler for the deleteTransaction endpoint
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
        // POST is used here to ensure the deletion is an intentional action
        // and prevents accidental deletions via GET requests (e.g., from browser history)
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                error: 'Method not allowed' 
            });
        }

        // Parse and validate request body
        // We validate the transactionId to ensure data integrity and prevent
        // invalid deletion attempts that could cause database errors
        const { transactionId } = req.body;

        // Validate transactionId exists
        // Transaction ID is required to identify which transaction to delete
        if (!transactionId) {
            return res.status(400).json({ 
                error: 'Invalid transactionId' 
            });
        }

        // Validate transactionId is a valid MongoDB ObjectId
        // We validate IDs to prevent database errors and ensure we're working
        // with properly formatted MongoDB ObjectIds. Invalid IDs would cause
        // MongoDB queries to fail, so we catch this early.
        let objectId;
        try {
            objectId = new ObjectId(transactionId);
        } catch (error) {
            return res.status(400).json({ 
                error: 'Invalid transactionId' 
            });
        }

        // Get database connection
        // getDb() returns a cached connection, which is efficient for
        // serverless functions that may be invoked multiple times
        const db = await getDb();

        // First check if the transaction exists
        // We verify existence before deletion to provide a clear error message
        // if the transaction doesn't exist, rather than silently succeeding
        const transaction = await db.collection('transactions')
            .findOne({ _id: objectId });

        if (!transaction) {
            return res.status(404).json({ 
                error: 'Transaction not found' 
            });
        }

        // Delete the transaction
        // Once we've verified the transaction exists, we can safely delete it
        // The deleteOne operation will remove the transaction from the database
        await db.collection('transactions').deleteOne({ _id: objectId });

        // Return success response
        // Confirms the deletion was successful and provides feedback to the frontend
        return res.status(200).json({
            success: true,
            message: 'Transaction deleted successfully'
        });

    } catch (error) {
        // Handle database errors and other exceptions
        // We log the error for debugging but return a user-friendly message
        console.error('Error deleting transaction:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to delete transaction. Please try again later.'
        });
    }
}


