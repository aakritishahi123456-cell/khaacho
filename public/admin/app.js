// Configuration
const API_BASE = window.location.origin + '/api/v1';
let token = localStorage.getItem('admin_token');
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    loadUserInfo();
    loadDashboard();
});

// API Helper
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    }
}

// User Info
async function loadUserInfo() {
    try {
        const response = await apiCall('/auth/profile');
        currentUser = response.data;
        document.getElementById('user-info').textContent = `${currentUser.name} (${currentUser.role})`;
    } catch (error) {
        logout();
    }
}

function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = 'login.html';
}

// Tab Management
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'retailers':
            loadRetailers();
            break;
        case 'vendors':
            loadVendors();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'credit-scores':
            loadCreditScores();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const response = await apiCall('/dashboard/admin?days=1');
        const data = response.data;
        
        // Update stats
        document.getElementById('orders-today').textContent = data.orderStats.totalOrders;
        document.getElementById('outstanding-credit').textContent = 
            'Rs.' + data.creditRisk.totalOutstanding.toLocaleString();
        document.getElementById('active-retailers').textContent = data.topRetailers.length;
        document.getElementById('active-vendors').textContent = data.topVendors.length;
        
        // Recent orders
        const ordersHtml = data.recentOrders.slice(0, 10).map(order => `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${order.retailer.user.businessName}</td>
                <td>${order.vendor?.user.businessName || '-'}</td>
                <td><span class="badge badge-${getStatusColor(order.status)}">${order.status}</span></td>
                <td>Rs.${parseFloat(order.total).toLocaleString()}</td>
                <td>${new Date(order.createdAt).toLocaleDateString()}</td>
            </tr>
        `).join('');
        document.getElementById('recent-orders').innerHTML = ordersHtml || '<tr><td colspan="6">No orders</td></tr>';
        
        // Load overdue accounts
        loadOverdueAccounts();
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

async function loadOverdueAccounts() {
    try {
        const response = await apiCall('/orders?paymentStatus=OVERDUE&limit=10');
        const orders = response.data;
        
        const overdueMap = {};
        orders.forEach(order => {
            const retailerId = order.retailerId;
            if (!overdueMap[retailerId]) {
                overdueMap[retailerId] = {
                    retailer: order.retailer,
                    totalDue: 0,
                    orderCount: 0
                };
            }
            overdueMap[retailerId].totalDue += parseFloat(order.dueAmount);
            overdueMap[retailerId].orderCount++;
        });
        
        const html = Object.values(overdueMap).map(item => `
            <tr>
                <td>${item.retailer.shopName}</td>
                <td>Rs.${item.totalDue.toLocaleString()}</td>
                <td>${item.retailer.creditScore}</td>
                <td>${item.retailer.lastPaymentAt ? new Date(item.retailer.lastPaymentAt).toLocaleDateString() : 'Never'}</td>
                <td>
                    <button onclick="contactRetailer('${item.retailer.id}')" class="btn-primary">Contact</button>
                </td>
            </tr>
        `).join('');
        
        document.getElementById('overdue-accounts').innerHTML = html || '<tr><td colspan="5">No overdue accounts</td></tr>';
    } catch (error) {
        console.error('Overdue accounts error:', error);
    }
}

// Retailers
async function loadRetailers() {
    try {
        const response = await apiCall('/retailers');
        const retailers = response.data;
        
        const html = retailers.map(retailer => `
            <tr>
                <td>${retailer.retailerCode}</td>
                <td>${retailer.shopName}</td>
                <td>${retailer.user.name}</td>
                <td>${retailer.user.phoneNumber}</td>
                <td>${retailer.creditScore}</td>
                <td>Rs.${parseFloat(retailer.creditLimit).toLocaleString()}</td>
                <td>Rs.${parseFloat(retailer.outstandingDebt).toLocaleString()}</td>
                <td><span class="badge badge-${retailer.isApproved ? 'success' : 'warning'}">
                    ${retailer.isApproved ? 'Approved' : 'Pending'}
                </span></td>
                <td>
                    ${!retailer.isApproved ? 
                        `<button onclick="showApproveRetailer('${retailer.id}')" class="btn-success">Approve</button>` :
                        `<button onclick="editCreditLimit('${retailer.id}', ${retailer.creditLimit})" class="btn-primary">Edit Limit</button>`
                    }
                </td>
            </tr>
        `).join('');
        
        document.getElementById('retailers-list').innerHTML = html || '<tr><td colspan="9">No retailers</td></tr>';
    } catch (error) {
        console.error('Retailers load error:', error);
    }
}

