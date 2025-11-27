/* ====================================
   Chocair Fresh - Debt Manager Scripts
   Single-Page Application
   Connected to Render Backend
   ==================================== */

import { getLang, setLang, applyTranslations, translate } from './lang.js';
import { BASE_URL } from './config.js';

// Protection Check
const role = localStorage.getItem("role");
if (role !== "admin") {
    window.location.href = "login.html";
}

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
                showToast(translate('driveConnectedSuccess'), 'success');
            },
        });
    } catch (e) {
        console.log("Google Identity Services not loaded yet, waiting...");
        setTimeout(initializeGoogleAuth, 500);
    }
}

// Call initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeGoogleAuth();
        applyTranslations(); // Apply translations on load
    });
} else {
    initializeGoogleAuth();
    applyTranslations(); // Apply translations if already loaded
}

function handleConnectClick() {
    if (accessToken) {
        showToast(translate('alreadyConnected'), 'info');
        return;
    }
    // Request authorization
    tokenClient.requestAccessToken({prompt: ''});
}

function updateConnectButtonState(isConnected) {
    const btn = document.getElementById('connectDriveBtn');
    if (btn) {
        if (isConnected) {
            btn.textContent = translate('driveConnected');
            btn.classList.remove('btn--secondary');
            btn.classList.add('btn--success'); // You might need to define this class or use inline style
            btn.style.backgroundColor = '#28a745';
            btn.style.color = 'white';
        } else {
            btn.textContent = translate('connectDrive');
        }
    }
}

