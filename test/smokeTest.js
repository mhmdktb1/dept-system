/**
 * Smoke Test - Full Real-World Customer Workflow Simulation
 * 
 * This script simulates a complete customer workflow to verify the entire
 * debt management system works correctly in a real-world scenario.
 * 
 * Usage:
 *   node test/smokeTest.js
 * 
 * Prerequisites:
 * - Node.js 18+ (for native fetch support)
 * - Backend server must be running on http://localhost:3000
 * - MongoDB connection must be configured
 * - Environment variables (MONGO_URI) must be set
 */

const BASE = "http://localhost:3000";

/**
 * Helper function to make POST requests
 * @param {string} url - The endpoint URL
 * @param {object} body - The request body
 * @returns {Promise<object>} The JSON response
 */
async function post(url, body) {
    try {
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
    } catch (error) {
        // Provide more detailed error information
        if (error.message.includes('fetch failed') || error.code === 'ECONNREFUSED') {
            throw new Error(`Connection failed to ${url}. Is the server running? Error: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Helper function to make GET requests
 * @param {string} url - The endpoint URL
 * @returns {Promise<object>} The JSON response
 */
async function get(url) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        // Provide more detailed error information
        if (error.message.includes('fetch failed') || error.code === 'ECONNREFUSED') {
            throw new Error(`Connection failed to ${url}. Is the server running? Error: ${error.message}`);
        }
        throw error;
    }
}

// Main smoke test execution
(async () => {
    console.log("=========================================");
    console.log("🔥 SMOKE TEST - REAL-WORLD SIMULATION 🔥");
    console.log("=========================================\n");

    let customerId = null;
    let firstTransactionId = null;

    // STEP 1 — Create a NEW customer
    try {
        console.log("STEP 1 — Create a NEW customer");
        const result = await post(`${BASE}/api/addCustomer`, {
            name: "Smoke Test Customer",
            phone: "70000001",
            note: "Created by smoke test"
        });
        
        if (result.customerId) {
            customerId = result.customerId;
            console.log(`✓ SUCCESS: Customer created with ID: ${customerId}\n`);
        } else {
            throw new Error("No customerId returned from API");
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}`);
        console.error("Cannot continue without customer ID. Exiting...\n");
        process.exit(1);
    }

    // STEP 2 — Add a DEBT for this customer
    try {
        console.log("STEP 2 — Add a DEBT for this customer");
        const result = await post(`${BASE}/api/addDebt`, {
            customerId: customerId,
            amount: 120,
            note: "Smoke test initial debt",
            invoiceImageUrl: null
        });
        
        if (result.transactionId) {
            firstTransactionId = result.transactionId;
            console.log(`✓ SUCCESS: Debt transaction created with ID: ${firstTransactionId}\n`);
        } else {
            throw new Error("No transactionId returned from API");
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}\n`);
    }

    // STEP 3 — Add ANOTHER DEBT
    try {
        console.log("STEP 3 — Add ANOTHER DEBT");
        const result = await post(`${BASE}/api/addDebt`, {
            customerId: customerId,
            amount: 30,
            note: "Second debt",
            invoiceImageUrl: null
        });
        
        if (result.transactionId) {
            console.log(`✓ SUCCESS: Second debt transaction created with ID: ${result.transactionId}\n`);
        } else {
            throw new Error("No transactionId returned from API");
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}\n`);
    }

    // STEP 4 — Add PAYMENT
    try {
        console.log("STEP 4 — Add PAYMENT");
        const result = await post(`${BASE}/api/addPayment`, {
            customerId: customerId,
            amount: 50,
            note: "First payment"
        });
        
        if (result.transactionId) {
            console.log(`✓ SUCCESS: Payment transaction created with ID: ${result.transactionId}\n`);
        } else {
            throw new Error("No transactionId returned from API");
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}\n`);
    }

    // STEP 5 — Get full customer details and validate
    try {
        console.log("STEP 5 — Get full customer details and validate");
        const customerDetails = await get(`${BASE}/api/getCustomer?id=${encodeURIComponent(customerId)}`);
        
        const totalDebt = customerDetails.totalDebt || 0;
        const totalPaid = customerDetails.totalPaid || 0;
        const balance = customerDetails.balance || 0;
        
        console.log(`  Current values:`);
        console.log(`    totalDebt: ${totalDebt} (expected: 150)`);
        console.log(`    totalPaid: ${totalPaid} (expected: 50)`);
        console.log(`    balance: ${balance} (expected: 100)`);
        
        const debtCorrect = totalDebt === 150;
        const paidCorrect = totalPaid === 50;
        const balanceCorrect = balance === 100;
        
        if (debtCorrect && paidCorrect && balanceCorrect) {
            console.log(`✓ SUCCESS: All values are correct\n`);
        } else {
            const errors = [];
            if (!debtCorrect) errors.push(`totalDebt is ${totalDebt}, expected 150`);
            if (!paidCorrect) errors.push(`totalPaid is ${totalPaid}, expected 50`);
            if (!balanceCorrect) errors.push(`balance is ${balance}, expected 100`);
            throw new Error(errors.join("; "));
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}\n`);
    }

    // STEP 6 — Delete the FIRST debt transaction and re-validate
    try {
        console.log("STEP 6 — Delete the FIRST debt transaction and re-validate");
        
        if (!firstTransactionId) {
            throw new Error("No first transaction ID available from previous step");
        }
        
        // Delete the first debt transaction
        const deleteResult = await post(`${BASE}/api/deleteTransaction`, {
            transactionId: firstTransactionId
        });
        
        if (!deleteResult.success) {
            throw new Error("Delete operation did not return success");
        }
        
        console.log(`✓ Transaction deleted successfully`);
        
        // Re-fetch customer details after deletion
        const customerDetails = await get(`${BASE}/api/getCustomer?id=${encodeURIComponent(customerId)}`);
        
        const totalDebt = customerDetails.totalDebt || 0;
        const totalPaid = customerDetails.totalPaid || 0;
        const balance = customerDetails.balance || 0;
        
        console.log(`  Values after deletion:`);
        console.log(`    totalDebt: ${totalDebt} (expected: 30)`);
        console.log(`    totalPaid: ${totalPaid} (expected: 50)`);
        console.log(`    balance: ${balance} (expected: -20)`);
        
        const debtCorrect = totalDebt === 30;
        const paidCorrect = totalPaid === 50;
        const balanceCorrect = balance === -20;
        
        if (debtCorrect && paidCorrect && balanceCorrect) {
            console.log(`✓ SUCCESS: All values are correct after deletion\n`);
        } else {
            const errors = [];
            if (!debtCorrect) errors.push(`totalDebt is ${totalDebt}, expected 30`);
            if (!paidCorrect) errors.push(`totalPaid is ${totalPaid}, expected 50`);
            if (!balanceCorrect) errors.push(`balance is ${balance}, expected -20`);
            throw new Error(errors.join("; "));
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}\n`);
    }

    // STEP 7 — Get global summary
    try {
        console.log("STEP 7 — Get global summary");
        const summary = await get(`${BASE}/api/getSummary`);
        
        console.log(`  Summary Statistics:`);
        console.log(`    totalCustomers: ${summary.totalCustomers}`);
        console.log(`    totalDebt: ${summary.totalDebt}`);
        console.log(`    totalPaid: ${summary.totalPaid}`);
        console.log(`    totalOutstandingDebt: ${summary.totalOutstandingDebt}`);
        console.log(`    totalDebtors: ${summary.totalDebtors}`);
        
        // Validate summary structure
        const requiredFields = ['totalCustomers', 'totalDebt', 'totalPaid', 'totalOutstandingDebt', 'totalDebtors'];
        const missingFields = requiredFields.filter(field => !(field in summary));
        
        if (missingFields.length === 0) {
            console.log(`✓ SUCCESS: Summary retrieved with all required fields\n`);
        } else {
            throw new Error(`Missing fields: ${missingFields.join(', ')}`);
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}\n`);
    }

    // STEP 8 — Get customer list and validate structure
    try {
        console.log("STEP 8 — Get customer list and validate structure");
        const customers = await get(`${BASE}/api/getCustomers`);
        
        // Validate array format
        if (!Array.isArray(customers)) {
            throw new Error("Response is not an array");
        }
        
        console.log(`  Found ${customers.length} customers in the system`);
        
        // Validate each customer has required fields
        const requiredFields = ['receipts', 'totalDebt', 'totalPaid', 'balance'];
        let allValid = true;
        const validationErrors = [];
        
        customers.forEach((customer, index) => {
            const missingFields = requiredFields.filter(field => !(field in customer));
            if (missingFields.length > 0) {
                allValid = false;
                validationErrors.push(`Customer ${index + 1} (${customer.name || 'unnamed'}) missing: ${missingFields.join(', ')}`);
            }
        });
        
        if (allValid && customers.length > 0) {
            // Show example customer structure
            const exampleCustomer = customers[0];
            console.log(`  Example customer structure:`);
            console.log(`    id: ${exampleCustomer.id}`);
            console.log(`    name: ${exampleCustomer.name}`);
            console.log(`    receipts: ${exampleCustomer.receipts}`);
            console.log(`    totalDebt: ${exampleCustomer.totalDebt}`);
            console.log(`    totalPaid: ${exampleCustomer.totalPaid}`);
            console.log(`    balance: ${exampleCustomer.balance}`);
            console.log(`✓ SUCCESS: All customers have required fields\n`);
        } else if (allValid && customers.length === 0) {
            console.log(`⚠ WARNING: No customers found in database`);
            console.log(`✓ SUCCESS: Array format is correct\n`);
        } else {
            throw new Error(validationErrors.join("; "));
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}\n`);
    }

    // STEP 9 — Cleanup: Delete the test customer
    try {
        console.log("STEP 9 — Cleanup: Delete the test customer");
        if (customerId) {
            const result = await post(`${BASE}/api/deleteCustomer`, {
                customerId: customerId
            });
            
            if (result.success) {
                console.log(`✓ SUCCESS: Test customer deleted\n`);
            } else {
                throw new Error("Failed to delete test customer");
            }
        } else {
            console.log("⚠ SKIPPED: No customer ID to delete\n");
        }
    } catch (error) {
        console.error(`✗ FAILURE: ${error.message}\n`);
    }

    console.log("=========================================");
    console.log("🔥 SMOKE TEST FINISHED 🔥");
    console.log("=========================================");
})();

