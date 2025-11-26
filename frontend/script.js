/* ====================================
   Chocair Fresh - Debt Manager Scripts
   Single-Page Application
   Connected to Render Backend
   ==================================== */

// Backend API Base URL
const BASE_URL = "https://dept-system.onrender.com"; // Correct Backend URL
// const BASE_URL = "https://chocair-fresh-backend.onrender.com"; // New Render Service Name

// --- GOOGLE PICKER CONFIGURATION ---
const GOOGLE_CLIENT_ID = "780794685039-gbqdfps9jk1hjv88r3qc1dhp08flks52.apps.googleusercontent.com";
const GOOGLE_DRIVE_FOLDER_ID = "1eBdacCCyxqNb045b7tDHx6ei5DYBVbiI";
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let accessToken = null;
let pickerInited = false;
let selectedInvoiceUrl = null;

// Global state
let allCustomers = [];
let currentCustomerId = null;
let isDebtVisible = true;

// ====================================
// GOOGLE PICKER LOGIC
// ====================================

// Load the Picker API
gapi.load('picker', onPickerApiLoad);

function onPickerApiLoad() {
    pickerInited = true;
}

// Initialize the Identity Client
function initializeGoogleAuth() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
                if (response.error !== undefined) {
                    throw (response);
                }
                accessToken = response.access_token;
                updateConnectButtonState(true);
                showToast('Google Drive Connected!', 'success');
            },
        });
    } catch (e) {
        console.log("Google Identity Services not loaded yet, waiting...");
        setTimeout(initializeGoogleAuth, 500);
    }
}

// Call initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGoogleAuth);
} else {
    initializeGoogleAuth();
}

function handleConnectClick() {
    if (accessToken) {
        showToast('Already connected to Google Drive', 'info');
        return;
    }
    // Request authorization
    tokenClient.requestAccessToken({prompt: ''});
}

function updateConnectButtonState(isConnected) {
    const btn = document.getElementById('connectDriveBtn');
    if (btn) {
        if (isConnected) {
            btn.textContent = 'Drive Connected';
            btn.classList.remove('btn--secondary');
            btn.classList.add('btn--success'); // You might need to define this class or use inline style
            btn.style.backgroundColor = '#28a745';
            btn.style.color = 'white';
        } else {
            btn.textContent = 'Connect Drive';
        }
    }
}

function openPicker() {
    if (!accessToken) {
        alert("Please connect to Google Drive first (Top Right Button)");
        return;
    }
    
    if (!pickerInited) {
        alert("Google Picker API not loaded yet. Please refresh.");
        return;
    }
    
    const view = new google.picker.DocsUploadView();
    view.setParent(GOOGLE_DRIVE_FOLDER_ID);

    const picker = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback(pickerCallback)
        .build();
    
    picker.setVisible(true);
}

function pickerCallback(data) {
    if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
        const doc = data[google.picker.Response.DOCUMENTS][0];
        const fileId = doc[google.picker.Document.ID];
        const fileName = doc[google.picker.Document.NAME];
        
        selectedInvoiceUrl = `https://drive.google.com/uc?id=${fileId}`;
        
        const statusText = document.getElementById('picker-status-text');
        if (statusText) {
            statusText.textContent = `Selected: ${fileName}`;
            statusText.style.color = "green";
        }
    }
}

/**
 * Upload file directly to Google Drive using API
 * @param {File} file 
 */
async function uploadFileToDrive(file) {
    if (!accessToken) {
        alert("Please connect to Google Drive first");
        return;
    }

    const statusText = document.getElementById('picker-status-text');
    if (statusText) {
        statusText.textContent = 'Uploading image...';
        statusText.style.color = 'blue';
    }

    const metadata = {
        'name': file.name,
        'parents': [GOOGLE_DRIVE_FOLDER_ID]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken
            },
            body: form
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const data = await response.json();
        const fileId = data.id;
        
        selectedInvoiceUrl = `https://drive.google.com/uc?id=${fileId}`;
        
        if (statusText) {
            statusText.textContent = `Uploaded: ${file.name}`;
            statusText.style.color = "green";
        }
        
    } catch (error) {
        console.error('Drive upload error:', error);
        if (statusText) {
            statusText.textContent = 'Upload failed. Try again.';
            statusText.style.color = 'red';
        }
        alert('Failed to upload to Google Drive: ' + error.message);
    }
}

