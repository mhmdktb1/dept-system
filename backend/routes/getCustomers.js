import { getDb } from '../db.js';
import express from 'express';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const db = await getDb();

        // 1. Fetch all customers
        const customers = await db.collection('customers').find({}).toArray();

        // 2. Fetch all transactions in a single query (Optimized)
        const transactions = await db.collection('transactions').find({}).toArray();

        // 3. Group transactions by customerId in memory
        const statsMap = {};

        for (const t of transactions) {
            if (!t.customerId) continue;
            
            // Normalize customerId to string for consistent grouping
            // This handles both ObjectId and String formats in the database
            const custIdStr = t.customerId.toString();

            if (!statsMap[custIdStr]) {
                statsMap[custIdStr] = {
                    totalDebt: 0,
                    totalPaid: 0,
                    receipts: 0
                };
            }

            const type = (t.type || '').toLowerCase();
            const amount = Math.abs(t.amount || 0);
            
            // Robust logic to determine if it's a debt or payment
            // Matches logic used in generateStatement.js
            const isDebt = ['debt', 'debit'].includes(type) || (t.amount < 0 && type !== 'payment' && type !== 'credit');

            if (isDebt) {
                statsMap[custIdStr].totalDebt += amount;
                statsMap[custIdStr].receipts += 1;
            } else {
                statsMap[custIdStr].totalPaid += amount;
            }
        }

        // 4. Map customers to output format with computed values
        const result = customers.map(c => {
            const cId = c._id.toString();
            const stats = statsMap[cId] || { totalDebt: 0, totalPaid: 0, receipts: 0 };
            const balance = stats.totalDebt - stats.totalPaid;

            return {
                id: cId,
                name: c.name,
                phone: c.phone || '',
                receipts: stats.receipts,
                totalDebt: Number(stats.totalDebt.toFixed(2)),
                totalPaid: Number(stats.totalPaid.toFixed(2)),
                balance: Number(balance.toFixed(2))
            };
        });

        res.json(result);

    } catch (error) {
        console.error('Error in getCustomers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

export default router;

