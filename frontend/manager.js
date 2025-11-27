import { getLang, setLang, applyTranslations, translate } from "./lang.js";

// Protection Check
const role = localStorage.getItem("role");
if (role !== "manager") {
    window.location.href = "login.html";
}

const BASE_URL = "https://dept-system.onrender.com";
let allCustomers = [];

// DOM Elements
const customerListEl = document.getElementById('customerList');
const searchInput = document.getElementById('searchInput');
const logoutBtn = document.getElementById('logoutBtn');
const historyModal = document.getElementById('historyModal');
const closeModalBtn = document.getElementById('closeModal');
const historyListEl = document.getElementById('historyList');
const modalCustomerName = document.getElementById('modalCustomerName');
const langSelect = document.getElementById("langSelect");

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Init Language
    langSelect.value = getLang();
    applyTranslations();

    langSelect.addEventListener("change", (e) => {
        setLang(e.target.value);
        // Re-render to apply translations to dynamic content
        renderCustomers(allCustomers);
    });

    loadCustomers();
    
    // Event Listeners
    searchInput.addEventListener('input', (e) => filterCustomers(e.target.value));
    logoutBtn.addEventListener('click', logout);
    closeModalBtn.addEventListener('click', () => historyModal.classList.remove('modal--show'));
    
    // Close modal on outside click
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) historyModal.classList.remove('modal--show');
    });
});

async function loadCustomers() {
    try {
        const response = await fetch(`${BASE_URL}/api/getCustomers`);
        if (!response.ok) throw new Error('Failed to fetch');
        
        allCustomers = await response.json();
        renderCustomers(allCustomers);
    } catch (error) {
        customerListEl.innerHTML = `<div class="error">${translate('errorFetch')}</div>`;
        console.error(error);
    }
}

function renderCustomers(customers) {
    if (customers.length === 0) {
        customerListEl.innerHTML = `<div class="empty-state">${translate('noCustomersFound')}</div>`;
        return;
    }

    customerListEl.innerHTML = customers.map(c => {
        const balance = c.balance || 0;
        const balanceClass = balance > 0 ? 'text-danger' : 'text-success';
        
        return `
            <div class="customer-list-item">
                <div class="customer-details">
                    <h3>${escapeHtml(c.name)}</h3>
                    <p>${escapeHtml(c.phone || translate('noPhone'))}</p>
                </div>
                <div style="display: flex; align-items: center;">
                    <div class="customer-balance">
                        <span class="balance-amount ${balanceClass}">$${balance.toFixed(2)}</span>
                        <small style="color: #9ca3af;">${translate('totalBalance')}</small>
                    </div>
                    <button class="view-btn" onclick="window.viewHistory('${c.id}')">${translate('viewHistory')}</button>
                </div>
            </div>
        `;
    }).join('');
}

function filterCustomers(query) {
    const lower = query.toLowerCase();
    const filtered = allCustomers.filter(c => 
        (c.name && c.name.toLowerCase().includes(lower)) || 
        (c.phone && c.phone.includes(lower))
    );
    renderCustomers(filtered);
}

window.viewHistory = async function(customerId) {
    // Show loading in modal
    historyListEl.innerHTML = `<div class="loading">${translate('loading')}</div>`;
    historyModal.classList.add('modal--show');
    
    try {
        const response = await fetch(`${BASE_URL}/api/getCustomer?id=${customerId}`);
        if (!response.ok) throw new Error('Failed to fetch details');
        
        const customer = await response.json();
        modalCustomerName.textContent = customer.name;
        renderHistory(customer.transactions || []);
    } catch (error) {
        historyListEl.innerHTML = `<div class="error">${translate('errorFetch')}</div>`;
    }
};

function renderHistory(transactions) {
    if (!transactions || transactions.length === 0) {
        historyListEl.innerHTML = `<div class="empty-state">${translate('noTransactions')}</div>`;
        return;
    }

    // Sort newest first
    const sorted = [...transactions].sort((a, b) => 
        new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
    );

    historyListEl.innerHTML = sorted.map(t => {
        const isDebt = ['debt', 'debit', 'DEBT'].includes(t.type) || (t.amount < 0 && t.type !== 'payment');
        const amount = Math.abs(t.amount || 0);
        const date = new Date(t.date || t.createdAt).toLocaleDateString(getLang());
        const typeLabel = isDebt ? translate('debt') : translate('payment');
        
        return `
            <div class="history-item">
                <div>
                    <div class="history-type ${isDebt ? 'type-debt' : 'type-payment'}">
                        ${typeLabel}
                    </div>
                    <div class="history-date">${date}</div>
                    ${t.note ? `<div style="font-size: 0.85rem; color: #666; margin-top: 4px;">${escapeHtml(t.note)}</div>` : ''}
                    ${t.invoiceImageUrl ? `
                        <a href="${t.invoiceImageUrl}" target="_blank" style="display: inline-block; margin-top: 4px; font-size: 0.8rem; color: #2563eb; text-decoration: none;">
                            ${translate('viewInvoice')} ↗
                        </a>
                    ` : ''}
                </div>
                <div class="history-amount ${isDebt ? 'type-debt' : 'type-payment'}">
                    ${isDebt ? '+' : '-'}$${amount.toFixed(2)}
                </div>
            </div>
        `;
    }).join('');
}

function logout() {
    localStorage.removeItem("role");
    window.location.href = "login.html";
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
