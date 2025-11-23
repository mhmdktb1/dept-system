/* ====================================
   Chocair Fresh - Debt Manager Scripts
   Single-Page Application
   ==================================== */

// Backend API Base URL
const BASE = "https://chocair-fresh-debt-system-e2rsgk57e-mhmds-projects-fc809501.vercel.app";

/**
 * Fetch all customers from the backend API
 * @returns {Promise<Array>} Array of customer objects with id, name, receipts, totalDebt, totalPaid, and balance
 */
async function fetchCustomers() {
    try {
        const response = await fetch(`${BASE}/api/getCustomers`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch customers' }));
            throw new Error(errorData.error || 'Failed to fetch customers');
        }
        
        const customers = await response.json();
        return customers;
    } catch (error) {
        console.error('Error fetching customers:', error);
        alert('Error loading customers: ' + error.message);
        throw error;
    }
}

/**
 * Calculate total outstanding debt from customers array
 * This calculates the sum of all customer balances (totalDebt - totalPaid)
 * @param {Array} customers - Array of customer objects with balance property
 * @returns {number} Total outstanding debt amount
 */
function getTotalDebt(customers) {
    if (!customers || customers.length === 0) {
        return 0;
    }
    
    return customers.reduce((total, customer) => {
        // Use balance (totalDebt - totalPaid) instead of just totalDebt
        // This gives the actual amount owed, not just total debt incurred
        return total + (customer.balance || 0);
    }, 0);
}

/**
 * Add a new customer via the backend API
 * @param {Object} customerData - Customer data object with name, phone, and note
 * @returns {Promise<Object>} The created customer object with success status
 */
async function addCustomer(customerData) {
    try {
        const response = await fetch(`${BASE}/api/addCustomer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(customerData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to add customer' }));
            throw new Error(errorData.error || 'Failed to add customer');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error adding customer:', error);
        throw error;
    }
}

/**
 * Upload a file to Google Drive
 * @param {File} file - The file to upload
 * @returns {Promise<string|null>} The public URL of the uploaded file, or null if upload failed
 */
async function uploadToGoogleDrive(file) {
    if (!googleAccessToken) {
        alert("Please press 'Connect Google Drive' first.");
        return null;
    }

    const metadata = {
        name: `${Date.now()}_${file.name}`,
        parents: [GOOGLE_FOLDER_ID],
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${googleAccessToken}`,
            },
            body: form,
        }
    );

    const data = await response.json();

    if (data.id) {
        return `https://drive.google.com/uc?id=${data.id}`;
    } else {
        console.error("Upload failed:", data);
        return null;
    }
}

/**
 * Load system summary from the backend API
 * Fetches total outstanding debt and updates the display
 * This function is called on page load to populate the "Total Outstanding Debt" card
 * @returns {Promise<void>}
 */
async function loadSummary() {
    const totalDebtElement = document.getElementById('totalDebtAmount');
    
    if (!totalDebtElement) {
        console.error('Total debt element not found');
        return;
    }

    // Set loading state
    totalDebtElement.textContent = 'Loading...';

    try {
        const response = await fetch(`${BASE}/api/getSummary`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch summary' }));
            throw new Error(errorData.error || 'Failed to fetch summary');
        }

        const summary = await response.json();
        
        // Extract totalOutstandingDebt and format to two decimals
        const totalOutstandingDebt = summary.totalOutstandingDebt || 0;
        
        // Update the display using the existing updateTotalDebtDisplay function
        // This ensures the eye toggle functionality still works correctly
        // The function will handle the visibility state (show/hide with eye icon)
        if (typeof window.updateTotalDebtDisplay === 'function') {
            window.updateTotalDebtDisplay(totalOutstandingDebt);
        } else {
            // Fallback: directly update the element if function not available yet
            // This can happen if script.js loads before the inline script in index.html
            const formattedValue = totalOutstandingDebt.toFixed(2);
            totalDebtElement.textContent = `$${formattedValue}`;
        }
    } catch (error) {
        console.error('Error loading summary:', error);
        totalDebtElement.textContent = 'Error';
    }
}