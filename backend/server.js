/**
 * Express Server for Chocair Fresh Debt Management System
 * 
 * This server provides REST API endpoints for managing customers and transactions.
 * All routes are mounted under /api/* prefix.
 */

import express from 'express';
import cors from 'cors';

// Import routes
import addCustomerRouter from './routes/addCustomer.js';
import addDebtRouter from './routes/addDebt.js';
import addPaymentRouter from './routes/addPayment.js';
import deleteCustomerRouter from './routes/deleteCustomer.js';
import deleteTransactionRouter from './routes/deleteTransaction.js';
import getCustomerRouter from './routes/getCustomer.js';
import getCustomersRouter from './routes/getCustomers.js';
import getSummaryRouter from './routes/getSummary.js';
import updateCustomerRouter from './routes/updateCustomer.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// CORS headers for all routes
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// API Routes
app.use('/api/addCustomer', addCustomerRouter);
app.use('/api/addDebt', addDebtRouter);
app.use('/api/addPayment', addPaymentRouter);
app.use('/api/deleteCustomer', deleteCustomerRouter);
app.use('/api/deleteTransaction', deleteTransactionRouter);
app.use('/api/getCustomer', getCustomerRouter);
app.use('/api/getCustomers', getCustomersRouter);
app.use('/api/getSummary', getSummaryRouter);
app.use('/api/updateCustomer', updateCustomerRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api/*`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

