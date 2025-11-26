/**
 * Get Customer Details Route
 * 
 * This route handles GET requests to retrieve detailed information
 * about a single customer, including their transaction history and computed
 * financial summaries (total debt, total paid, and current balance).
 */

import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
import express from 'express';

const router = express.Router();

/**
 * GET /api/getCustomer?id=CUSTOMER_ID
 * 
 * @param {string} req.query.id - MongoDB ObjectId of the customer
 */
router.get('/', async (req, res) => {
    try {
        // Extract customer ID from query parameters
        const customerId = req.query.id;

        // Validate customer ID is provided
        if (!customerId) {
            return res.status(400).json({ 
                error: 'Customer ID is required' 
            });
        }

        // Get database connection
        const db = await getDb();

        // Validate that customerId is a valid MongoDB ObjectId format
        let objectId;
        try {
            objectId = new ObjectId(customerId);
        } catch (error) {
            return res.status(400).json({ 
                error: 'Invalid customer ID format' 
            });
        }

        // Fetch customer from database
        const customer = await db.collection('customers')
            .findOne({ _id: objectId });

        // Check if customer exists
        if (!customer) {
            return res.status(404).json({ 
                error: 'Customer not found' 
            });
        }

        // Fetch all transactions for this customer
        // Query for both string ID and ObjectId to handle legacy/mixed data
        const transactions = await db.collection('transactions')
            .find({ 
                customerId: { $in: [customerId, objectId] } 
            })
            .sort({ date: -1, createdAt: -1 }) // Sort by date, then createdAt if date is same
            .toArray();

        // Map transactions to the expected format
        const mappedTransactions = transactions.map((transaction) => {
            return {
                id: transaction._id.toString(),
                type: ['debit', 'debt', 'DEBT'].includes(transaction.type) ? 'debit' : 'credit',
                amount: transaction.amount || 0,
                note: transaction.note || '',
                invoiceImageUrl: transaction.invoiceImageUrl || transaction.invoiceUrl || null,
                date: transaction.date || transaction.createdAt || new Date()
            };
        });

        // Compute financial totals from transactions
        let totalDebt = 0;
        let totalPaid = 0;

        transactions.forEach((transaction) => {
            const amount = transaction.amount || 0;
            const type = (transaction.type || '').toLowerCase();

            // Sum debits (money owed to the store)
            if (type === 'debit' || type === 'debt') {
                totalDebt += amount;
            }
            // Sum credits (payments made by customer)
            else if (type === 'credit' || type === 'payment') {
                totalPaid += amount;
            }
        });

        // Calculate balance (what customer currently owes)
        const balance = totalDebt - totalPaid;

        // Return customer details with computed statistics and transactions
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
        console.error('Error fetching customer:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to fetch customer. Please try again later.'
        });
    }
});

export default router;

