/**
 * Get System Summary API Endpoint
 * 
 * This serverless function handles GET requests to retrieve global summary statistics
 * for the entire debt management system. This endpoint provides high-level metrics
 * that give an overview of the business's financial status.
 * 
 * Vercel Serverless Functions:
 * - Each API route file exports a default handler function
 * - The handler receives (req, res) parameters
 * - Functions use getDb() to access cached MongoDB connections
 * - Responses are sent as JSON using res.json()
 * 
 * Frontend Usage:
 * - This endpoint is typically called on page load to display summary statistics
 * - The data is often displayed in a top card or dashboard section
 * - Provides quick insights into total outstanding debt, number of customers, etc.
 * - Used to give users an immediate overview of the system's financial health
 */

import { getDb } from './_db.js';

/**
 * Default handler for the getSummary endpoint
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
        // without modifying server state. This endpoint only reads data,
        // so GET is the correct method to use.
        if (req.method !== 'GET') {
            return res.status(405).json({ 
                error: 'Method not allowed' 
            });
        }

        // Get database connection
        // getDb() returns a cached connection, which is efficient for
        // serverless functions that may be invoked multiple times
        const db = await getDb();

        // Calculate totalCustomers
        // This metric represents the total number of customers in the system.
        // It's useful for understanding the scale of the business and is often
        // displayed prominently in the frontend dashboard.
        const totalCustomers = await db.collection('customers').countDocuments();

        // Calculate totalDebt and totalPaid from transactions
        // We use MongoDB aggregation to efficiently sum transaction amounts
        // by type. This is more efficient than fetching all transactions and
        // summing in JavaScript.
        // 
        // We support both "debit"/"DEBT" and "credit"/"PAYMENT" formats
        // to handle legacy data and ensure compatibility.
        const debtAggregation = await db.collection('transactions')
            .aggregate([
                {
                    $match: {
                        $or: [
                            { type: 'debit' },
                            { type: 'DEBT' }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' }
                    }
                }
            ])
            .toArray();

        const creditAggregation = await db.collection('transactions')
            .aggregate([
                {
                    $match: {
                        $or: [
                            { type: 'credit' },
                            { type: 'PAYMENT' }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' }
                    }
                }
            ])
            .toArray();

        // Extract totals from aggregation results
        // If no transactions exist, the aggregation returns an empty array,
        // so we default to 0
        const totalDebt = debtAggregation.length > 0 
            ? (debtAggregation[0].total || 0) 
            : 0;

        const totalPaid = creditAggregation.length > 0 
            ? (creditAggregation[0].total || 0) 
            : 0;

        // Calculate totalOutstandingDebt
        // This is the net amount owed to the business across all customers.
        // It's calculated as totalDebt - totalPaid, representing the actual
        // money that customers still owe. This is a key metric displayed in
        // the frontend, often in a prominent card at the top of the page.
        const totalOutstandingDebt = totalDebt - totalPaid;

        // Calculate totalDebtors
        // This represents the number of customers who currently owe money
        // (i.e., have a balance > 0). This metric helps understand how many
        // customers have outstanding debts, which is useful for collection
        // efforts and business planning.
        // 
        // We use aggregation to group transactions by customer and calculate
        // each customer's balance, then count how many have a positive balance.
        const customerBalances = await db.collection('transactions')
            .aggregate([
                {
                    $group: {
                        _id: '$customerId',
                        totalDebt: {
                            $sum: {
                                $cond: [
                                    { $in: ['$type', ['debit', 'DEBT']] },
                                    '$amount',
                                    0
                                ]
                            }
                        },
                        totalPaid: {
                            $sum: {
                                $cond: [
                                    { $in: ['$type', ['credit', 'PAYMENT']] },
                                    '$amount',
                                    0
                                ]
                            }
                        }
                    }
                },
                {
                    $project: {
                        customerId: '$_id',
                        balance: { $subtract: ['$totalDebt', '$totalPaid'] },
                        _id: 0
                    }
                },
                {
                    $match: {
                        balance: { $gt: 0 }
                    }
                }
            ])
            .toArray();

        // Count customers with balance > 0
        const totalDebtors = customerBalances.length;

        // Return summary statistics
        // This response format is designed to be consumed by the frontend
        // dashboard, where it's typically displayed in summary cards or
        // a top statistics section. The frontend can use these metrics to
        // give users a quick overview of the system's financial status.
        return res.status(200).json({
            totalCustomers,
            totalDebt: Number(totalDebt.toFixed(2)),
            totalPaid: Number(totalPaid.toFixed(2)),
            totalOutstandingDebt: Number(totalOutstandingDebt.toFixed(2)),
            totalDebtors
        });

    } catch (error) {
        // Handle database errors and other exceptions
        // We log the error for debugging but return a user-friendly message
        console.error('Error fetching summary:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to fetch summary. Please try again later.'
        });
    }
}


