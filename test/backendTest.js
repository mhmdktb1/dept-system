/**
 * Backend API Testing Script
 * 
 * This script tests all backend API endpoints for the Chocair Fresh Debt Management System.
 * 
 * Usage:
 *   node test/backendTest.js
 * 
 * Prerequisites:
 * - Node.js 18+ (for native fetch support)
 * - Backend server must be running on http://localhost:3000
 * - MongoDB connection must be configured
 * - Environment variables (MONGO_URI) must be set
 * 
 * Note: If using Node.js < 18, install node-fetch:
 *   npm install node-fetch
 *   Then uncomment the import at the top of this file
 */

// Uncomment if using Node.js < 18:
// import fetch from 'node-fetch';

const BASE = "http://localhost:3000";

/**
 * Helper function to make POST requests
 * @param {string} url - The endpoint URL
 * @param {object} body - The request body
 * @returns {Promise<object>} The JSON response
 */
async function post(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }

    return await response.json();
}

/**
 * Helper function to make GET requests
 * @param {string} url - The endpoint URL
 * @returns {Promise<object>} The JSON response
 */
async function get(url) {
    const response = await fetch(url);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }

    return await response.json();
}

// Main test execution
(async () => {
    console.log("=========================================");
    console.log("BACKEND API TESTING STARTED");
    console.log("=========================================\n");

    let customerId = null;
    let transactionId = null;

    // STEP 1 — Add Customer
    try {
        console.log("STEP 1 — Add Customer");
        console.log("POST /api/addCustomer");
        const addCustomerResult = await post(`${BASE}/api/addCustomer`, {
            name: "Test User",
            phone: "70000000",
            note: "Backend test user"
        });
        console.log("Result:", addCustomerResult);
        
        if (addCustomerResult.customerId) {
            customerId = addCustomerResult.customerId;
            console.log(`✓ Customer created with ID: ${customerId}\n`);
        } else {
            throw new Error("No customerId returned from addCustomer");
        }
    } catch (error) {
        console.error("✗ STEP 1 FAILED:", error.message);
        console.error("Cannot continue without customer ID. Exiting...\n");
        process.exit(1);
    }

    // STEP 2 — Add Debt
    try {
        console.log("STEP 2 — Add Debt");
        console.log("POST /api/addDebt");
        const addDebtResult = await post(`${BASE}/api/addDebt`, {
            customerId: customerId,
            amount: 50,
            note: "Test debt",
            invoiceImageUrl: null
        });
        console.log("Result:", addDebtResult);
        
        if (addDebtResult.transactionId) {
            transactionId = addDebtResult.transactionId;
            console.log(`✓ Debt transaction created with ID: ${transactionId}\n`);
        } else {
            throw new Error("No transactionId returned from addDebt");
        }
    } catch (error) {
        console.error("✗ STEP 2 FAILED:", error.message, "\n");
    }

    // STEP 3 — Add Payment
    try {
        console.log("STEP 3 — Add Payment");
        console.log("POST /api/addPayment");
        const addPaymentResult = await post(`${BASE}/api/addPayment`, {
            customerId: customerId,
            amount: 20,
            note: "Test payment"
        });
        console.log("Result:", addPaymentResult);
        console.log("✓ Payment transaction created\n");
    } catch (error) {
        console.error("✗ STEP 3 FAILED:", error.message, "\n");
    }

    // STEP 4 — Get Customer Details
    try {
        console.log("STEP 4 — Get Customer Details");
        console.log(`GET /api/getCustomer?id=${customerId}`);
        const customerDetails = await get(`${BASE}/api/getCustomer?id=${encodeURIComponent(customerId)}`);
        console.log("Result:", customerDetails);
        
        // Validate expected values
        const totalDebt = customerDetails.totalDebt || 0;
        const totalPaid = customerDetails.totalPaid || 0;
        const balance = customerDetails.balance || 0;
        
        console.log(`\nValidation:`);
        console.log(`  totalDebt: ${totalDebt} (expected: 50)`);
        console.log(`  totalPaid: ${totalPaid} (expected: 20)`);
        console.log(`  balance: ${balance} (expected: 30)`);
        
        if (totalDebt === 50 && totalPaid === 20 && balance === 30) {
            console.log("✓ All values match expected results\n");
        } else {
            console.warn("⚠ Values do not match expected results\n");
        }
    } catch (error) {
        console.error("✗ STEP 4 FAILED:", error.message, "\n");
    }

    // STEP 5 — Delete Transaction
    try {
        console.log("STEP 5 — Delete Transaction");
        console.log(`POST /api/deleteTransaction (transactionId: ${transactionId})`);
        
        if (!transactionId) {
            throw new Error("No transactionId available from previous step");
        }
        
        const deleteResult = await post(`${BASE}/api/deleteTransaction`, {
            transactionId: transactionId
        });
        console.log("Result:", deleteResult);
        
        if (deleteResult.success) {
            console.log("✓ Transaction deleted successfully\n");
        } else {
            throw new Error("Delete operation did not return success");
        }
    } catch (error) {
        console.error("✗ STEP 5 FAILED:", error.message, "\n");
    }

    // STEP 6 — Get Summary
    try {
        console.log("STEP 6 — Get Summary");
        console.log("GET /api/getSummary");
        const summary = await get(`${BASE}/api/getSummary`);
        console.log("Result:", summary);
        
        console.log(`\nSummary Statistics:`);
        console.log(`  totalCustomers: ${summary.totalCustomers}`);
        console.log(`  totalDebt: ${summary.totalDebt}`);
        console.log(`  totalPaid: ${summary.totalPaid}`);
        console.log(`  totalOutstandingDebt: ${summary.totalOutstandingDebt}`);
        console.log(`  totalDebtors: ${summary.totalDebtors}`);
        console.log("✓ Summary retrieved successfully\n");
    } catch (error) {
        console.error("✗ STEP 6 FAILED:", error.message, "\n");
    }

    // STEP 7 — Get Customers
    try {
        console.log("STEP 7 — Get Customers");
        console.log("GET /api/getCustomers");
        const customers = await get(`${BASE}/api/getCustomers`);
        console.log(`Result: Array with ${customers.length} customers`);
        
        // Validate array structure
        if (!Array.isArray(customers)) {
            throw new Error("Response is not an array");
        }
        
        // Validate each customer has required fields
        if (customers.length > 0) {
            const firstCustomer = customers[0];
            const requiredFields = ['id', 'name', 'balance', 'receipts', 'totalDebt', 'totalPaid'];
            const missingFields = requiredFields.filter(field => !(field in firstCustomer));
            
            if (missingFields.length === 0) {
                console.log("✓ All customers have required fields:");
                console.log(`  - id: ${firstCustomer.id}`);
                console.log(`  - name: ${firstCustomer.name}`);
                console.log(`  - balance: ${firstCustomer.balance}`);
                console.log(`  - receipts: ${firstCustomer.receipts}`);
                console.log(`  - totalDebt: ${firstCustomer.totalDebt}`);
                console.log(`  - totalPaid: ${firstCustomer.totalPaid}`);
            } else {
                console.warn(`⚠ Missing fields in customer object: ${missingFields.join(', ')}`);
            }
        } else {
            console.log("⚠ No customers found in database");
        }
        console.log("✓ Customers list retrieved successfully\n");
    } catch (error) {
        console.error("✗ STEP 7 FAILED:", error.message, "\n");
    }

    console.log("=========================================");
    console.log("ALL BACKEND TESTS COMPLETED");
    console.log("=========================================");
})();