// ====================================
// API FUNCTIONS
// ====================================

/**
 * Load all customers from the backend
 * @returns {Promise<Array>} Array of customer objects
 */
async function loadCustomers() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const customerList = document.getElementById('customerList');
    const emptyState = document.getElementById('emptyState');
    
    try {
        // Show loading state
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (customerList) customerList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';
        
        const response = await fetch(`${BASE_URL}/api/getCustomers`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch customers' }));
            throw new Error(errorData.error || 'Failed to fetch customers');
        }
        
        allCustomers = await response.json();
        
        // Update UI
        renderCustomerList(allCustomers);
        updateTotalDebt();
        
        // Hide loading, show empty state if needed
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (allCustomers.length === 0 && emptyState) {
            emptyState.style.display = 'block';
        }
        
        return allCustomers;
    } catch (error) {
        console.error('Error loading customers:', error);
        alert('Error loading customers: ' + error.message);
        
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        
        throw error;
    }
}

/**
 * Load detailed information for a specific customer
 * @param {string} customerId - The customer ID
 */
async function loadCustomerDetails(customerId) {
    const detailsPanel = document.getElementById('detailsPanel');
    const noSelectionPlaceholder = document.getElementById('noSelectionPlaceholder');
    const customerInfo = document.getElementById('customerInfo');
    const transactionsList = document.getElementById('transactionsList');
    
    try {
        // Show loading state
        if (customerInfo) customerInfo.innerHTML = '<div class="loading">Loading customer details...</div>';
        if (transactionsList) transactionsList.innerHTML = '';
        
        const response = await fetch(`${BASE_URL}/api/getCustomer?id=${customerId}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch customer details' }));
            throw new Error(errorData.error || 'Failed to fetch customer details');
        }
        
        const customer = await response.json();
        currentCustomerId = customerId;
        
        // Update UI
        renderCustomerDetails(customer);
        renderTransactions(customer.transactions || []);
        
        // Show details panel
        if (detailsPanel) detailsPanel.style.display = 'flex';
        if (noSelectionPlaceholder) noSelectionPlaceholder.style.display = 'none';
        
        // Update active customer in list
        updateActiveCustomer(customerId);
        
    } catch (error) {
        console.error('Error loading customer details:', error);
        alert('Error loading customer details: ' + error.message);
        
        if (customerInfo) customerInfo.innerHTML = '<div class="error">Failed to load customer details</div>';
    }
}

/**
 * Add a new customer
 * @param {string} name - Customer name
 * @param {string} phone - Customer phone number
 * @param {string} note - Optional notes
 */
async function addCustomer(name, phone, note) {
    try {
        const response = await fetch(`${BASE_URL}/api/addCustomer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                phone: phone,
                note: note || ''
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to add customer' }));
            throw new Error(errorData.error || 'Failed to add customer');
        }

        const result = await response.json();
        
        // Reload customer list
        await loadCustomers();
        
        // Show success message
        showToast('Customer added successfully', 'success');
        
        return result;
    } catch (error) {
        console.error('Error adding customer:', error);
        alert('Error adding customer: ' + error.message);
        throw error;
    }
}

/**
 * Add a debt transaction for a customer
 * @param {string} customerId - Customer ID
 * @param {number} amount - Debt amount
 * @param {string} note - Optional note
 * @param {string} invoiceImageUrl - Optional invoice image URL
 */
