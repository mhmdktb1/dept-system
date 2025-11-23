/**
 * Get All Customers API Endpoint
 * 
 * This serverless function handles GET requests to retrieve a list of all customers
 * with their summary statistics including receipt count, total debt, total paid,
 * and current balance.
 * 
 * Vercel Serverless Functions:
 * - Each API route file exports a default handler function
 * - The handler receives (req, res) parameters
 * - Functions use getDb() to access cached MongoDB connections
 * - Responses are sent as JSON using res.json()
 * 
 * Frontend Usage:
 * - This endpoint is called on page load to display the customer list
 * - The data is used to render customer cards with name, receipt count, and balance
 * - Used to provide an overview of all customers and their outstanding debts
 */

import { getDb } from './_db.js';

/**
 * Default handler for the getCustomers endpoint
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

        // Get database connection
        // getDb() returns a cached connection, which is efficient for
        // serverless functions that may be invoked multiple times
        const db = await getDb();

        // Fetch all customers from database
        // We retrieve all customers to display in the customer list
        const customers = await db.collection('customers')
            .find({})
            .toArray();

        // Fetch all transactions to calculate customer statistics
        // We need transactions to compute totalDebt, totalPaid, and balance
        // for each customer
        const allTransactions = await db.collection('transactions')
            .find({})
            .toArray();

        // Group transactions by customerId and calculate totals
        // This aggregation approach is efficient and ensures accurate calculations
        const customerStats = {};
        
        allTransactions.forEach((transaction) => {
            const customerId = transaction.customerId;
            if (!customerId) return;

            // Initialize customer stats if not exists
            if (!customerStats[customerId]) {
                customerStats[customerId] = {
                    totalDebt: 0,
                    totalPaid: 0,
                    receipts: 0
                };
            }

            const amount = transaction.amount || 0;

            // Sum debits (money owed to the store) and count receipts
            if (transaction.type === 'debit' || transaction.type === 'DEBT') {
                customerStats[customerId].totalDebt += amount;
                customerStats[customerId].receipts += 1;
            }
            // Sum credits (payments made by customer)
            else if (transaction.type === 'credit' || transaction.type === 'PAYMENT') {
                customerStats[customerId].totalPaid += amount;
            }
        });

        // Map customers to the expected format with computed statistics
        // We combine customer data with transaction statistics to provide
        // a complete view of each customer's financial status
        const customersWithStats = customers.map((customer) => {
            const customerId = customer._id.toString();
            const stats = customerStats[customerId] || {
                totalDebt: 0,
                totalPaid: 0,
                receipts: 0
            };

            // Calculate balance (what customer currently owes)
            const balance = stats.totalDebt - stats.totalPaid;

            return {
                id: customerId,
                name: customer.name || '',
                phone: customer.phone || '',
                receipts: stats.receipts,
                totalDebt: Number(stats.totalDebt.toFixed(2)),
                totalPaid: Number(stats.totalPaid.toFixed(2)),
                balance: Number(balance.toFixed(2))
            };
        });

        // Return list of customers with their statistics
        // This format matches what the frontend expects for rendering customer cards
        return res.status(200).json(customersWithStats);

    } catch (error) {
        // Handle database errors and other exceptions
        // We log the error for debugging but return a user-friendly message
        console.error('Error fetching customers:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to fetch customers. Please try again later.'
        });
    }
}

