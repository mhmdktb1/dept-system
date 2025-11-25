/**
 * Get System Summary Route
 * 
 * This route handles GET requests to retrieve global summary statistics
 * for the entire debt management system. This endpoint provides high-level metrics
 * that give an overview of the business's financial status.
 */

import { getDb } from '../db.js';
import express from 'express';

const router = express.Router();

/**
 * GET /api/getSummary
 */
router.get('/', async (req, res) => {
    try {
        // Get database connection
        const db = await getDb();

        // Calculate totalCustomers
        const totalCustomers = await db.collection('customers').countDocuments();

        // Calculate totalDebt and totalPaid from transactions
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
        const totalDebt = debtAggregation.length > 0 
            ? (debtAggregation[0].total || 0) 
            : 0;

        const totalPaid = creditAggregation.length > 0 
            ? (creditAggregation[0].total || 0) 
            : 0;

        // Calculate totalOutstandingDebt
        const totalOutstandingDebt = totalDebt - totalPaid;

        // Calculate totalDebtors
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
        return res.status(200).json({
            totalCustomers,
            totalDebt: Number(totalDebt.toFixed(2)),
            totalPaid: Number(totalPaid.toFixed(2)),
            totalOutstandingDebt: Number(totalOutstandingDebt.toFixed(2)),
            totalDebtors
        });

    } catch (error) {
        // Handle database errors and other exceptions
        console.error('Error fetching summary:', error);

        // Return generic error message to avoid exposing internal details
        return res.status(500).json({
            error: 'Failed to fetch summary. Please try again later.'
        });
    }
});

export default router;