async function addDebt(customerId, amount, note, invoiceImageUrl) {
    try {
        const response = await fetch(`${BASE_URL}/api/addDebt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customerId: customerId,
                amount: amount,
                note: note || '',
                invoiceImageUrl: invoiceImageUrl || null
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to add debt' }));
            throw new Error(errorData.error || 'Failed to add debt');
        }
        
        const result = await response.json();
        
        // Reload customer details
        await loadCustomerDetails(customerId);
        
        // Reload customer list to update balances
        await loadCustomers();
        
        // Show success message
        showToast('Debt added successfully', 'success');
        
        return result;
    } catch (error) {
        console.error('Error adding debt:', error);
        alert('Error adding debt: ' + error.message);
        throw error;
    }
}

/**
 * Add a payment transaction for a customer
 * @param {string} customerId - Customer ID
 * @param {number} amount - Payment amount
 * @param {string} note - Optional note
 */
async function addPayment(customerId, amount, note) {
    try {
        const response = await fetch(`${BASE_URL}/api/addPayment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customerId: customerId,
                amount: amount,
                note: note || ''
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to add payment' }));
            throw new Error(errorData.error || 'Failed to add payment');
        }
        
        const result = await response.json();
        
        // Reload customer details
        await loadCustomerDetails(customerId);
        
        // Reload customer list to update balances
        await loadCustomers();
        
        // Show success message
        showToast('Payment added successfully', 'success');
        
        return result;
    } catch (error) {
        console.error('Error adding payment:', error);
        alert('Error adding payment: ' + error.message);
        throw error;
    }
}

/**
 * Update customer details
 * @param {string} customerId - Customer ID
 * @param {string} name - Customer name
 * @param {string} phone - Customer phone number
 * @param {string} note - Optional notes
 */
