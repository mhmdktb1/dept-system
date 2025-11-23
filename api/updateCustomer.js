/**
 * Update Customer API Endpoint
 * 
 * This serverless function handles POST requests to update an existing customer's
 * information (name, phone, and note) in the MongoDB database.
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
 * Default handler for the updateCustomer endpoint
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
        const { customerId, name, phone, note } = req.body;

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

        // Validate name
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Customer name is required' 
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

        // Prepare update document
        const updateDoc = {
            name: name.trim(),
            phone: phone || '',
            note: note || '',
            updatedAt: new Date()
        };

        // Update customer in MongoDB
        await db.collection('customers').updateOne(
            { _id: objectId },
            { $set: updateDoc }
        );

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Customer updated successfully',
            customerId: customerId
        });

    } catch (error) {
        // Handle database errors and other exceptions
        console.error('Error updating customer:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to update customer. Please try again later.'
        });
    }
}

