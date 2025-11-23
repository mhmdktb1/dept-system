/* ====================================
   Chocair Fresh - Debt Manager
   Clean Modular JavaScript
   ==================================== */

// ====================================
// CONFIGURATION
// ====================================
const CONFIG = {
    BASE_URL: "https://chocair-fresh-debt-system-e2rsgk57e-mhmds-projects-fc809501.vercel.app",
    GOOGLE_CLIENT_ID: "780794685039-gbqdfps9jk1hjv88r3qc1dhp08flks52.apps.googleusercontent.com",
    GOOGLE_FOLDER_ID: "1eBdacCCyxqNb045b7tDHx6ei5DYBVbiI"
};

// Ensure BASE_URL doesn't have trailing slash
if (CONFIG.BASE_URL.endsWith('/')) {
    CONFIG.BASE_URL = CONFIG.BASE_URL.slice(0, -1);
}

// ====================================
// SAFE FETCH WRAPPER
// ====================================
async function safeFetch(url, options = {}) {
    try {
        // Log the request for debugging
        console.log('Fetching:', url, options);
        
        const response = await fetch(url, options);
        
        // Handle network errors
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // If JSON parsing fails, use status text
                errorMessage = response.statusText || errorMessage;
            }
            console.error('Fetch error:', response.status, errorMessage);
            throw new Error(errorMessage);
        }
        
        // Parse JSON response
        try {
            return await response.json();
        } catch (e) {
            throw new Error('Invalid JSON response from server');
        }
    } catch (error) {
        // Handle network errors (CORS, connection refused, etc.)
        console.error('Fetch exception:', error);
        
        if (error instanceof TypeError) {
            // More specific error messages
            if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
                const urlInfo = url.includes(CONFIG.BASE_URL) ? 'Backend URL' : 'URL';
                throw new Error(`Network error: Unable to connect to ${urlInfo}.\n\nLIKELY CAUSE: Vercel Deployment Protection is enabled.\n\nSOLUTION:\n1. Go to Vercel Dashboard → Your Project → Settings\n2. Navigate to "Deployment Protection"\n3. Disable protection for this deployment\n4. Or add your frontend domain to allowed origins\n\nURL: ${url}`);
            }
        }
        // Re-throw other errors
        throw error;
    }
}

// ====================================
// STATE MANAGEMENT
// ====================================
const state = {
    selectedCustomerId: null,
    cachedCustomers: [],
    filteredCustomers: [],
    currentSort: 'name_asc',
    showDebt: false,
    actualDebtValue: 0,
    currentCustomerData: null,
    googleAccessToken: null,
    pendingDeleteTransactionId: null
};

// ====================================
// UTILITY FUNCTIONS
// ====================================
const utils = {
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateString;
        }
    },

    formatCurrency(amount) {
        return `$${Math.abs(amount || 0).toFixed(2)}`;
    }
};

