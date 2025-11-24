/**
 * Get All Customers Route
 * 
 * This route handles GET requests to retrieve a list of all customers
 * with their summary statistics including receipt count, total debt, total paid,
 * and current balance.
 */

import { getDb } from '../db.js';
import express from 'express';

const router = express.Router();

/**
 * GET /api/getCustomers
 */
router.get('/', async (req, res) => {
    try {
        // Get database connection
        const db = await getDb();

        // Fetch all customers from database
        const customers = await db.collection('customers')
            .find({})
            .toArray();

        // Fetch all transactions to calculate customer statistics
        const allTransactions = await db.collection('transactions')
            .find({})
            .toArray();

        // Group transactions by customerId and calculate totals
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
        return res.status(200).json(customersWithStats);

    } catch (error) {
        // Handle database errors and other exceptions
        console.error('Error fetching customers:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to fetch customers. Please try again later.'
        });
    }
});

export default router;