async function updateCustomer(customerId, name, phone, note) {
    try {
        const response = await fetch(`${BASE_URL}/api/updateCustomer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customerId: customerId,
                name: name,
                phone: phone,
                note: note || ''
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to update customer' }));
            throw new Error(errorData.error || 'Failed to update customer');
        }

        const result = await response.json();
        
        // Reload customer details
        await loadCustomerDetails(customerId);
        
        // Reload customer list
        await loadCustomers();
        
        // Show success message
        showToast('Customer updated successfully', 'success');
        
        return result;
    } catch (error) {
        console.error('Error updating customer:', error);
        alert('Error updating customer: ' + error.message);
        throw error;
    }
}

/**
 * Delete a customer
 * @param {string} customerId - Customer ID
 */
async function deleteCustomer(customerId) {
    if (!confirm('Are you sure you want to delete this customer? This action cannot be undone and will delete all their transaction history.')) {
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/deleteCustomer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customerId: customerId
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to delete customer' }));
            throw new Error(errorData.error || 'Failed to delete customer');
        }

        // Clear current selection
        currentCustomerId = null;
        const detailsPanel = document.getElementById('detailsPanel');
        const noSelectionPlaceholder = document.getElementById('noSelectionPlaceholder');
        
        if (detailsPanel) detailsPanel.style.display = 'none';
        if (noSelectionPlaceholder) noSelectionPlaceholder.style.display = 'flex';
        
        // Reload customer list
        await loadCustomers();
        
        // Show success message
        showToast('Customer deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Error deleting customer: ' + error.message);
        throw error;
    }
}

/**
 * Close customer balance (pay off entire debt)
 * @param {string} customerId - Customer ID
 */
async function closeBalance(customerId) {
    // Find customer to get current balance
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;
    
    const balance = customer.balance || 0;
    
    if (balance <= 0) {
        alert('Customer has no outstanding debt to pay.');
        return;
    }
    
    if (!confirm(`Are you sure you want to close the balance of $${balance.toFixed(2)}? This will add a payment for the full amount.`)) {
        return;
    }
    
    try {
        await addPayment(customerId, balance, 'Balance closed via "Close Balance"');
    } catch (error) {
        // Error handled in addPayment
    }
}

// ====================================
// UI RENDERING FUNCTIONS
// ====================================

/**
 * Render the customer list
 * @param {Array} customers - Array of customer objects
 */
function renderCustomerList(customers) {
    const customerList = document.getElementById('customerList');
    if (!customerList) return;
    
    if (customers.length === 0) {
        customerList.innerHTML = '';
        return;
    }
    
    customerList.innerHTML = customers.map(customer => {
        const balance = customer.balance || 0;
        const balanceClass = balance > 0 ? 'customer-card__balance--positive' : 
                            balance === 0 ? 'customer-card__balance--zero' : '';
        const balanceText = balance > 0 ? `$${Math.abs(balance).toFixed(2)}` : 
                          balance === 0 ? '$0.00' : 
                          `-$${Math.abs(balance).toFixed(2)}`;
        
        return `
            <div class="customer-card" data-customer-id="${customer.id}">
                <div class="customer-card__content">
                    <h3 class="customer-card__name">${escapeHtml(customer.name || 'Unknown')}</h3>
                    <div class="customer-card__info">
                        <span class="customer-card__item">Phone: ${escapeHtml(customer.phone || 'N/A')}</span>
                        <span class="customer-card__balance ${balanceClass}">Balance: ${balanceText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click event listeners to customer cards
    customerList.querySelectorAll('.customer-card').forEach(card => {
        card.addEventListener('click', () => {
            const customerId = card.getAttribute('data-customer-id');
            if (customerId) {
                loadCustomerDetails(customerId);
            }
        });
    });
}

/**
 * Update active customer in the list
 * @param {string} customerId - Active customer ID
 */
function updateActiveCustomer(customerId) {
    document.querySelectorAll('.customer-card').forEach(card => {
        if (card.getAttribute('data-customer-id') === customerId) {
            card.classList.add('customer-card--active');
        } else {
            card.classList.remove('customer-card--active');
        }
    });
}

/**
 * Render customer details in the details panel
 * @param {Object} customer - Customer object with full details
 */
function renderCustomerDetails(customer) {
    const customerInfo = document.getElementById('customerInfo');
    if (!customerInfo) return;
    
    const balance = customer.balance || 0;
    const balanceClass = balance > 0 ? 'customer-info__value--positive' : 
                        balance === 0 ? 'customer-info__value--zero' : 
                        'customer-info__value--negative';
    const balanceText = balance > 0 ? `$${Math.abs(balance).toFixed(2)}` : 
                       balance === 0 ? '$0.00' : 
                       `-$${Math.abs(balance).toFixed(2)}`;
    
    customerInfo.innerHTML = `
        <div class="customer-info__card">
            <h2 class="customer-info__name">${escapeHtml(customer.name || 'Unknown')}</h2>
            <div class="customer-info__grid">
                <div class="customer-info__item">
                    <span class="customer-info__label">Phone</span>
                    <span class="customer-info__value">${escapeHtml(customer.phone || 'N/A')}</span>
                </div>
                <div class="customer-info__item">
                    <span class="customer-info__label">Total Debt</span>
                    <span class="customer-info__value">$${(customer.totalDebt || 0).toFixed(2)}</span>
                </div>
                <div class="customer-info__item">
                    <span class="customer-info__label">Total Paid</span>
                    <span class="customer-info__value">$${(customer.totalPaid || 0).toFixed(2)}</span>
                </div>
                ${customer.note ? `
                <div class="customer-info__item">
                    <span class="customer-info__label">Notes</span>
                    <span class="customer-info__value">${escapeHtml(customer.note)}</span>
                </div>
                ` : ''}
                <div class="customer-info__item customer-info__item--balance">
                    <span class="customer-info__label">Current Balance</span>
                    <span class="customer-info__value ${balanceClass}">${balanceText}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render transactions list
 * @param {Array} transactions - Array of transaction objects
 */
function renderTransactions(transactions) {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    if (!transactions || transactions.length === 0) {
        transactionsList.innerHTML = '<div class="empty-message">No transactions found</div>';
        return;
    }
    
    // Sort transactions by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
    });
    
    transactionsList.innerHTML = sortedTransactions.map(transaction => {
        const isDebt = transaction.type === 'debt' || transaction.amount < 0;
        const amount = Math.abs(transaction.amount || 0);
        const date = new Date(transaction.date || transaction.createdAt || Date.now());
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="transaction-item">
                <div class="transaction-item__content">
                    <div class="transaction-item__header">
                        <span class="transaction-item__date">${formattedDate}</span>
                        <span class="transaction-item__type transaction-item__type--${isDebt ? 'debt' : 'payment'}">
                            ${isDebt ? 'DEBT' : 'PAYMENT'}
                        </span>
                    </div>
                    <div class="transaction-item__amount transaction-item__amount--${isDebt ? 'debt' : 'payment'}">
                        ${isDebt ? '+' : '-'}$${amount.toFixed(2)}
                    </div>
                    ${transaction.note ? `
                    <div class="transaction-item__note">${escapeHtml(transaction.note)}</div>
                    ` : ''}
                    ${transaction.invoiceImageUrl ? `
                    <a href="${transaction.invoiceImageUrl}" target="_blank" class="transaction-item__image">
                        View Invoice
                    </a>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update total outstanding debt display
 * Calculates sum of all customer balances
 */
function updateTotalDebt() {
    const totalDebt = allCustomers.reduce((sum, customer) => {
        return sum + (customer.balance || 0);
    }, 0);
    
    const totalDebtElement = document.getElementById('totalDebtAmount');
    if (!totalDebtElement) return;
    
    if (isDebtVisible) {
        totalDebtElement.textContent = `$${totalDebt.toFixed(2)}`;
    } else {
        totalDebtElement.textContent = '******';
    }
    
    // Store the value for toggle functionality
    window.totalDebtValue = totalDebt;
}

/**
 * Toggle debt visibility
 */
function toggleDebtVisibility() {
    isDebtVisible = !isDebtVisible;
    updateTotalDebt();
    
    // Update eye icon (if exists)
    const eyeIcon = document.getElementById('eyeIcon');
    if (eyeIcon) {
        // Simple toggle - you can enhance this with different SVG icons
        eyeIcon.style.opacity = isDebtVisible ? '1' : '0.5';
    }
}

// ====================================
// SEARCH AND SORT
// ====================================

/**
 * Filter customers based on search query
 * @param {string} query - Search query
 */
function filterCustomers(query) {
    if (!query || query.trim() === '') {
        renderCustomerList(allCustomers);
        return;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    const filtered = allCustomers.filter(customer => {
        const name = (customer.name || '').toLowerCase();
        const phone = (customer.phone || '').toLowerCase();
        return name.includes(lowerQuery) || phone.includes(lowerQuery);
    });
    
    renderCustomerList(filtered);
}

/**
 * Sort customers based on selected option
 * @param {string} sortOption - Sort option (name_asc, name_desc, balance_desc, balance_asc)
 */
function sortCustomers(sortOption) {
    let sorted = [...allCustomers];
    
    switch (sortOption) {
        case 'name_asc':
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
        case 'name_desc':
            sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
            break;
        case 'balance_desc':
            sorted.sort((a, b) => (b.balance || 0) - (a.balance || 0));
            break;
        case 'balance_asc':
            sorted.sort((a, b) => (a.balance || 0) - (b.balance || 0));
            break;
    }
    
    renderCustomerList(sorted);
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'info'
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <span class="toast__icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
        <span class="toast__message">${escapeHtml(message)}</span>
        <button class="toast__close">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('toast--hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
    
    // Close button
    toast.querySelector('.toast__close').addEventListener('click', () => {
        toast.classList.add('toast--hiding');
        setTimeout(() => toast.remove(), 300);
    });
}

// ====================================
// MODAL HANDLERS
// ====================================

/**
 * Show modal
 * @param {string} modalId - Modal element ID
 */
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('modal--show');
    }
}

/**
 * Hide modal
 * @param {string} modalId - Modal element ID
 */
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('modal--show');
    }
}

/**
 * Reset form
 * @param {string} formId - Form element ID
 */
function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
    }
}