function openPicker() {
    if (!accessToken) {
        alert(translate('connectDriveFirst'));
        return;
    }
    
    if (!pickerInited) {
        alert(translate('googlePickerNotLoaded'));
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
            statusText.textContent = `${translate('selected')}: ${fileName}`;
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
        alert(translate('connectDriveFirst'));
        return;
    }

    const statusText = document.getElementById('picker-status-text');
    if (statusText) {
        statusText.textContent = translate('uploadingImage');
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
            statusText.textContent = `${translate('uploaded')}: ${file.name}`;
            statusText.style.color = "green";
        }
        
    } catch (error) {
        console.error('Drive upload error:', error);
        if (statusText) {
            statusText.textContent = translate('uploadFailed');
            statusText.style.color = 'red';
        }
        alert(translate('uploadFailed') + ': ' + error.message);
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
            const errorData = await response.json().catch(() => ({ error: translate('failedToFetchCustomers') }));
            throw new Error(errorData.error || translate('failedToFetchCustomers'));
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
        alert(translate('errorLoadingCustomers') + ': ' + error.message);
        
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
    // We now use the fullscreen modal instead of the details panel
    const modal = document.getElementById('customerDetailsModal');
    const modalCustomerName = document.getElementById('modalCustomerName');
    const modalCustomerInfo = document.getElementById('modalCustomerInfo');
    const modalTransactionsList = document.getElementById('modalTransactionsList');
    
    try {
        // Show loading state in modal
        if (modalCustomerInfo) modalCustomerInfo.innerHTML = `<div class="loading">${translate('loadingCustomerDetails')}</div>`;
        if (modalTransactionsList) modalTransactionsList.innerHTML = '';
        
        // Open modal immediately
        showModal('customerDetailsModal');
        
        const response = await fetch(`${BASE_URL}/api/getCustomer?id=${customerId}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: translate('failedToFetchCustomerDetails') }));
            throw new Error(errorData.error || translate('failedToFetchCustomerDetails'));
        }
        
        const customer = await response.json();
        currentCustomerId = customerId;
        
        // Update Modal Header
        if (modalCustomerName) modalCustomerName.textContent = customer.name;
        
        // Update Customer Info Card
        renderCustomerInfoCard(customer);
        
        // Render Recent Transactions (Last 5)
        renderRecentTransactions(customer.transactions || []);
        
        // Store full transactions for history view
        window.currentCustomerTransactions = customer.transactions || [];
        
        // Update active customer in list (visual only)
        updateActiveCustomer(customerId);
        
    } catch (error) {
        console.error('Error loading customer details:', error);
        alert(translate('errorLoadingCustomerDetails') + ': ' + error.message);
        hideModal('customerDetailsModal');
    }
}

function renderCustomerInfoCard(customer) {
    const modalCustomerInfo = document.getElementById('modalCustomerInfo');
    if (!modalCustomerInfo) return;

    const balance = customer.balance || 0;
    const balanceClass = balance > 0 ? 'text-danger' : 'text-success';
    
    modalCustomerInfo.innerHTML = `
        <h3>${escapeHtml(customer.name)}</h3>
        <div class="stat-row">
            <span class="stat-label">${translate('phoneNumber')}</span>
            <span class="stat-value">${escapeHtml(customer.phone || 'N/A')}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">${translate('totalDebt')}</span>
            <span class="stat-value text-danger">$${(customer.totalDebt || 0).toFixed(2)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">${translate('totalPaid')}</span>
            <span class="stat-value text-success">$${(customer.totalPaid || 0).toFixed(2)}</span>
        </div>
        <div class="stat-row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
            <span class="stat-label" style="font-weight: 700;">${translate('currentBalance')}</span>
            <span class="stat-value ${balanceClass}" style="font-size: 1.4rem;">$${balance.toFixed(2)}</span>
        </div>
        ${customer.note ? `
        <div style="margin-top: 16px; color: #666; font-size: 0.9rem;">
            <strong>${translate('notes')}:</strong><br>
            ${escapeHtml(customer.note)}
        </div>
        ` : ''}
    `;
}

function renderRecentTransactions(transactions) {
    const list = document.getElementById('modalTransactionsList');
    if (!list) return;
    
    if (!transactions || transactions.length === 0) {
        list.innerHTML = `<p style="color: #999; text-align: center;">${translate('noRecentTransactions')}</p>`;
        return;
    }
    
    // Sort by date desc
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, 5);
    
    list.innerHTML = recent.map(t => createTransactionHTML(t)).join('');
}

function createTransactionHTML(transaction) {
    const isDebt = ['debt', 'debit', 'DEBT'].includes(transaction.type);
    const amount = Math.abs(transaction.amount || 0);
    const date = new Date(transaction.date || transaction.createdAt);
    const dateStr = date.toLocaleDateString();
    
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee;">
            <div>
                <div style="font-weight: 600; color: ${isDebt ? '#e74c3c' : '#27ae60'}">
                    ${isDebt ? translate('debt') : translate('payment')}
                </div>
                <div style="font-size: 0.85rem; color: #999;">${dateStr}</div>
                ${transaction.note ? `<div style="font-size: 0.85rem; color: #666;">${escapeHtml(transaction.note)}</div>` : ''}
            </div>
            <div style="font-weight: 700; font-size: 1.1rem; color: ${isDebt ? '#e74c3c' : '#27ae60'}">
                ${isDebt ? '+' : '-'}$${amount.toFixed(2)}
            </div>
        </div>
    `;
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
            const errorData = await response.json().catch(() => ({ error: translate('failedToAddCustomer') }));
            throw new Error(errorData.error || translate('failedToAddCustomer'));
        }

        const result = await response.json();
        
        // Reload customer list
        await loadCustomers();
        
        // Show success message
        showToast(translate('customerAddedSuccess'), 'success');
        
        return result;
    } catch (error) {
        console.error('Error adding customer:', error);
        alert(translate('errorAddingCustomer') + ': ' + error.message);
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
            const errorData = await response.json().catch(() => ({ error: translate('failedToAddDebt') }));
            throw new Error(errorData.error || translate('failedToAddDebt'));
        }
        
        const result = await response.json();
        
        // Reload customer details
        await loadCustomerDetails(customerId);
        
        // Reload customer list to update balances
        await loadCustomers();
        
        // Show success message
        showToast(translate('debtAddedSuccess'), 'success');
        
        return result;
    } catch (error) {
        console.error('Error adding debt:', error);
        alert(translate('errorAddingDebt') + ': ' + error.message);
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
            const errorData = await response.json().catch(() => ({ error: translate('failedToAddPayment') }));
            throw new Error(errorData.error || translate('failedToAddPayment'));
        }
        
        const result = await response.json();
        
        // Reload customer details
        await loadCustomerDetails(customerId);
        
        // Reload customer list to update balances
        await loadCustomers();
        
        // Show success message
        showToast(translate('paymentAddedSuccess'), 'success');
        
        return result;
    } catch (error) {
        console.error('Error adding payment:', error);
        alert(translate('errorAddingPayment') + ': ' + error.message);
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
            const errorData = await response.json().catch(() => ({ error: translate('failedToUpdateCustomer') }));
            throw new Error(errorData.error || translate('failedToUpdateCustomer'));
        }

        const result = await response.json();
        
        // Reload customer details
        await loadCustomerDetails(customerId);
        
        // Reload customer list
        await loadCustomers();
        
        // Show success message
        showToast(translate('customerUpdatedSuccess'), 'success');
        
        return result;
    } catch (error) {
        console.error('Error updating customer:', error);
        alert(translate('errorUpdatingCustomer') + ': ' + error.message);
        throw error;
    }
}