function showApproveRetailer(retailerId) {
    document.getElementById('approve-retailer-id').value = retailerId;
    document.getElementById('approve-credit-limit').value = 50000;
    showModal('approve-retailer');
}

async function approveRetailer(event) {
    event.preventDefault();
    const retailerId = document.getElementById('approve-retailer-id').value;
    const creditLimit = document.getElementById('approve-credit-limit').value;
    
    try {
        await apiCall(`/retailers/${retailerId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ creditLimit: parseFloat(creditLimit) })
        });
        
        showSuccess('Retailer approved successfully');
        closeModal();
        loadRetailers();
    } catch (error) {
        console.error('Approve error:', error);
    }
}

// Vendors
async function loadVendors() {
    try {
        const response = await apiCall('/vendors');
        const vendors = response.data;
        
        const html = vendors.map(vendor => `
            <tr>
                <td>${vendor.vendorCode}</td>
                <td>${vendor.user.businessName}</td>
                <td>${vendor.user.name}</td>
                <td>${vendor.user.phoneNumber}</td>
                <td>Rs.${parseFloat(vendor.totalSales).toLocaleString()}</td>
                <td>${vendor.vendorProducts?.length || 0}</td>
                <td><span class="badge badge-${vendor.isApproved ? 'success' : 'warning'}">
                    ${vendor.isApproved ? 'Approved' : 'Pending'}
                </span></td>
                <td>
                    ${!vendor.isApproved ? 
                        `<button onclick="approveVendor('${vendor.id}')" class="btn-success">Approve</button>` :
                        `<button onclick="viewVendor('${vendor.id}')" class="btn-primary">View</button>`
                    }
                </td>
            </tr>
        `).join('');
        
        document.getElementById('vendors-list').innerHTML = html || '<tr><td colspan="8">No vendors</td></tr>';
    } catch (error) {
        console.error('Vendors load error:', error);
    }
}

// Orders
async function loadOrders() {
    try {
        const response = await apiCall('/orders?limit=50');
        const orders = response.data;
        
        const html = orders.map(order => `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${order.retailer.user.businessName}</td>
                <td>${order.vendor?.user.businessName || '-'}</td>
                <td><span class="badge badge-${getStatusColor(order.status)}">${order.status}</span></td>
                <td>Rs.${parseFloat(order.total).toLocaleString()}</td>
                <td>Rs.${parseFloat(order.dueAmount).toLocaleString()}</td>
                <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                <td>
                    ${order.status === 'DRAFT' ? 
                        `<button onclick="editOrder('${order.id}')" class="btn-primary">Edit</button>
                         <button onclick="confirmOrder('${order.id}')" class="btn-success">Confirm</button>` :
                        order.status === 'CONFIRMED' ?
                        `<button onclick="showAssignVendor('${order.id}')" class="btn-primary">Assign Vendor</button>` :
                        `<button onclick="viewOrder('${order.id}')" class="btn-primary">View</button>`
                    }
                </td>
            </tr>
        `).join('');
        
        document.getElementById('orders-list').innerHTML = html || '<tr><td colspan="8">No orders</td></tr>';
    } catch (error) {
        console.error('Orders load error:', error);
    }
}

async function confirmOrder(orderId) {
    if (!confirm('Confirm this order?')) return;
    
    try {
        await apiCall(`/order-lifecycle/${orderId}/confirm`, { method: 'POST' });
        showSuccess('Order confirmed');
        loadOrders();
    } catch (error) {
        console.error('Confirm error:', error);
    }
}

function showAssignVendor(orderId) {
    document.getElementById('assign-order-id').value = orderId;
    loadVendorsForAssignment();
    showModal('assign-vendor');
}

async function loadVendorsForAssignment() {
    try {
        const response = await apiCall('/vendors?isApproved=true');
        const vendors = response.data;
        
        const select = document.getElementById('assign-vendor-select');
        select.innerHTML = vendors.map(v => 
            `<option value="${v.id}">${v.user.businessName}</option>`
        ).join('');
    } catch (error) {
        console.error('Load vendors error:', error);
    }
}

async function assignVendor(event) {
    event.preventDefault();
    const orderId = document.getElementById('assign-order-id').value;
    const vendorId = document.getElementById('assign-vendor-select').value;
    
    try {
        await apiCall(`/order-lifecycle/${orderId}/assign-vendor`, {
            method: 'POST',
            body: JSON.stringify({ vendorId })
        });
        
        showSuccess('Vendor assigned successfully');
        closeModal();
        loadOrders();
    } catch (error) {
        console.error('Assign vendor error:', error);
    }
}

// Payments
async function loadPayments() {
    try {
        const response = await apiCall('/payments?limit=50');
        const payments = response.data;
        
        const html = payments.map(payment => `
            <tr>
                <td>${payment.paymentNumber}</td>
                <td>${payment.retailer.shopName}</td>
                <td>${payment.order?.orderNumber || '-'}</td>
                <td>Rs.${parseFloat(payment.amount).toLocaleString()}</td>
                <td>${payment.paymentMethod}</td>
                <td>${new Date(payment.createdAt).toLocaleDateString()}</td>
                <td><span class="badge badge-${payment.paymentStatus === 'PAID' ? 'success' : 'warning'}">
                    ${payment.paymentStatus}
                </span></td>
            </tr>
        `).join('');
        
        document.getElementById('payments-list').innerHTML = html || '<tr><td colspan="7">No payments</td></tr>';
    } catch (error) {
        console.error('Payments load error:', error);
    }
}

function showRecordPayment() {
    loadOrdersForPayment();
    showModal('record-payment');
}

async function loadOrdersForPayment() {
    try {
        const response = await apiCall('/orders?paymentStatus=PENDING,PARTIAL&status=DELIVERED,COMPLETED');
        const orders = response.data;
        
        const select = document.getElementById('payment-order');
        select.innerHTML = orders.map(o => 
            `<option value="${o.id}" data-total="${o.total}" data-paid="${o.paidAmount}" data-due="${o.dueAmount}">
                ${o.orderNumber} - ${o.retailer.shopName} (Due: Rs.${parseFloat(o.dueAmount).toLocaleString()})
            </option>`
        ).join('');
    } catch (error) {
        console.error('Load orders error:', error);
    }
}

function updatePaymentInfo() {
    const select = document.getElementById('payment-order');
    const option = select.selectedOptions[0];
    
    if (option) {
        document.getElementById('payment-total').textContent = parseFloat(option.dataset.total).toLocaleString();
        document.getElementById('payment-paid').textContent = parseFloat(option.dataset.paid).toLocaleString();
        document.getElementById('payment-due').textContent = parseFloat(option.dataset.due).toLocaleString();
        document.getElementById('payment-info').style.display = 'block';
        document.getElementById('payment-amount').max = option.dataset.due;
    }
}

async function recordPayment(event) {
    event.preventDefault();
    
    const orderId = document.getElementById('payment-order').value;
    const amount = document.getElementById('payment-amount').value;
    const referenceNumber = document.getElementById('payment-reference').value;
    
    try {
        await apiCall('/credit/payment', {
            method: 'POST',
            body: JSON.stringify({
                orderId,
                amount: parseFloat(amount),
                referenceNumber
            })
        });
        
        showSuccess('Payment recorded successfully');
        closeModal();
        loadPayments();
    } catch (error) {
        console.error('Record payment error:', error);
    }
}

// Modal Management
function showModal(modalId) {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById(`${modalId}-modal`).classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
}

// Utility Functions
function getStatusColor(status) {
    const colors = {
        'DRAFT': 'info',
        'CONFIRMED': 'info',
        'VENDOR_ASSIGNED': 'info',
        'ACCEPTED': 'warning',
        'DISPATCHED': 'warning',
        'DELIVERED': 'success',
        'COMPLETED': 'success',
        'CANCELLED': 'danger'
    };
    return colors[status] || 'info';
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    document.body.insertBefore(successDiv, document.body.firstChild);
    setTimeout(() => successDiv.remove(), 3000);
}

// Search and Filter Functions
function searchRetailers() {
    const search = document.getElementById('retailer-search').value.toLowerCase();
    const rows = document.querySelectorAll('#retailers-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

function searchOrders() {
    const search = document.getElementById('order-search').value.toLowerCase();
    const rows = document.querySelectorAll('#orders-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

function filterOrders() {
    const status = document.getElementById('order-status-filter').value;
    const rows = document.querySelectorAll('#orders-list tr');
    
    rows.forEach(row => {
        if (!status) {
            row.style.display = '';
        } else {
            const statusCell = row.querySelector('.badge');
            row.style.display = statusCell && statusCell.textContent.includes(status) ? '' : 'none';
        }
    });
}

// Credit Scores
async function loadCreditScores() {
    try {
        // Load distribution
        const distResponse = await apiCall('/credit-scoring/distribution');
        const dist = distResponse.data;
        
        document.getElementById('avg-credit-score').textContent = dist.averageScore;
        document.getElementById('excellent-count').textContent = dist.distribution.excellent;
        document.getElementById('good-count').textContent = dist.distribution.good;
        document.getElementById('poor-count').textContent = 
            dist.distribution.poor + dist.distribution.veryPoor;
        
        // Load retailers with scores
        const response = await apiCall('/retailers');
        const retailers = response.data;
        
        const html = await Promise.all(retailers.map(async (retailer) => {
            let trendHtml = '-';
            try {
                const trendResponse = await apiCall(`/credit-scoring/${retailer.id}/trend?days=30`);
                const trend = trendResponse.data;
                
                if (trend.trend === 'increasing') {
                    trendHtml = `<span style="color: green;">↑ +${trend.change}</span>`;
                } else if (trend.trend === 'decreasing') {
                    trendHtml = `<span style="color: red;">↓ ${trend.change}</span>`;
                } else if (trend.trend === 'stable') {
                    trendHtml = `<span style="color: gray;">→ ${trend.change}</span>`;
                }
            } catch (e) {
                // Trend not available
            }
            
            const category = getScoreCategory(retailer.creditScore);
            const utilization = retailer.creditLimit > 0 
                ? Math.round((retailer.outstandingDebt / retailer.creditLimit) * 100)
                : 0;
            
            return `
                <tr>
                    <td>${retailer.shopName}</td>
                    <td><strong>${retailer.creditScore}</strong></td>
                    <td><span class="badge badge-${category.color}">${category.label}</span></td>
                    <td>${trendHtml}</td>
                    <td>Rs.${parseFloat(retailer.creditLimit).toLocaleString()}</td>
                    <td>${utilization}%</td>
                    <td>
                        <button onclick="viewScoreDetails('${retailer.id}')" class="btn-primary">Details</button>
                        <button onclick="recalculateScore('${retailer.id}')" class="btn-secondary">Recalculate</button>
                    </td>
                </tr>
            `;
        }));
        
        document.getElementById('credit-scores-list').innerHTML = (await Promise.all(html)).join('');
    } catch (error) {
        console.error('Credit scores load error:', error);
    }
}

function getScoreCategory(score) {
    if (score >= 750) return { label: 'Excellent', color: 'success' };
    if (score >= 650) return { label: 'Good', color: 'info' };
    if (score >= 550) return { label: 'Fair', color: 'warning' };
    if (score >= 450) return { label: 'Poor', color: 'warning' };
    return { label: 'Very Poor', color: 'danger' };
}

async function viewScoreDetails(retailerId) {
    try {
        const response = await apiCall(`/credit-scoring/${retailerId}`);
        const scoreData = response.data;
        
        const historyResponse = await apiCall(`/credit-scoring/${retailerId}/history?days=90`);
        const history = historyResponse.data;
        
        let html = `
            <div style="padding: 20px;">
                <h2>Credit Score: ${scoreData.score}</h2>
                <p><strong>Category:</strong> ${scoreData.explanation.category}</p>
                <p><strong>Summary:</strong> ${scoreData.explanation.summary}</p>
                <p><strong>Recommendation:</strong> ${scoreData.explanation.recommendation}</p>
                
                <h3 style="margin-top: 20px;">Score Breakdown</h3>
                <table style="width: 100%; margin-top: 10px;">
                    <tr>
                        <th>Factor</th>
                        <th>Score</th>
                        <th>Impact</th>
                        <th>Reason</th>
                    </tr>
                    <tr>
                        <td>Payment Timeliness (40%)</td>
                        <td>${scoreData.breakdown.paymentTimeliness.score}</td>
                        <td><span class="badge badge-${scoreData.breakdown.paymentTimeliness.impact}">${scoreData.breakdown.paymentTimeliness.impact}</span></td>
                        <td>${scoreData.breakdown.paymentTimeliness.reason}</td>
                    </tr>
                    <tr>
                        <td>Order Consistency (20%)</td>
                        <td>${scoreData.breakdown.orderConsistency.score}</td>
                        <td><span class="badge badge-${scoreData.breakdown.orderConsistency.impact}">${scoreData.breakdown.orderConsistency.impact}</span></td>
                        <td>${scoreData.breakdown.orderConsistency.reason}</td>
                    </tr>
                    <tr>
                        <td>Credit Utilization (20%)</td>
                        <td>${scoreData.breakdown.creditUtilization.score}</td>
                        <td><span class="badge badge-${scoreData.breakdown.creditUtilization.impact}">${scoreData.breakdown.creditUtilization.impact}</span></td>
                        <td>${scoreData.breakdown.creditUtilization.reason}</td>
                    </tr>
                    <tr>
                        <td>Account Age (10%)</td>
                        <td>${scoreData.breakdown.accountAge.score}</td>
                        <td><span class="badge badge-${scoreData.breakdown.accountAge.impact}">${scoreData.breakdown.accountAge.impact}</span></td>
                        <td>${scoreData.breakdown.accountAge.reason}</td>
                    </tr>
                    <tr>
                        <td>Dispute Rate (10%)</td>
                        <td>${scoreData.breakdown.disputeRate.score}</td>
                        <td><span class="badge badge-${scoreData.breakdown.disputeRate.impact}">${scoreData.breakdown.disputeRate.impact}</span></td>
                        <td>${scoreData.breakdown.disputeRate.reason}</td>
                    </tr>
                </table>
                
                <h3 style="margin-top: 20px;">Score History (Last 90 Days)</h3>
                <div style="margin-top: 10px;">
                    ${history.length > 0 ? renderScoreChart(history) : '<p>No history available</p>'}
                </div>
            </div>
        `;
        
        document.getElementById('score-details-content').innerHTML = html;
        showModal('score-details');
    } catch (error) {
        console.error('View score details error:', error);
    }
}

function renderScoreChart(history) {
    if (history.length === 0) return '<p>No data</p>';
    
    const maxScore = 900;
    const minScore = 300;
    const range = maxScore - minScore;
    
    let html = '<div style="position: relative; height: 200px; border: 1px solid #ddd; padding: 10px;">';
    
    // Draw grid lines
    for (let i = 0; i <= 6; i++) {
        const score = minScore + (range / 6) * i;
        const y = 180 - (i * 30);
        html += `<div style="position: absolute; left: 0; top: ${y}px; width: 100%; border-top: 1px solid #eee; font-size: 10px; color: #999;">${Math.round(score)}</div>`;
    }
    
    // Draw line chart
    const points = history.map((h, i) => {
        const x = (i / (history.length - 1)) * 100;
        const y = 180 - ((h.score - minScore) / range * 180);
        return `${x}%,${y}px`;
    });
    
    html += '<svg style="position: absolute; top: 10px; left: 10px; width: calc(100% - 20px); height: 180px;">';
    html += '<polyline points="' + points.map((p, i) => {
        const [x, y] = p.split(',');
        return `${parseFloat(x) * 0.01 * 100}%,${y}`;
    }).join(' ') + '" style="fill: none; stroke: #4CAF50; stroke-width: 2;" />';
    html += '</svg>';
    
    html += '</div>';
    
    return html;
}

async function recalculateScore(retailerId) {
    if (!confirm('Recalculate credit score for this retailer?')) return;
    
    try {
        await apiCall(`/credit-scoring/${retailerId}/recalculate`, { method: 'POST' });
        showSuccess('Credit score recalculated successfully');
        loadCreditScores();
    } catch (error) {
        console.error('Recalculate score error:', error);
    }
}

async function recalculateAllScores() {
    if (!confirm('Recalculate credit scores for all retailers? This may take several minutes.')) return;
    
    try {
        await apiCall('/credit-scoring/recalculate-all', { method: 'POST' });
        showSuccess('Credit score recalculation started in background');
    } catch (error) {
        console.error('Recalculate all scores error:', error);
    }
}

function searchScores() {
    const search = document.getElementById('score-search').value.toLowerCase();
    const rows = document.querySelectorAll('#credit-scores-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}
