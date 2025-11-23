/**
 * Add Debt API Endpoint
 * 
 * This serverless function handles POST requests to add a new debt transaction
 * for a customer. A debt represents money owed to the store by a customer.
 * 
 * Vercel Serverless Functions:
 * - Each API route file exports a default handler function
 * - The handler receives (req, res) parameters
 * - Functions use getDb() to access cached MongoDB connections
 * - Responses are sent as JSON using res.json()
 * 
 * Invoice Images:
 * - The invoiceImageUrl field is optional and should contain a URL to an image
 * - Images are typically uploaded via a separate /api/uploadImage endpoint
 * - The URL is then passed here to associate the invoice image with the debt transaction
 */

import { getDb } from './_db.js';
import { ObjectId } from 'mongodb';

/**
 * Default handler for the addDebt endpoint
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
        // is used correctly for creating new debt transactions
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                error: 'Method not allowed' 
            });
        }

        // Parse and validate request body
        // We validate fields to ensure data integrity and prevent
        // invalid or incomplete transaction records in the database
        const { customerId, amount, note, invoiceImageUrl } = req.body;

        // Validate customerId
        // Customer ID is required to associate the debt with a customer
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
        // to prevent invalid debt entries (zero or negative amounts)
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
        // This ensures referential integrity - we don't want to create
        // transactions for non-existent customers
        const customer = await db.collection('customers')
            .findOne({ _id: objectId });

        if (!customer) {
            return res.status(404).json({ 
                error: 'Customer not found' 
            });
        }

        // Prepare debt transaction document
        // We use default empty string for note and null for invoiceImageUrl
        // to maintain consistent data structure in the database
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
        // The "transactions" collection stores all financial transactions
        // (both debts and payments) for all customers
        const result = await db.collection('transactions').insertOne(transactionDoc);

        // Return success response with the inserted transaction ID
        // The insertedId is useful for the frontend to reference the new transaction
        return res.status(200).json({
            success: true,
            message: 'Debt added successfully',
            transactionId: result.insertedId.toString()
        });

    } catch (error) {
        // Handle database errors and other exceptions
        // We log the error for debugging but return a user-friendly message
        console.error('Error adding debt:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to add debt. Please try again later.'
        });
    }
}




