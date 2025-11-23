/**
 * Get Customer Details API Endpoint
 * 
 * This serverless function handles GET requests to retrieve detailed information
 * about a single customer, including their transaction history and computed
 * financial summaries (total debt, total paid, and current balance).
 * 
 * Vercel Serverless Functions:
 * - Each API route file exports a default handler function
 * - The handler receives (req, res) parameters
 * - Query parameters are accessed via req.query
 * - Functions use getDb() to access cached MongoDB connections
 * - Responses are sent as JSON using res.json()
 */

import { getDb } from './_db.js';
import { ObjectId } from 'mongodb';

/**
 * Default handler for the getCustomer endpoint
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
        // Only allow GET requests
        // GET is the appropriate HTTP method for retrieving data
        // without modifying server state
        if (req.method !== 'GET') {
            return res.status(405).json({ 
                error: 'Method not allowed' 
            });
        }

        // Extract customer ID from query parameters
        // The endpoint is called as: /api/getCustomer?id=CUSTOMER_ID
        const customerId = req.query.id;

        // Validate customer ID is provided
        // Without an ID, we cannot identify which customer to retrieve
        if (!customerId) {
            return res.status(400).json({ 
                error: 'Customer ID is required' 
            });
        }

        // Get database connection
        // getDb() returns a cached connection, which is efficient for
        // serverless functions that may be invoked multiple times
        const db = await getDb();

        // Validate that customerId is a valid MongoDB ObjectId format
        // This prevents errors when querying the database
        let objectId;
        try {
            objectId = new ObjectId(customerId);
        } catch (error) {
            return res.status(400).json({ 
                error: 'Invalid customer ID format' 
            });
        }

        // Fetch customer from database
        // We use ObjectId to match the _id field in MongoDB
        const customer = await db.collection('customers')
            .findOne({ _id: objectId });

        // Check if customer exists
        // If not found, return 404 Not Found status
        if (!customer) {
            return res.status(404).json({ 
                error: 'Customer not found' 
            });
        }

        // Fetch all transactions for this customer
        // Transactions are linked to customers via customerId field
        // Sort by date descending (newest first) for better UX
        const transactions = await db.collection('transactions')
            .find({ customerId: customerId })
            .sort({ date: -1, createdAt: -1 }) // Sort by date, then createdAt if date is same
            .toArray();

        // Map transactions to the expected format
        // We transform the MongoDB document structure to match
        // what the frontend expects
        const mappedTransactions = transactions.map((transaction) => {
            return {
                id: transaction._id.toString(),
                type: transaction.type === 'DEBT' || transaction.type === 'debit' 
                    ? 'debit' 
                    : 'credit',
                amount: transaction.amount || 0,
                note: transaction.note || '',
                invoiceImageUrl: transaction.invoiceImageUrl || transaction.invoiceUrl || null,
                date: transaction.date || transaction.createdAt || new Date()
            };
        });

        // Compute financial totals from transactions
        // We compute totals here rather than storing them in the customer
        // document to ensure data consistency. If we stored totals, we'd
        // need to update them every time a transaction is added/modified,
        // which could lead to inconsistencies. Computing on-the-fly ensures
        // the data is always accurate based on the current transaction records.
        let totalDebt = 0;
        let totalPaid = 0;

        transactions.forEach((transaction) => {
            const amount = transaction.amount || 0;

            // Sum debits (money owed to the store)
            if (transaction.type === 'debit' || transaction.type === 'DEBT') {
                totalDebt += amount;
            }
            // Sum credits (payments made by customer)
            else if (transaction.type === 'credit' || transaction.type === 'PAYMENT') {
                totalPaid += amount;
            }
        });

        // Calculate balance (what customer currently owes)
        const balance = totalDebt - totalPaid;

        // Return customer details with computed statistics and transactions
        // This format matches what the frontend expects
        return res.status(200).json({
            id: customer._id.toString(),
            name: customer.name || '',
            phone: customer.phone || '',
            note: customer.note || '',
            createdAt: customer.createdAt || null,
            totalDebt: Number(totalDebt.toFixed(2)),
            totalPaid: Number(totalPaid.toFixed(2)),
            balance: Number(balance.toFixed(2)),
            transactions: mappedTransactions
        });

    } catch (error) {
        // Handle database errors and other exceptions
        // We log the error for debugging but return a user-friendly message
        console.error('Error fetching customer:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to fetch customer. Please try again later.'
        });
    }
}