// ====================================
// TOAST NOTIFICATIONS
// ====================================
const toast = {
    show(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toastEl = document.createElement('div');
        toastEl.className = `toast toast--${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ'
        };
        
        toastEl.innerHTML = `
            <span class="toast__icon">${icons[type] || icons.success}</span>
            <span class="toast__message">${utils.escapeHtml(message)}</span>
            <button class="toast__close" aria-label="Close">&times;</button>
        `;
        
        const closeBtn = toastEl.querySelector('.toast__close');
        closeBtn.addEventListener('click', () => toastEl.remove());
        
        container.appendChild(toastEl);
        
        setTimeout(() => {
            toastEl.classList.add('toast--hiding');
            setTimeout(() => {
                if (toastEl.parentElement) {
                    toastEl.remove();
                }
            }, 300);
        }, 5000);
    }
};

// ====================================
// API FUNCTIONS
// ====================================
const api = {
    async getCustomers() {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/getCustomers`);
        } catch (error) {
            console.error('Error fetching customers:', error);
            throw error;
        }
    },

    async getCustomer(id) {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/getCustomer?id=${encodeURIComponent(id)}`);
        } catch (error) {
            console.error('Error fetching customer:', error);
            throw error;
        }
    },

    async getSummary() {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/getSummary`);
        } catch (error) {
            console.error('Error fetching summary:', error);
            throw error;
        }
    },

    async addCustomer(data) {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/addCustomer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error('Error adding customer:', error);
            throw error;
        }
    },

    async updateCustomer(customerId, data) {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/updateCustomer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, ...data })
            });
        } catch (error) {
            console.error('Error updating customer:', error);
            throw error;
        }
    },

    async deleteCustomer(customerId) {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/deleteCustomer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId })
            });
        } catch (error) {
            console.error('Error deleting customer:', error);
            throw error;
        }
    },

    async addDebt(data) {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/addDebt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error('Error adding debt:', error);
            throw error;
        }
    },

    async addPayment(data) {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/addPayment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error('Error adding payment:', error);
            throw error;
        }
    },

    async deleteTransaction(transactionId) {
        try {
            return await safeFetch(`${CONFIG.BASE_URL}/api/deleteTransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactionId })
            });
        } catch (error) {
            console.error('Error deleting transaction:', error);
            throw error;
        }
    }
};

// ====================================
// GOOGLE DRIVE INTEGRATION
// ====================================
const googleDrive = {
    initAuth() {
        if (typeof google === 'undefined' || !google.accounts) {
            toast.show('Google API not loaded. Please wait...', 'error');
            return;
        }

        google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            scope: "https://www.googleapis.com/auth/drive.file",
            callback: (tokenResponse) => {
                state.googleAccessToken = tokenResponse.access_token;
                toast.show('Google Drive connected successfully!', 'success');
            },
        }).requestAccessToken();
    },

    async uploadFile(file) {
        if (!state.googleAccessToken) {
            toast.show('Please connect Google Drive first', 'error');
            return null;
        }

        const metadata = {
            name: `${Date.now()}_${file.name}`,
            parents: [CONFIG.GOOGLE_FOLDER_ID],
        };

        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        form.append("file", file);

        try {
            const response = await fetch(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${state.googleAccessToken}`,
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
        } catch (error) {
            console.error('Error uploading file:', error);
            return null;
        }
    }
};

