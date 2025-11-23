/**
 * Add Customer API Endpoint
 * 
 * This serverless function handles POST requests to add a new customer
 * to the MongoDB database. It validates the input data and inserts
 * a new customer document into the "customers" collection.
 * 
 * Vercel Serverless Functions:
 * - Each API route file exports a default handler function
 * - The handler receives (req, res) parameters
 * - Functions are stateless but can reuse cached connections via getDb()
 */

import { getDb } from './_db.js';

/**
 * Default handler for the addCustomer endpoint
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
        // This prevents accidental data exposure and ensures the endpoint
        // is used correctly for creating new resources
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                error: 'Method not allowed' 
            });
        }

        // Parse and validate request body
        // We validate fields to ensure data integrity and prevent
        // invalid or incomplete customer records in the database
        const { name, phone, note } = req.body;

        // Validate required field: name
        // Customer name is essential for identification and must be provided
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Customer name is required.' 
            });
        }

        // Get database connection
        // getDb() returns a cached connection, which is efficient for
        // serverless functions that may be invoked multiple times
        const db = await getDb();

        // Prepare customer document
        // We use default empty strings for optional fields to maintain
        // consistent data structure in the database
        const customerDoc = {
            name: name.trim(),
            phone: phone || '',
            note: note || '',
            createdAt: new Date()
        };

        // Insert customer into MongoDB collection
        // The "customers" collection stores all customer records
        const result = await db.collection('customers').insertOne(customerDoc);

        // Return success response with the inserted customer ID
        // The insertedId is useful for the frontend to reference the new customer
        return res.status(200).json({
            success: true,
            message: 'Customer added successfully',
            customerId: result.insertedId.toString()
        });

    } catch (error) {
        // Handle database errors and other exceptions
        // We log the error for debugging but return a user-friendly message
        console.error('Error adding customer:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to add customer. Please try again later.'
        });
    }
}

