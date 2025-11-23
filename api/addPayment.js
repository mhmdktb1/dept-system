/**
 * Add Payment API Endpoint
 * 
 * This serverless function handles POST requests to add a new payment transaction
 * for a customer. A payment represents money received from a customer, which
 * reduces their outstanding debt balance.
 * 
 * How Payments Work:
 * - Payments are stored as "credit" type transactions
 * - When calculating customer balance: balance = totalDebt - totalPaid
 * - Each payment reduces the amount the customer owes
 * - Multiple payments can be made against accumulated debts
 * 
 * Vercel Serverless Functions:
 * - Each API route file exports a default handler function
 * - The handler receives (req, res) parameters
 * - Functions use getDb() to access cached MongoDB connections
 * - Responses are sent as JSON using res.json()
 */

import { getDb } from './_db.js';
import { ObjectId } from 'mongodb';

/**
 * Default handler for the addPayment endpoint
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
        // POST is the appropriate HTTP method for creating new resources
        // This prevents accidental data exposure and ensures the endpoint
        // is used correctly for creating new payment transactions
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                error: 'Method not allowed' 
            });
        }

        // Parse and validate request body
        // We validate fields to ensure data integrity and prevent
        // invalid or incomplete transaction records in the database
        // Validation is crucial because:
        // - Invalid data can corrupt financial records
        // - Missing required fields can cause calculation errors
        // - Negative or zero amounts don't make sense for payments
        const { customerId, amount, note } = req.body;

        // Validate customerId
        // Customer ID is required to associate the payment with a customer
        // and must be a valid MongoDB ObjectId format
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
        // Amount is required and must be a positive number
        // We check for both existence and that it's greater than 0
        // to prevent invalid payment entries (zero or negative amounts)
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ 
                error: 'Invalid input' 
            });
        }

        // Get database connection
        // getDb() returns a cached connection, which is efficient for
        // serverless functions that may be invoked multiple times
        const db = await getDb();

        // Verify customer exists before creating transaction
        // We verify customer existence to maintain referential integrity:
        // - Prevents orphaned transactions (payments without customers)
        // - Ensures data consistency in the database
        // - Provides clear error messages if customer doesn't exist
        // - Prevents accidental payments to wrong customer IDs
        const customer = await db.collection('customers')
            .findOne({ _id: objectId });

        if (!customer) {
            return res.status(404).json({ 
                error: 'Customer not found' 
            });
        }

        // Prepare payment transaction document
        // We use default empty string for note to maintain consistent
        // data structure in the database
        const transactionDoc = {
            customerId: customerId,
            type: 'credit', // Payment transactions are marked as "credit"
            amount: Number(amount.toFixed(2)), // Ensure 2 decimal places
            note: note || '',
            date: new Date(),
            createdAt: new Date()
        };

        // Insert payment transaction into MongoDB collection
        // The "transactions" collection stores all financial transactions
        // (both debts and payments) for all customers
        // This payment will be used when calculating customer balance
        const result = await db.collection('transactions').insertOne(transactionDoc);

        // Return success response with the inserted transaction ID
        // The insertedId is useful for the frontend to reference the new transaction
        return res.status(200).json({
            success: true,
            message: 'Payment added successfully',
            transactionId: result.insertedId.toString()
        });

    } catch (error) {
        // Handle database errors and other exceptions
        // We log the error for debugging but return a user-friendly message
        console.error('Error adding payment:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to add payment. Please try again later.'
        });
    }
}