// ====================================
// UI RENDERING
// ====================================
const ui = {
    updateDebtDisplay() {
        const element = document.getElementById('totalDebtAmount');
        if (element) {
            element.textContent = state.showDebt 
                ? utils.formatCurrency(state.actualDebtValue)
                : '******';
        }
    },

    updateEyeIcon() {
        const icon = document.getElementById('eyeIcon');
        if (!icon) return;

        if (state.showDebt) {
            icon.innerHTML = `
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="#1D9A42"/>
            `;
        } else {
            icon.innerHTML = `
                <path d="M12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12C17 9.24 14.76 7 12 7ZM12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12C15.5 13.93 13.93 15.5 12 15.5ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" fill="#666"/>
                <path d="M2 2L22 22M6.5 6.5C4.01 8.99 2.5 10.5 2.5 12C2.5 15.5 6.5 19.5 12 19.5C14.5 19.5 16.5 18.5 18 17.5M17.5 17.5C19.99 15.01 21.5 13.5 21.5 12C21.5 8.5 17.5 4.5 12 4.5C9.5 4.5 7.5 5.5 6 6.5" stroke="#666" stroke-width="2" stroke-linecap="round"/>
            `;
        }
    },

    createCustomerCard(customer) {
        const card = document.createElement('div');
        card.className = 'customer-card';
        if (state.selectedCustomerId === customer.id) {
            card.classList.add('customer-card--active');
        }
        card.setAttribute('data-customer-id', customer.id);

        const balance = customer.balance !== undefined ? customer.balance : ((customer.totalDebt || 0) - (customer.totalPaid || 0));
        const balanceClass = balance === 0 ? 'customer-card__balance--zero' : 'customer-card__balance--positive';

        card.innerHTML = `
            <div class="customer-card__content">
                <h2 class="customer-card__name">${utils.escapeHtml(customer.name)}</h2>
                <div class="customer-card__info">
                    <span class="customer-card__item">Phone: ${utils.escapeHtml(customer.phone || 'N/A')}</span>
                    <span class="customer-card__item">Receipts: ${customer.receipts || 0}</span>
                    <span class="customer-card__item customer-card__balance ${balanceClass}">
                        Balance: ${utils.formatCurrency(balance)}
                    </span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            customerActions.selectCustomer(customer.id);
        });

        return card;
    },

    renderCustomers(customers) {
        const container = document.getElementById('customerList');
        const emptyState = document.getElementById('emptyState');
        
        if (!container) return;

        container.innerHTML = '';

        if (!customers || customers.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        customers.forEach(customer => {
            const card = this.createCustomerCard(customer);
            container.appendChild(card);
        });
    },

    renderCustomerInfo(customer) {
        const container = document.getElementById('customerInfo');
        if (!container) return;

        const balance = customer.balance !== undefined ? customer.balance : ((customer.totalDebt || 0) - (customer.totalPaid || 0));
        const balanceClass = balance > 0 ? 'customer-info__value--positive' : 
                           balance < 0 ? 'customer-info__value--negative' : 
                           'customer-info__value--zero';

        container.innerHTML = `
            <div class="customer-info__card">
                <h2 class="customer-info__name">${utils.escapeHtml(customer.name || 'Unknown')}</h2>
                <div class="customer-info__grid">
                    <div class="customer-info__item">
                        <span class="customer-info__label">Phone:</span>
                        <span class="customer-info__value">${utils.escapeHtml(customer.phone || 'N/A')}</span>
                    </div>
                    <div class="customer-info__item">
                        <span class="customer-info__label">Note:</span>
                        <span class="customer-info__value">${utils.escapeHtml(customer.note || 'No notes')}</span>
                    </div>
                    <div class="customer-info__item">
                        <span class="customer-info__label">Total Debt:</span>
                        <span class="customer-info__value">${utils.formatCurrency(customer.totalDebt || 0)}</span>
                    </div>
                    <div class="customer-info__item">
                        <span class="customer-info__label">Total Paid:</span>
                        <span class="customer-info__value">${utils.formatCurrency(customer.totalPaid || 0)}</span>
                    </div>
                    <div class="customer-info__item customer-info__item--balance">
                        <span class="customer-info__label">Balance:</span>
                        <span class="customer-info__value ${balanceClass}">${utils.formatCurrency(balance)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderTransactions(transactions) {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        container.innerHTML = '';

        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<p class="empty-message">No transactions found.</p>';
            return;
        }

        transactions.forEach(transaction => {
            const item = this.createTransactionItem(transaction);
            container.appendChild(item);
        });
    },

    createTransactionItem(transaction) {
        const item = document.createElement('div');
        item.className = 'transaction-item';

        const isDebt = transaction.type === 'DEBT' || transaction.type === 'debit';
        const typeClass = isDebt ? 'transaction-item__type--debt' : 'transaction-item__type--payment';
        const amountClass = isDebt ? 'transaction-item__amount--debt' : 'transaction-item__amount--payment';
        const typeLabel = isDebt ? 'DEBT' : 'PAYMENT';
        const amountSign = isDebt ? '+' : '-';

        const invoiceImageUrl = transaction.invoiceImageUrl || transaction.invoiceUrl;
        const invoiceHtml = invoiceImageUrl 
            ? `<img src="${utils.escapeHtml(invoiceImageUrl)}" alt="Invoice" class="transaction-item__image" onclick="window.open('${utils.escapeHtml(invoiceImageUrl)}', '_blank')" />`
            : '';

        const noteHtml = transaction.note && transaction.note.trim() 
            ? `<div class="transaction-item__note">${utils.escapeHtml(transaction.note)}</div>`
            : '';

        item.innerHTML = `
            <div class="transaction-item__content">
                <div class="transaction-item__header">
                    <div>
                        <span class="transaction-item__date">${utils.formatDate(transaction.date)}</span>
                        <span class="transaction-item__type ${typeClass}">${typeLabel}</span>
                    </div>
                    <div class="transaction-item__amount ${amountClass}">
                        ${amountSign}${utils.formatCurrency(transaction.amount)}
                    </div>
                </div>
                ${noteHtml}
                ${invoiceHtml}
                <button class="transaction-item__delete" data-transaction-id="${transaction.id}">Delete</button>
            </div>
        `;

        const deleteBtn = item.querySelector('.transaction-item__delete');
        deleteBtn.addEventListener('click', () => {
            modalActions.openDeleteTransactionModal(transaction.id);
        });

        return item;
    }
};

// ====================================
// SORTING & FILTERING
// ====================================
const sorting = {
    applySort(customers) {
        if (!customers || customers.length === 0) return customers;

        const sorted = [...customers];

        switch (state.currentSort) {
            case 'name_asc':
                return sorted.sort((a, b) => {
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
            case 'name_desc':
                return sorted.sort((a, b) => {
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    return nameB.localeCompare(nameA);
                });
            case 'balance_desc':
                return sorted.sort((a, b) => {
                    const balanceA = a.balance !== undefined ? a.balance : ((a.totalDebt || 0) - (a.totalPaid || 0));
                    const balanceB = b.balance !== undefined ? b.balance : ((b.totalDebt || 0) - (b.totalPaid || 0));
                    return balanceB - balanceA;
                });
            case 'balance_asc':
                return sorted.sort((a, b) => {
                    const balanceA = a.balance !== undefined ? a.balance : ((a.totalDebt || 0) - (a.totalPaid || 0));
                    const balanceB = b.balance !== undefined ? b.balance : ((b.totalDebt || 0) - (b.totalPaid || 0));
                    return balanceA - balanceB;
                });
            default:
                return sorted;
        }
    },

    filterCustomers(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (term === '') {
            state.filteredCustomers = this.applySort(state.cachedCustomers);
            ui.renderCustomers(state.filteredCustomers);
            return;
        }

        const filtered = state.cachedCustomers.filter(customer => {
            const name = (customer.name || '').toLowerCase();
            const phone = (customer.phone || '').toLowerCase();
            return name.includes(term) || phone.includes(term);
        });

        state.filteredCustomers = this.applySort(filtered);
        ui.renderCustomers(state.filteredCustomers);
    }
};

// ====================================
// CUSTOMER ACTIONS
// ====================================
const customerActions = {
    async loadCustomers() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const customerList = document.getElementById('customerList');
        const emptyState = document.getElementById('emptyState');

        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (customerList) customerList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';

        try {
            const customers = await api.getCustomers();
            state.cachedCustomers = customers;
            state.filteredCustomers = sorting.applySort(customers);
            ui.renderCustomers(state.filteredCustomers);
        } catch (error) {
            toast.show('Error loading customers: ' + error.message, 'error');
            if (customerList) {
                customerList.innerHTML = '<p class="error">Error loading customers. Please try again.</p>';
            }
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    },

    async selectCustomer(customerId) {
        state.selectedCustomerId = customerId;

        document.querySelectorAll('.customer-card').forEach(card => {
            if (card.getAttribute('data-customer-id') === customerId) {
                card.classList.add('customer-card--active');
            } else {
                card.classList.remove('customer-card--active');
            }
        });

        const detailsPanel = document.getElementById('detailsPanel');
        const placeholder = document.getElementById('noSelectionPlaceholder');

        if (detailsPanel) detailsPanel.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';

        await this.loadCustomerDetails(customerId);
    },

    async loadCustomerDetails(customerId) {
        const customerInfo = document.getElementById('customerInfo');
        const transactionsList = document.getElementById('transactionsList');

        if (customerInfo) {
            customerInfo.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><span>Loading customer details...</span></div>';
        }
        if (transactionsList) transactionsList.innerHTML = '';

        try {
            const customer = await api.getCustomer(customerId);
            state.currentCustomerData = customer;

            ui.renderCustomerInfo(customer);
            ui.renderTransactions(customer.transactions || []);
        } catch (error) {
            toast.show('Error loading customer details: ' + error.message, 'error');
            if (customerInfo) {
                customerInfo.innerHTML = '<p class="error">Error loading customer details. Please try again.</p>';
            }
        }
    },

    async addCustomer(formData) {
        const name = formData.get('name')?.trim();
        const phone = formData.get('phone')?.trim();
        const notes = formData.get('notes')?.trim();

        if (!name) {
            toast.show('Customer name is required', 'error');
            return;
        }

        try {
            await api.addCustomer({ name, phone: phone || '', note: notes || '' });
            modalActions.closeAddCustomerModal();
            await this.loadCustomers();
            toast.show('Customer added successfully', 'success');
        } catch (error) {
            toast.show('Error adding customer: ' + error.message, 'error');
        }
    },

    async updateCustomer(formData) {
        if (!state.selectedCustomerId) {
            toast.show('Please select a customer first', 'info');
            return;
        }

        const name = formData.get('name')?.trim();
        const phone = formData.get('phone')?.trim();
        const notes = formData.get('notes')?.trim();

        if (!name) {
            toast.show('Customer name is required', 'error');
            return;
        }

        try {
            await api.updateCustomer(state.selectedCustomerId, {
                name,
                phone: phone || '',
                note: notes || ''
            });
            modalActions.closeEditCustomerModal();
            await this.loadCustomerDetails(state.selectedCustomerId);
            await this.loadCustomers();
            toast.show('Customer updated successfully', 'success');
        } catch (error) {
            toast.show('Error updating customer: ' + error.message, 'error');
        }
    },

    async deleteCustomer() {
        if (!state.selectedCustomerId) {
            toast.show('Please select a customer first', 'info');
            return;
        }

        if (!confirm('Are you sure you want to delete this customer? This will also delete all their transactions. This action cannot be undone.')) {
            return;
        }

        try {
            await api.deleteCustomer(state.selectedCustomerId);
            state.selectedCustomerId = null;
            state.currentCustomerData = null;

            const detailsPanel = document.getElementById('detailsPanel');
            const placeholder = document.getElementById('noSelectionPlaceholder');

            if (detailsPanel) detailsPanel.style.display = 'none';
            if (placeholder) placeholder.style.display = 'block';

            await this.loadCustomers();
            await summaryActions.loadSummary();
            toast.show('Customer deleted successfully', 'success');
        } catch (error) {
            toast.show('Error deleting customer: ' + error.message, 'error');
        }
    },

    async closeBalance() {
        if (!state.selectedCustomerId || !state.currentCustomerData) {
            toast.show('Please select a customer first', 'info');
            return;
        }

        const balance = state.currentCustomerData.balance !== undefined 
            ? state.currentCustomerData.balance 
            : ((state.currentCustomerData.totalDebt || 0) - (state.currentCustomerData.totalPaid || 0));

        if (balance <= 0) {
            toast.show('No outstanding balance to close', 'info');
            return;
        }

        if (!confirm("Close this customer's balance?")) {
            return;
        }

        try {
            await api.addPayment({
                customerId: state.selectedCustomerId,
                amount: balance,
                note: 'Auto Close Balance'
            });

            await this.loadCustomerDetails(state.selectedCustomerId);
            await this.loadCustomers();
            await summaryActions.loadSummary();
            toast.show('Balance closed successfully', 'success');
        } catch (error) {
            toast.show('Error closing balance: ' + error.message, 'error');
        }
    }
};

// ====================================
// TRANSACTION ACTIONS
// ====================================
const transactionActions = {
    async addDebt(formData) {
        if (!state.selectedCustomerId) {
            toast.show('Please select a customer first', 'info');
            return;
        }

        const amount = parseFloat(formData.get('amount'));
        const note = formData.get('note')?.trim() || '';
        const fileInput = document.getElementById('debtImage');

        if (!amount || amount <= 0) {
            toast.show('Amount must be greater than 0', 'error');
            return;
        }

        let invoiceImageUrl = null;

        if (fileInput && fileInput.files.length > 0) {
            invoiceImageUrl = await googleDrive.uploadFile(fileInput.files[0]);
            if (!invoiceImageUrl) {
                toast.show('Image upload failed, but continuing without image...', 'info');
            }
        }

        try {
            await api.addDebt({
                customerId: state.selectedCustomerId,
                amount,
                note,
                invoiceImageUrl
            });

            modalActions.closeAddDebtModal();
            await customerActions.loadCustomerDetails(state.selectedCustomerId);
            await customerActions.loadCustomers();
            await summaryActions.loadSummary();
            toast.show('Debt added successfully', 'success');
        } catch (error) {
            toast.show('Error adding debt: ' + error.message, 'error');
        }
    },

    async addPayment(formData) {
        if (!state.selectedCustomerId) {
            toast.show('Please select a customer first', 'info');
            return;
        }

        const amount = parseFloat(formData.get('amount'));
        const note = formData.get('note')?.trim() || '';

        if (!amount || amount <= 0) {
            toast.show('Amount must be greater than 0', 'error');
            return;
        }

        try {
            await api.addPayment({
                customerId: state.selectedCustomerId,
                amount,
                note
            });

            modalActions.closeAddPaymentModal();
            await customerActions.loadCustomerDetails(state.selectedCustomerId);
            await customerActions.loadCustomers();
            await summaryActions.loadSummary();
            toast.show('Payment added successfully', 'success');
        } catch (error) {
            toast.show('Error adding payment: ' + error.message, 'error');
        }
    },

    async deleteTransaction(transactionId) {
        try {
            await api.deleteTransaction(transactionId);
            modalActions.closeDeleteTransactionModal();
            await customerActions.loadCustomerDetails(state.selectedCustomerId);
            await customerActions.loadCustomers();
            await summaryActions.loadSummary();
            toast.show('Transaction deleted successfully', 'success');
        } catch (error) {
            toast.show('Error deleting transaction: ' + error.message, 'error');
        }
    }
};

// ====================================
// SUMMARY ACTIONS
// ====================================
const summaryActions = {
    async loadSummary() {
        const element = document.getElementById('totalDebtAmount');
        if (!element) return;

        element.textContent = 'Loading...';

        try {
            const summary = await api.getSummary();
            state.actualDebtValue = summary.totalOutstandingDebt || 0;
            ui.updateDebtDisplay();
        } catch (error) {
            element.textContent = 'Error';
            toast.show('Error loading summary: ' + error.message, 'error');
        }
    },

    toggleDebtVisibility() {
        state.showDebt = !state.showDebt;
        ui.updateDebtDisplay();
        ui.updateEyeIcon();
    }
};

// ====================================
// MODAL ACTIONS
// ====================================
const modalActions = {
    openAddCustomerModal() {
        const modal = document.getElementById('addCustomerModal');
        if (modal) {
            modal.classList.add('modal--show');
            const nameInput = document.getElementById('customerName');
            if (nameInput) setTimeout(() => nameInput.focus(), 100);
        }
    },

    closeAddCustomerModal() {
        const modal = document.getElementById('addCustomerModal');
        const form = document.getElementById('addCustomerForm');
        if (modal) modal.classList.remove('modal--show');
        if (form) form.reset();
    },

    openEditCustomerModal() {
        if (!state.selectedCustomerId || !state.currentCustomerData) {
            toast.show('Please select a customer first', 'info');
            return;
        }

        const modal = document.getElementById('editCustomerModal');
        const nameInput = document.getElementById('editCustomerName');
        const phoneInput = document.getElementById('editCustomerPhone');
        const notesInput = document.getElementById('editCustomerNotes');

        if (modal) {
            if (nameInput) nameInput.value = state.currentCustomerData.name || '';
            if (phoneInput) phoneInput.value = state.currentCustomerData.phone || '';
            if (notesInput) notesInput.value = state.currentCustomerData.note || '';
            modal.classList.add('modal--show');
            if (nameInput) setTimeout(() => nameInput.focus(), 100);
        }
    },

    closeEditCustomerModal() {
        const modal = document.getElementById('editCustomerModal');
        const form = document.getElementById('editCustomerForm');
        if (modal) modal.classList.remove('modal--show');
        if (form) form.reset();
    },

    openAddDebtModal() {
        if (!state.selectedCustomerId) {
            toast.show('Please select a customer first', 'info');
            return;
        }

        const modal = document.getElementById('addDebtModal');
        if (modal) {
            modal.classList.add('modal--show');
            const amountInput = document.getElementById('debtAmount');
            if (amountInput) setTimeout(() => amountInput.focus(), 100);
        }
    },

    closeAddDebtModal() {
        const modal = document.getElementById('addDebtModal');
        const form = document.getElementById('addDebtForm');
        if (modal) modal.classList.remove('modal--show');
        if (form) form.reset();
    },

    openAddPaymentModal() {
        if (!state.selectedCustomerId) {
            toast.show('Please select a customer first', 'info');
            return;
        }

        const modal = document.getElementById('addPaymentModal');
        if (modal) {
            modal.classList.add('modal--show');
            const amountInput = document.getElementById('paymentAmount');
            if (amountInput) setTimeout(() => amountInput.focus(), 100);
        }
    },

    closeAddPaymentModal() {
        const modal = document.getElementById('addPaymentModal');
        const form = document.getElementById('addPaymentForm');
        if (modal) modal.classList.remove('modal--show');
        if (form) form.reset();
    },

    openDeleteTransactionModal(transactionId) {
        state.pendingDeleteTransactionId = transactionId;
        const modal = document.getElementById('deleteTransactionModal');
        if (modal) modal.classList.add('modal--show');
    },

    closeDeleteTransactionModal() {
        state.pendingDeleteTransactionId = null;
        const modal = document.getElementById('deleteTransactionModal');
        if (modal) modal.classList.remove('modal--show');
    }
};

// ====================================
// EVENT LISTENERS SETUP
// ====================================
const eventListeners = {
    setup() {
        // Eye toggle
        const eyeToggleBtn = document.getElementById('eyeToggleBtn');
        if (eyeToggleBtn) {
            eyeToggleBtn.addEventListener('click', () => summaryActions.toggleDebtVisibility());
        }

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                sorting.filterCustomers(e.target.value);
            });
        }

        // Sort
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.currentSort = e.target.value;
                sorting.filterCustomers(searchInput ? searchInput.value : '');
            });
        }

        // Google Drive button
        const googleDriveBtn = document.getElementById('googleDriveBtn');
        if (googleDriveBtn) {
            googleDriveBtn.addEventListener('click', () => googleDrive.initAuth());
        }

        // Header buttons
        const addCustomerBtn = document.getElementById('addCustomerBtn');
        if (addCustomerBtn) {
            addCustomerBtn.addEventListener('click', () => modalActions.openAddCustomerModal());
        }

        // Action buttons
        const addDebtBtn = document.getElementById('addDebtBtn');
        if (addDebtBtn) {
            addDebtBtn.addEventListener('click', () => modalActions.openAddDebtModal());
        }

        const addPaymentBtn = document.getElementById('addPaymentBtn');
        if (addPaymentBtn) {
            addPaymentBtn.addEventListener('click', () => modalActions.openAddPaymentModal());
        }

        const closeBalanceBtn = document.getElementById('closeBalanceBtn');
        if (closeBalanceBtn) {
            closeBalanceBtn.addEventListener('click', () => customerActions.closeBalance());
        }

        const editCustomerBtn = document.getElementById('editCustomerBtn');
        if (editCustomerBtn) {
            editCustomerBtn.addEventListener('click', () => modalActions.openEditCustomerModal());
        }

        const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');
        if (deleteCustomerBtn) {
            deleteCustomerBtn.addEventListener('click', () => customerActions.deleteCustomer());
        }

        // Modal close buttons
        const closeCustomerModal = document.getElementById('closeCustomerModal');
        if (closeCustomerModal) {
            closeCustomerModal.addEventListener('click', () => modalActions.closeAddCustomerModal());
        }

        const cancelCustomerBtn = document.getElementById('cancelCustomerBtn');
        if (cancelCustomerBtn) {
            cancelCustomerBtn.addEventListener('click', () => modalActions.closeAddCustomerModal());
        }

        const closeEditCustomerModal = document.getElementById('closeEditCustomerModal');
        if (closeEditCustomerModal) {
            closeEditCustomerModal.addEventListener('click', () => modalActions.closeEditCustomerModal());
        }

        const cancelEditCustomerBtn = document.getElementById('cancelEditCustomerBtn');
        if (cancelEditCustomerBtn) {
            cancelEditCustomerBtn.addEventListener('click', () => modalActions.closeEditCustomerModal());
        }

        const closeDebtModal = document.getElementById('closeDebtModal');
        if (closeDebtModal) {
            closeDebtModal.addEventListener('click', () => modalActions.closeAddDebtModal());
        }

        const cancelDebtBtn = document.getElementById('cancelDebtBtn');
        if (cancelDebtBtn) {
            cancelDebtBtn.addEventListener('click', () => modalActions.closeAddDebtModal());
        }

        const closePaymentModal = document.getElementById('closePaymentModal');
        if (closePaymentModal) {
            closePaymentModal.addEventListener('click', () => modalActions.closeAddPaymentModal());
        }

        const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
        if (cancelPaymentBtn) {
            cancelPaymentBtn.addEventListener('click', () => modalActions.closeAddPaymentModal());
        }

        const closeDeleteTransactionModal = document.getElementById('closeDeleteTransactionModal');
        if (closeDeleteTransactionModal) {
            closeDeleteTransactionModal.addEventListener('click', () => modalActions.closeDeleteTransactionModal());
        }

        const cancelDeleteTransactionBtn = document.getElementById('cancelDeleteTransactionBtn');
        if (cancelDeleteTransactionBtn) {
            cancelDeleteTransactionBtn.addEventListener('click', () => modalActions.closeDeleteTransactionModal());
        }

        const confirmDeleteTransactionBtn = document.getElementById('confirmDeleteTransactionBtn');
        if (confirmDeleteTransactionBtn) {
            confirmDeleteTransactionBtn.addEventListener('click', () => {
                if (state.pendingDeleteTransactionId) {
                    transactionActions.deleteTransaction(state.pendingDeleteTransactionId);
                }
            });
        }

        // Modal backdrop clicks
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('modal--show');
                }
            });
        });

        // Form submissions
        const addCustomerForm = document.getElementById('addCustomerForm');
        if (addCustomerForm) {
            addCustomerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                customerActions.addCustomer(new FormData(e.target));
            });
        }

        const editCustomerForm = document.getElementById('editCustomerForm');
        if (editCustomerForm) {
            editCustomerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                customerActions.updateCustomer(new FormData(e.target));
            });
        }

        const addDebtForm = document.getElementById('addDebtForm');
        if (addDebtForm) {
            addDebtForm.addEventListener('submit', (e) => {
                e.preventDefault();
                transactionActions.addDebt(new FormData(e.target));
            });
        }

        const addPaymentForm = document.getElementById('addPaymentForm');
        if (addPaymentForm) {
            addPaymentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                transactionActions.addPayment(new FormData(e.target));
            });
        }
    }
};