// ====================================
// EVENT LISTENERS SETUP
// ====================================

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
    // Add Customer Button
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    if (addCustomerBtn) {
        addCustomerBtn.addEventListener('click', () => {
            showModal('addCustomerModal');
        });
    }
    
    // Add Customer Form
    const addCustomerForm = document.getElementById('addCustomerForm');
    if (addCustomerForm) {
        addCustomerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('customerName').value.trim();
            const phone = document.getElementById('customerPhone').value.trim();
            const note = document.getElementById('customerNotes').value.trim();
            
            if (!name || !phone) {
                alert('Please fill in all required fields');
                return;
            }
            
            try {
                await addCustomer(name, phone, note);
                hideModal('addCustomerModal');
                resetForm('addCustomerForm');
            } catch (error) {
                // Error already handled in addCustomer function
            }
        });
    }
    
    // Close Customer Modal
    const closeCustomerModal = document.getElementById('closeCustomerModal');
    const cancelCustomerBtn = document.getElementById('cancelCustomerBtn');
    if (closeCustomerModal) {
        closeCustomerModal.addEventListener('click', () => {
            hideModal('addCustomerModal');
            resetForm('addCustomerForm');
        });
    }
    if (cancelCustomerBtn) {
        cancelCustomerBtn.addEventListener('click', () => {
            hideModal('addCustomerModal');
            resetForm('addCustomerForm');
        });
    }
    
    // Add Debt Button
    const addDebtBtn = document.getElementById('addDebtBtn');
    if (addDebtBtn) {
        addDebtBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert('Please select a customer first');
                return;
            }
            showModal('addDebtModal');
        });
    }
    
    // Add Debt Form
    const addDebtForm = document.getElementById('addDebtForm');
    if (addDebtForm) {
        addDebtForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentCustomerId) {
                alert('No customer selected');
                return;
            }
            
            const amount = parseFloat(document.getElementById('debtAmount').value);
            const note = document.getElementById('debtNote').value.trim();
            
            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }

            // Use the selected Google Drive file URL
            const invoiceImageUrl = selectedInvoiceUrl;
            
            try {
                await addDebt(currentCustomerId, amount, note, invoiceImageUrl);
                hideModal('addDebtModal');
                resetForm('addDebtForm');
                
                // Reset the selected file
                selectedInvoiceUrl = null;
                const fileStatus = document.getElementById('picker-status-text');
                if (fileStatus) {
                    fileStatus.textContent = '';
                    fileStatus.style.color = '#666';
                }
            } catch (error) {
                // Error already handled in addDebt function
            }
        });
    }

    // Google Drive Picker Button
    const selectDriveFileBtn = document.getElementById('btn-pick-invoice');
    if (selectDriveFileBtn) {
        selectDriveFileBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission if inside a form
            handleAuthClick();
        });
    }
    
    // Close Debt Modal
    const closeDebtModal = document.getElementById('closeDebtModal');
    const cancelDebtBtn = document.getElementById('cancelDebtBtn');
    if (closeDebtModal) {
        closeDebtModal.addEventListener('click', () => {
            hideModal('addDebtModal');
            resetForm('addDebtForm');
        });
    }
    if (cancelDebtBtn) {
        cancelDebtBtn.addEventListener('click', () => {
            hideModal('addDebtModal');
            resetForm('addDebtForm');
        });
    }
    
    // Add Payment Button
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert('Please select a customer first');
                return;
            }
            showModal('addPaymentModal');
        });
    }
    
    // Connect Drive Button
    const connectDriveBtn = document.getElementById('connectDriveBtn');
    if (connectDriveBtn) {
        connectDriveBtn.addEventListener('click', handleConnectClick);
    }

    // Camera Button
    const btnCameraInvoice = document.getElementById('btn-camera-invoice');
    const cameraInput = document.getElementById('cameraInput');
    
    if (btnCameraInvoice && cameraInput) {
        btnCameraInvoice.addEventListener('click', () => {
            cameraInput.click();
        });
        
        cameraInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                await uploadFileToDrive(e.target.files[0]);
            }
        });
    }

    // Add Payment Form
    const addPaymentForm = document.getElementById('addPaymentForm');
    if (addPaymentForm) {
        addPaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentCustomerId) {
                alert('No customer selected');
                return;
            }
            
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            const note = document.getElementById('paymentNote').value.trim();
            
            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }
            
            try {
                await addPayment(currentCustomerId, amount, note);
                hideModal('addPaymentModal');
                resetForm('addPaymentForm');
            } catch (error) {
                // Error already handled in addPayment function
            }
        });
    }
    
    // Close Payment Modal
    const closePaymentModal = document.getElementById('closePaymentModal');
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    if (closePaymentModal) {
        closePaymentModal.addEventListener('click', () => {
            hideModal('addPaymentModal');
            resetForm('addPaymentForm');
        });
    }
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', () => {
            hideModal('addPaymentModal');
            resetForm('addPaymentForm');
        });
    }

    // Edit Customer Button
    const editCustomerBtn = document.getElementById('editCustomerBtn');
    if (editCustomerBtn) {
        editCustomerBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert('Please select a customer first');
                return;
            }
            
            const customer = allCustomers.find(c => c.id === currentCustomerId);
            if (!customer) return;
            
            // Populate form
            document.getElementById('editCustomerName').value = customer.name || '';
            document.getElementById('editCustomerPhone').value = customer.phone || '';
            document.getElementById('editCustomerNotes').value = customer.note || '';
            
            showModal('editCustomerModal');
        });
    }
    
    // Edit Customer Form
    const editCustomerForm = document.getElementById('editCustomerForm');
    if (editCustomerForm) {
        editCustomerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentCustomerId) return;
            
            const name = document.getElementById('editCustomerName').value.trim();
            const phone = document.getElementById('editCustomerPhone').value.trim();
            const note = document.getElementById('editCustomerNotes').value.trim();
            
            if (!name || !phone) {
                alert('Please fill in all required fields');
                return;
            }
            
            try {
                await updateCustomer(currentCustomerId, name, phone, note);
                hideModal('editCustomerModal');
            } catch (error) {
                // Error handled in updateCustomer
            }
        });
    }
    
    // Close Edit Customer Modal
    const closeEditCustomerModal = document.getElementById('closeEditCustomerModal');
    const cancelEditCustomerBtn = document.getElementById('cancelEditCustomerBtn');
    if (closeEditCustomerModal) {
        closeEditCustomerModal.addEventListener('click', () => {
            hideModal('editCustomerModal');
        });
    }
    if (cancelEditCustomerBtn) {
        cancelEditCustomerBtn.addEventListener('click', () => {
            hideModal('editCustomerModal');
        });
    }
    
    // Delete Customer Button
    const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');
    if (deleteCustomerBtn) {
        deleteCustomerBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert('Please select a customer first');
                return;
            }
            deleteCustomer(currentCustomerId);
        });
    }
    
    // Close Balance Button
    const closeBalanceBtn = document.getElementById('closeBalanceBtn');
    if (closeBalanceBtn) {
        closeBalanceBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert('Please select a customer first');
                return;
            }
            closeBalance(currentCustomerId);
        });
    }
    
    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterCustomers(e.target.value);
        });
    }
    
    // Sort Select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            sortCustomers(e.target.value);
        });
    }

    // Google Drive Button
    const googleDriveBtn = document.getElementById('googleDriveBtn');
    if (googleDriveBtn) {
        googleDriveBtn.addEventListener('click', handleGoogleAuthClick);
    }
    
    // Eye Toggle Button (Total Debt Visibility)
    const eyeToggleBtn = document.getElementById('eyeToggleBtn');
    if (eyeToggleBtn) {
        eyeToggleBtn.addEventListener('click', () => {
            toggleDebtVisibility();
        });
    }
    
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('modal--show');
            }
        });
    });
}

// ====================================
// INITIALIZATION
// ====================================

/**
 * Initialize the application
 */
async function initializeApp() {
    // Check Backend Health
    try {
        const healthCheck = await fetch(`${BASE_URL}/health`);
        if (!healthCheck.ok) {
            console.warn('Backend health check failed');
            showToast('Warning: Backend might be down', 'error');
        } else {
            console.log('Backend is online');
        }
    } catch (e) {
        console.error('Backend unreachable:', e);
        showToast('Error: Cannot connect to server. Please wait for it to wake up.', 'error');
    }

    // Set up event listeners
    initializeEventListeners();
    
    // Load initial data
    try {
        await loadCustomers();
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