/**
 * Delete a customer
 * @param {string} customerId - Customer ID
 */
async function deleteCustomer(customerId) {
    if (!confirm(translate('confirmDeleteCustomer'))) {
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
            const errorData = await response.json().catch(() => ({ error: translate('failedToDeleteCustomer') }));
            throw new Error(errorData.error || translate('failedToDeleteCustomer'));
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
        showToast(translate('customerDeletedSuccess'), 'success');
        
    } catch (error) {
        console.error('Error deleting customer:', error);
        alert(translate('errorDeletingCustomer') + ': ' + error.message);
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
        alert(translate('noOutstandingDebt'));
        return;
    }
    
    if (!confirm(translate('confirmCloseBalance').replace('{amount}', balance.toFixed(2)))) {
        return;
    }
    
    try {
        await addPayment(customerId, balance, translate('balanceClosedNote'));
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
                    <h3 class="customer-card__name">${escapeHtml(customer.name || translate('unknown'))}</h3>
                    <div class="customer-card__info">
                        <span class="customer-card__item">${translate('phone')}: ${escapeHtml(customer.phone || 'N/A')}</span>
                        <span class="customer-card__balance ${balanceClass}">${translate('balance')}: ${balanceText}</span>
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
                    <span class="customer-info__label">${translate('phone')}</span>
                    <span class="customer-info__value">${escapeHtml(customer.phone || 'N/A')}</span>
                </div>
                <div class="customer-info__item">
                    <span class="customer-info__label">${translate('totalDebt')}</span>
                    <span class="customer-info__value">$${(customer.totalDebt || 0).toFixed(2)}</span>
                </div>
                <div class="customer-info__item">
                    <span class="customer-info__label">${translate('totalPaid')}</span>
                    <span class="customer-info__value">$${(customer.totalPaid || 0).toFixed(2)}</span>
                </div>
                ${customer.note ? `
                <div class="customer-info__item">
                    <span class="customer-info__label">${translate('notes')}</span>
                    <span class="customer-info__value">${escapeHtml(customer.note)}</span>
                </div>
                ` : ''}
                <div class="customer-info__item customer-info__item--balance">
                    <span class="customer-info__label">${translate('currentBalance')}</span>
                    <span class="customer-info__value ${balanceClass}">${balanceText}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render full transactions history
 * @param {Array} transactions - Array of transaction objects
 */
function renderFullTransactionHistory(transactions) {
    const list = document.getElementById('fullTransactionsList');
    if (!list) return;
    
    if (!transactions || transactions.length === 0) {
        list.innerHTML = `<div class="empty-message">${translate('noTransactionsFound')}</div>`;
        return;
    }
    
    // Sort transactions by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
    });
    
    list.innerHTML = sortedTransactions.map(transaction => {
        const isDebt = ['debt', 'debit', 'DEBT'].includes(transaction.type) || (transaction.amount < 0 && transaction.type !== 'payment');
        const amount = Math.abs(transaction.amount || 0);
        const date = new Date(transaction.date || transaction.createdAt || Date.now());
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="transaction-item">
                <div class="transaction-item__content">
                    <div class="transaction-item__header">
                        <span class="transaction-item__date">${formattedDate}</span>
                        <span class="transaction-item__type transaction-item__type--${isDebt ? 'debt' : 'payment'}">
                            ${isDebt ? translate('debt').toUpperCase() : translate('payment').toUpperCase()}
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
                        ${translate('viewInvoice')}
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
    // --- Customer Details Modal & Dropdown ---
    
    // Close Customer Details Modal
    const closeCustomerDetailsModal = document.getElementById('closeCustomerDetailsModal');
    if (closeCustomerDetailsModal) {
        closeCustomerDetailsModal.addEventListener('click', () => {
            hideModal('customerDetailsModal');
        });
    }

    // Customer Menu Dropdown Toggle
    const customerMenuBtn = document.getElementById('customerMenuBtn');
    const customerMenuDropdown = document.getElementById('customerMenuDropdown');
    
    if (customerMenuBtn && customerMenuDropdown) {
        customerMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            customerMenuDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!customerMenuBtn.contains(e.target) && !customerMenuDropdown.contains(e.target)) {
                customerMenuDropdown.classList.remove('show');
            }
        });
    }

    // View Full History Button
    const viewHistoryBtn = document.getElementById('viewHistoryBtn');
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', () => {
            renderFullTransactionHistory(window.currentCustomerTransactions || []);
            showModal('transactionHistoryModal');
            if (customerMenuDropdown) customerMenuDropdown.classList.remove('show');
        });
    }

    // Generate PDF Statement Button
    const downloadStatementBtn = document.getElementById('downloadStatementBtn');
    if (downloadStatementBtn) {
        downloadStatementBtn.addEventListener('click', () => {
            if (!currentCustomerId) return;
            
            if (customerMenuDropdown) customerMenuDropdown.classList.remove('show');

            fetch(`${BASE_URL}/api/generateStatement?id=${currentCustomerId}`)
              .then(res => {
                  if (!res.ok) throw new Error('Failed to generate PDF');
                  return res.blob();
              })
              .then(blob => {
                 const url = window.URL.createObjectURL(blob);
                 const a = document.createElement("a");
                 a.href = url;
                 a.download = "statement.pdf";
                 document.body.appendChild(a);
                 a.click();
                 window.URL.revokeObjectURL(url);
                 document.body.removeChild(a);
              })
              .catch(err => {
                  console.error(err);
                  alert(translate('errorFetch'));
              });
        });
    }

    // Close History Modal
    const closeHistoryModal = document.getElementById('closeHistoryModal');
    if (closeHistoryModal) {
        closeHistoryModal.addEventListener('click', () => {
            hideModal('transactionHistoryModal');
        });
    }

    // --- Main Actions ---

    // Add Customer Button (FAB)
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
                alert(translate('fillRequiredFields'));
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
    
    // Add Debt Button (From Dropdown)
    const addDebtBtn = document.getElementById('addDebtBtn');
    if (addDebtBtn) {
        addDebtBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert(translate('selectCustomerFirst'));
                return;
            }
            showModal('addDebtModal');
            if (customerMenuDropdown) customerMenuDropdown.classList.remove('show');
        });
    }
    
    // Add Debt Form
    const addDebtForm = document.getElementById('addDebtForm');
    if (addDebtForm) {
        addDebtForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentCustomerId) {
                alert(translate('noCustomerSelected'));
                return;
            }
            
            const amount = parseFloat(document.getElementById('debtAmount').value);
            const note = document.getElementById('debtNote').value.trim();
            
            if (isNaN(amount) || amount <= 0) {
                alert(translate('enterValidAmount'));
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
                
                // Reset Options UI
                const invoiceOptions = document.getElementById('invoice-options');
                const btnShowInvoiceOptions = document.getElementById('btn-show-invoice-options');
                if (invoiceOptions) invoiceOptions.style.display = 'none';
                if (btnShowInvoiceOptions) btnShowInvoiceOptions.textContent = translate('addInvoiceImage');
                
            } catch (error) {
                // Error already handled in addDebt function
            }
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
    
    // Add Payment Button (From Dropdown)
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert(translate('selectCustomerFirst'));
                return;
            }
            showModal('addPaymentModal');
            if (customerMenuDropdown) customerMenuDropdown.classList.remove('show');
        });
    }
    
    // Connect Drive Button
    const connectDriveBtn = document.getElementById('connectDriveBtn');
    if (connectDriveBtn) {
        connectDriveBtn.addEventListener('click', handleConnectClick);
    }

    // Invoice Options Toggle
    const btnShowInvoiceOptions = document.getElementById('btn-show-invoice-options');
    const invoiceOptions = document.getElementById('invoice-options');
    
    if (btnShowInvoiceOptions && invoiceOptions) {
        btnShowInvoiceOptions.addEventListener('click', () => {
            // Toggle visibility
            if (invoiceOptions.style.display === 'none') {
                invoiceOptions.style.display = 'flex';
                btnShowInvoiceOptions.textContent = translate('hideOptions');
            } else {
                invoiceOptions.style.display = 'none';
                btnShowInvoiceOptions.textContent = translate('addInvoiceImage');
            }
        });
    }

    // Upload from Device/Camera Button
    const btnUploadDevice = document.getElementById('btn-upload-device');
    const fileInput = document.getElementById('fileInput');
    
    if (btnUploadDevice && fileInput) {
        btnUploadDevice.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                await uploadFileToDrive(e.target.files[0]);
                // Hide options after selection
                if (invoiceOptions) {
                    invoiceOptions.style.display = 'none';
                    if (btnShowInvoiceOptions) btnShowInvoiceOptions.textContent = translate('changeInvoiceImage');
                }
            }
        });
    }

    // Pick from Drive Button
    const btnPickDrive = document.getElementById('btn-pick-drive');
    if (btnPickDrive) {
        btnPickDrive.addEventListener('click', (e) => {
            e.preventDefault();
            handleAuthClick();
        });
    }

    // Add Payment Form
    const addPaymentForm = document.getElementById('addPaymentForm');
    if (addPaymentForm) {
        addPaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentCustomerId) {
                alert(translate('noCustomerSelected'));
                return;
            }
            
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            const note = document.getElementById('paymentNote').value.trim();
            
            if (isNaN(amount) || amount <= 0) {
                alert(translate('enterValidAmount'));
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

    // Edit Customer Button (From Dropdown)
    const editCustomerBtn = document.getElementById('editCustomerBtn');
    if (editCustomerBtn) {
        editCustomerBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert(translate('selectCustomerFirst'));
                return;
            }
            
            const customer = allCustomers.find(c => c.id === currentCustomerId);
            if (!customer) return;
            
            // Populate form
            document.getElementById('editCustomerName').value = customer.name || '';
            document.getElementById('editCustomerPhone').value = customer.phone || '';
            document.getElementById('editCustomerNotes').value = customer.note || '';
            
            showModal('editCustomerModal');
            if (customerMenuDropdown) customerMenuDropdown.classList.remove('show');
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
                alert(translate('fillRequiredFields'));
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
    
    // Delete Customer Button (From Dropdown)
    const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');
    if (deleteCustomerBtn) {
        deleteCustomerBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert(translate('selectCustomerFirst'));
                return;
            }
            deleteCustomer(currentCustomerId);
            if (customerMenuDropdown) customerMenuDropdown.classList.remove('show');
            hideModal('customerDetailsModal'); // Close details modal after delete
        });
    }
    
    // Close Balance Button (From Dropdown)
    const closeBalanceBtn = document.getElementById('closeBalanceBtn');
    if (closeBalanceBtn) {
        closeBalanceBtn.addEventListener('click', () => {
            if (!currentCustomerId) {
                alert(translate('selectCustomerFirst'));
                return;
            }
            closeBalance(currentCustomerId);
            if (customerMenuDropdown) customerMenuDropdown.classList.remove('show');
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

    // Logout Button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem("role");
            window.location.href = "login.html";
        });
    }

    // Language Switcher
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        langSelect.value = getLang();
        langSelect.addEventListener('change', (e) => {
            setLang(e.target.value);
        });
    }
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
            showToast(translate('backendWarning'), 'error');
        } else {
            console.log('Backend is online');
        }
    } catch (e) {
        console.error('Backend unreachable:', e);
        showToast(translate('backendError'), 'error');
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