// ====================================
// INITIALIZATION
// ====================================
document.addEventListener('DOMContentLoaded', async () => {
    // Check if running from file:// protocol (CORS will fail)
    if (window.location.protocol === 'file:') {
        toast.show('Error: This app must be served from a web server (not file://). Please use a local server like "python -m http.server" or deploy to a hosting service.', 'error');
        console.error('Running from file:// protocol - CORS will fail. Please use a web server.');
    }
    
    eventListeners.setup();
    ui.updateEyeIcon();
    
    // Test backend connection first
    try {
        console.log('Testing backend connection to:', CONFIG.BASE_URL);
        const testResponse = await fetch(`${CONFIG.BASE_URL}/api/getSummary`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('Backend connection test:', testResponse.status, testResponse.ok);
        
        // Check if we got an authentication page (HTML response)
        const contentType = testResponse.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            const text = await testResponse.text();
            if (text.includes('Authentication Required') || text.includes('Vercel Authentication')) {
                toast.show('ERROR: Vercel deployment protection is enabled. Please disable it in Vercel project settings → Deployment Protection → Disable for this deployment.', 'error');
                console.error('Vercel deployment protection is blocking API access. Disable it in Vercel settings.');
                return;
            }
        }
        
        if (!testResponse.ok) {
            toast.show(`Backend returned status ${testResponse.status}. Please check if the backend is properly deployed.`, 'error');
        }
    } catch (error) {
        console.error('Backend connection test failed:', error);
        const errorMsg = error.message || 'Unknown error';
        
        // Check if it's a CORS/network error
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network error')) {
            toast.show(`CRITICAL: Cannot connect to backend. Possible causes:\n1. Vercel deployment protection is enabled (MOST LIKELY)\n2. Backend not deployed\n3. Network/CORS issue\n\nPlease check Vercel project settings and disable Deployment Protection.`, 'error');
        } else {
            toast.show(`Warning: Unable to connect to backend (${errorMsg}). Please check backend deployment.`, 'error');
        }
    }
    
    await customerActions.loadCustomers();
    await summaryActions.loadSummary();
});

