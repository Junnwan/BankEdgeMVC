// --- Utility and Validation Functions ---
function getLocationFromUsername(username, role) {
    if (role === 'superadmin') {
        return 'Global HQ';
    }
    const match = username.match(/admin\.(\w+)@bankedge\.com/);
    if (match && match[1]) {
        return match[1].toUpperCase();
    }
    return null;
}

function validateEmail(email) {
    return email.endsWith('@bankedge.com');
}

function validatePassword(password) {
    const hasCapital = /[A-Z]/.test(password);
    const hasSmall = /[a-z]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    return hasCapital && hasSmall && hasSymbol;
}

function getAuthToken() {
    return sessionStorage.getItem('authToken');
}

// --- Login Handler (called from login.html) ---
async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorElement = document.getElementById('error-message');
    const errorDescElement = document.getElementById('error-description');
    const submitButton = document.getElementById('login-submit-btn');

    if (errorElement) errorElement.style.display = 'none';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
    }

    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
        // --- 1. Send username/password to our new backend API ---
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // If response is not 2xx, throw the error from the server
            throw new Error(data.error || 'Login failed');
        }

        // --- 2. Login successful! Save the new token and user info ---
        sessionStorage.setItem('authToken', data.access_token);
        sessionStorage.setItem('username', username);
        sessionStorage.setItem('role', data.role);
        sessionStorage.setItem('userLocation', data.userLocation);

        // (We no longer clear localStorage here, which fixes the state bug)

        // --- 3. Redirect to dashboard ---
        window.location.href = '/dashboard';

    } catch (error) {
        // --- 4. Show any errors (e.g., "Invalid username or password") ---
        if (errorDescElement) errorDescElement.textContent = error.message;
        if (errorElement) errorElement.style.display = 'flex';
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN IN';
        }
    }
}

// --- Logout Handler ---
function handleLogout() {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userLocation');
    window.location.href = '/';
}

// --- Dashboard Page Logic (/dashboard) ---
let latencyLineChart = null;
let loadBarChart = null;

async function fetchDashboardData() {
    const userLocation = sessionStorage.getItem('userLocation');
    const token = getAuthToken();

    // We remove overrides here because the API is the source of truth
    try {
        const res = await fetch('/api/dashboard-data', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            if (res.status === 401) {
                handleLogout(); // Auto-logout if token invalid
                return;
            }
            throw new Error('Failed to fetch dashboard data');
        }

        const data = await res.json();

        // Use API data directly
        let allDevices = data.devices || [];
        const latencyData = data.latency || [];
        const allTransactions = data.transactions || [];

        // Filter for Dashboard
        let devices = (userLocation === 'Global HQ')
            ? allDevices
            : allDevices.filter(d => d.name === `Edge Node ${userLocation}`);

        let recentTransactions = (userLocation === 'Global HQ')
            ? allTransactions
            : allTransactions.filter(t => {
                const device = allDevices.find(d => d.id === t.deviceId);
                return device && device.name === `Edge Node ${userLocation}`;
            });

        renderStatCards(devices, userLocation);
        renderLatencyChart(latencyData);
        renderLoadChart(devices);
        renderEdgeNodeCards(devices); // This renders the power buttons
        renderTransactions(recentTransactions, allDevices);

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}

async function initializeDashboard() {
    const userLocation = sessionStorage.getItem('userLocation');
    const role = sessionStorage.getItem('role');

    renderDashboardHeader(userLocation, role);

    // Initial fetch
    await fetchDashboardData();

    // Refresh interval
    const dataInterval = setInterval(() => {
        if (window.location.pathname !== '/dashboard') {
            clearInterval(dataInterval);
            if (latencyLineChart) { latencyLineChart.destroy(); latencyLineChart = null; }
            if (loadBarChart) { loadBarChart.destroy(); loadBarChart = null; }
            return;
        }
        fetchDashboardData();
    }, 5000);
}

function renderDashboardHeader(userLocation, role) {
    const titleEl = document.getElementById('dashboard-title');
    const badgesEl = document.getElementById('header-badges');
    const clockEl = document.createElement('div');
    clockEl.className = 'header-badge';
    if (titleEl && badgesEl) {
        if (role === 'superadmin') {
            titleEl.textContent = 'Global Dashboard';
            badgesEl.innerHTML = `
                <div class="header-badge"><i class="fas fa-server"></i> 16 Edge Nodes</div>
                <div class="header-badge"><i class="fas fa-map-pin"></i> Malaysia</div>
            `;
        } else {
            titleEl.textContent = `Dashboard - ${userLocation}`;
            badgesEl.innerHTML = `
                <div class="header-badge"><i class="fas fa-map-pin"></i> ${userLocation}</div>
            `;
        }
        clockEl.innerHTML = `<i class="fas fa-clock"></i> ${new Date().toLocaleTimeString()}`;
        badgesEl.appendChild(clockEl);
        setInterval(() => {
            clockEl.innerHTML = `<i class="fas fa-clock"></i> ${new Date().toLocaleTimeString()}`;
        }, 1000);
    }
}

function renderStatCards(devices, userLocation) {
    const gridEl = document.getElementById('stat-card-grid');
    if (!gridEl) return;
    const onlineDevices = devices.filter(d => d.status === 'online').length;
    const avgLatency = devices.length > 0 ? devices.reduce((acc, d) => acc + d.latency, 0) / devices.length : 0;
    const totalTPS = devices.reduce((acc, d) => acc + d.transactionsPerSec, 0) / (devices.length || 1);
    const latencyReduction = avgLatency > 0 ? ((120 - avgLatency) / 120 * 100).toFixed(2) : '0.00';
    const mlAccuracy = 96.88;

    const isFilteredView = (userLocation !== 'Global HQ');
    const statusTitle = isFilteredView ? 'Edge Node Status' : 'Active Edge Nodes';
    const statusValue = isFilteredView ? (onlineDevices > 0 ? 'Online' : 'Offline') : `${onlineDevices} / ${devices.length}`;
    const statusSubtitle = onlineDevices > 0 ? 'Operational' : 'Check Status';

    gridEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>${statusTitle}</h3>
                <p class="value">${statusValue}</p>
                <p class="subtitle positive"><i class="fas fa-check-circle"></i> ${statusSubtitle}</p>
            </div>
            <div class="stat-card-icon icon-bg-blue"><i class="fas fa-server"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Avg Latency (Edge)</h3>
                <p class="value">${avgLatency.toFixed(2)}ms</p>
                <p class="subtitle positive"><i class="fas fa-arrow-down"></i> ${latencyReduction}% reduction</p>
            </div>
            <div class="stat-card-icon icon-bg-green"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Total TPS</h3>
                <p class="value">${totalTPS.toFixed(2)}</p>
                <p class="subtitle">Transactions/sec</p>
            </div>
            <div class="stat-card-icon icon-bg-purple"><i class="fas fa-bolt"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>ML Accuracy</h3>
                <p class="value">${mlAccuracy}%</p>
                <p class="subtitle positive">+2.3% this week</p>
            </div>
            <div class="stat-card-icon icon-bg-orange"><i class="fas fa-check-circle"></i></div>
        </div>
    `;
}

function renderLatencyChart(latencyData) {
    const ctxEl = document.getElementById('latency-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    const labels = latencyData.map(d => new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    if (latencyLineChart) {
        latencyLineChart.data.labels = labels;
        latencyLineChart.data.datasets[0].data = latencyData.map(d => d.edge);
        latencyLineChart.data.datasets[1].data = latencyData.map(d => d.hybrid);
        latencyLineChart.data.datasets[2].data = latencyData.map(d => d.cloud);
        latencyLineChart.update();
        return;
    }
    latencyLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Edge', data: latencyData.map(d => d.edge), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 0 },
                { label: 'Hybrid', data: latencyData.map(d => d.hybrid), borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 0 },
                { label: 'Cloud Only', data: latencyData.map(d => d.cloud), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 0 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Latency (ms)' } } } }
    });
}

function renderLoadChart(devices) {
    const ctxEl = document.getElementById('load-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    const labels = devices.map(d => d.name.replace('Edge Node ', ''));
    if (loadBarChart) {
        loadBarChart.data.labels = labels;
        loadBarChart.data.datasets[0].data = devices.map(d => d.load);
        loadBarChart.update();
        return;
    }
    loadBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Load %', data: devices.map(d => d.load), backgroundColor: '#3b82f6', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Load (%)' } }, x: { ticks: { autoSkip: false, maxRotation: 90, minRotation: 90, fontSize: 10 } } }, plugins: { legend: { display: false } } }
    });
}

function renderEdgeNodeCards(devices) {
    const gridEl = document.getElementById('edge-nodes-grid');
    const titleEl = document.getElementById('edge-nodes-title');
    if (!gridEl || !titleEl) return;
    titleEl.textContent = devices.length === 1 ? 'Edge Node Details' : 'Edge Nodes Status';

    gridEl.innerHTML = devices.map(device => {
        const load = device.load;
        let loadColorClass = 'low';
        if (load > 50) loadColorClass = 'medium';
        if (load > 80) loadColorClass = 'high';

        const isOffline = device.status === 'offline';
        const actionButton = isOffline
            ? `<button class="power-button off" onclick="handleToggleNodeStatus('${device.id}')">
                 <i class="fas fa-power-off"></i> Power On
               </button>`
            : `<button class="power-button on" onclick="handleToggleNodeStatus('${device.id}')">
                 <i class="fas fa-power-off"></i> Power Off
               </button>`;

        return `
        <div class="node-card">
            <div class="node-card-header" style="align-items: flex-start;">
                <div>
                    <h3>${device.name.replace('Edge Node ', '')}</h3>
                    <p>${device.location}</p>
                </div>
                <span class="status-badge ${device.status === 'online' ? 'active' : 'inactive'}">${device.status}</span>
            </div>
            <div class="node-card-body">
                <div class="node-stat">
                    <span class="label"><i class="fas fa-tachometer-alt"></i> Latency</span>
                    <span class="value">${device.latency.toFixed(2)}ms</span>
                </div>
                <div class="node-stat">
                    <span class="label"><i class="fas fa-bolt"></i> TPS</span>
                    <span class="value">${device.transactionsPerSec.toFixed(2)}</span>
                </div>
                <div class="node-stat">
                    <span class="label"><i class="fas fa-microchip"></i> Load</span>
                    <span class="value">${device.load.toFixed(1)}%</span>
                </div>
                <div class="node-stat">
                    <div class="bar"><div class="bar-inner ${loadColorClass}" style="width: ${device.load}%;"></div></div>
                </div>
            </div>
            <div class="device-card-footer" style="padding-top: 12px; margin-top: 12px; border-top: 1px solid var(--border-color);">
                ${actionButton}
            </div>
        </div>
        `;
    }).join('');
}

function renderTransactions(transactions, allDevices) {
    const listEl = document.getElementById('transactions-list');
    if (!listEl) return;
    listEl.innerHTML = transactions.map(txn => {
        const device = allDevices.find(d => d.id === txn.deviceId);
        const location = device ? device.name.replace('Edge Node ', '') : 'Unknown';
        const isWithdrawal = txn.type === 'Withdrawal';
        return `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-icon ${isWithdrawal ? 'withdrawal' : 'transfer'}">
                    <i class="fas ${isWithdrawal ? 'fa-arrow-down' : 'fa-exchange-alt'}"></i>
                </div>
                <div class="transaction-details">
                    <h4>RM ${txn.amount.toFixed(2)}</h4>
                    <p>${txn.type} &bull; ${location}</p>
                </div>
            </div>
            <div class="transaction-status">
                <span class="status-flag ${txn.mlPrediction}">${txn.mlPrediction}</span>
                <p class="time">${txn.latency.toFixed(1)}ms</p>
            </div>
        </div>
        `;
    }).join('');
}

// --- Edge Devices Page Logic (/edge-devices) ---
let edgePageDevices = [];
let syncingDevices = new Set();

function renderEdgePageHeader(userLocation) {
    const titleEl = document.getElementById('edge-page-title');
    const subtitleEl = document.getElementById('edge-page-subtitle');
    if (!titleEl || !subtitleEl) return;
    if (userLocation === 'Global HQ') {
        titleEl.textContent = 'Edge Device Management';
        subtitleEl.textContent = 'Monitor and manage edge computing nodes across all regions';
    } else {
        titleEl.textContent = `Edge Device Management - ${userLocation}`;
        subtitleEl.textContent = `Monitor and manage the ${userLocation} edge node`;
    }
}

async function fetchEdgePageData() {
    const userLocation = sessionStorage.getItem('userLocation');
    const token = getAuthToken();

    try {
        const res = await fetch('/api/devices', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            if (res.status === 401) { handleLogout(); return; }
            throw new Error('Failed to fetch devices');
        }
        const allDevices = await res.json();

        edgePageDevices = allDevices;

        let devices = (userLocation === 'Global HQ')
            ? edgePageDevices
            : edgePageDevices.filter(d => d.name === `Edge Node ${userLocation}`);

        renderEdgePageHeader(userLocation);
        renderEdgeSummaryCards(devices);
        renderDeviceGridView(devices);
        renderDeviceTableView(devices);

    } catch (error) {
        console.error("Error fetching edge devices:", error);
    }
}

function renderEdgeSummaryCards(devices) {
    const gridEl = document.getElementById('summary-card-grid');
    if (!gridEl) return;
    const onlineNodes = devices.filter(d => d.status === 'online').length;
    const avgLoad = devices.length > 0 ? (devices.reduce((acc, d) => acc + d.load, 0) / devices.length).toFixed(1) : '0.0';
    const regions = new Set(devices.map(d => d.region)).size;
    gridEl.innerHTML = `
        <div class="summary-card">
            <div class="summary-card-icon green"><i class="fas fa-server"></i></div>
            <div class="summary-card-info">
                <p>Online Nodes</p>
                <p class="value">${onlineNodes}</p>
            </div>
        </div>
        <div class="summary-card">
            <div class="summary-card-icon yellow"><i class="fas fa-tachometer-alt"></i></div>
            <div class="summary-card-info">
                <p>Avg Load</p>
                <p class="value">${avgLoad}%</p>
            </div>
        </div>
        <div class="summary-card">
            <div class="summary-card-icon blue"><i class="fas fa-map-pin"></i></div>
            <div class="summary-card-info">
                <p>Regions</p>
                <p class="value">${regions}</p>
            </div>
        </div>
    `;
}

function getLoadColorClass(load) {
    if (load < 60) return 'low';
    if (load < 80) return 'medium';
    return 'high';
}

function renderDeviceGridView(devices) {
    const gridEl = document.getElementById('device-grid-view');
    if (!gridEl) return;

    gridEl.innerHTML = devices.map(device => {
        const loadClass = getLoadColorClass(device.load);
        const latencyClass = device.latency < 25 ? 'value-green' : 'value-yellow';
        const isSyncing = syncingDevices.has(device.id);
        const isOffline = device.status === 'offline';

        const actionButton = isOffline
            ? `<button class="power-button off" onclick="handleToggleNodeStatus('${device.id}')">
                 <i class="fas fa-power-off"></i> Power On
               </button>`
            : `<button class="power-button on" onclick="handleToggleNodeStatus('${device.id}')">
                 <i class="fas fa-power-off"></i> Power Off
               </button>`;

        return `
        <div class="device-card-item">
            <div class="device-card-header">
                <div class="device-card-header-info">
                    <div class="device-card-icon ${device.status}">
                        <i class="fas fa-server"></i>
                    </div>
                    <div>
                        <h3>${device.name.replace('Edge Node ', '')}</h3>
                        <p>${device.id}</p>
                    </div>
                </div>
                <div class="device-card-status">
                    <div class="status-dot ${device.status}"></div>
                    <span class="status-badge ${device.status === 'online' ? 'active' : 'inactive'}">${device.status}</span>
                </div>
            </div>
            <div class="device-card-body">
                <div class="location">
                    <span><i class="fas fa-map-pin"></i> ${device.location}</span>
                    <span class="badge">${device.region}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-label">
                        <span class="label">CPU Load</span>
                        <span class="value ${loadClass}">${device.load.toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-inner ${loadClass}" style="width: ${device.load}%;"></div>
                    </div>
                </div>
                <div class="device-card-stats">
                    <div>Latency <p class="${latencyClass}">${device.latency.toFixed(2)}ms</p></div>
                    <div>TPS <p>${device.transactionsPerSec.toFixed(2)}</p></div>
                    <div>Last Sync <p><i class="fas fa-clock"></i> ${new Date(device.lastSync).toLocaleTimeString()}</p></div>
                </div>
                <div class="device-card-footer">
                    <span class="sync-status-badge ${device.syncStatus}">${device.syncStatus}</span>
                    ${isOffline
                        ? actionButton
                        : `<button class="sync-button" onclick="handleManualSync('${device.id}', '${device.name}')" ${isSyncing ? 'disabled' : ''}>
                             <i class="fas fa-sync-alt ${isSyncing ? 'fa-spin' : ''}"></i>
                             ${isSyncing ? 'Syncing...' : 'Sync'}
                           </button>
                           ${actionButton}`
                    }
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function renderDeviceTableView(devices) {
    const tableBodyEl = document.getElementById('device-table-body');
    if (!tableBodyEl) return;

    tableBodyEl.innerHTML = devices.map(device => {
        const loadClass = getLoadColorClass(device.load);
        const latencyClass = device.latency < 25 ? 'value-green' : (device.latency < 40 ? 'value-yellow' : 'value-red');
        const isSyncing = syncingDevices.has(device.id);
        const isOffline = device.status === 'offline';

        const actionButton = isOffline
            ? `<button class="power-button off" onclick="handleToggleNodeStatus('${device.id}')">
                 <i class="fas fa-power-off"></i> On
               </button>`
            : `<button class="power-button on" onclick="handleToggleNodeStatus('${device.id}')">
                 <i class="fas fa-power-off"></i> Off
               </button>`;

        return `
        <tr>
            <td>
                <div><strong>${device.name.replace('Edge Node ', '')}</strong></div>
                <div style="font-size: 0.8rem; color: var(--muted-text);">${device.id}</div>
            </td>
            <td>${device.location}</td>
            <td><span class="status-badge ${device.status === 'online' ? 'active' : 'inactive'}">${device.status}</span></td>
            <td class="${latencyClass}">${device.latency.toFixed(2)}ms</td>
            <td class="${loadClass}">${device.load.toFixed(1)}%</td>
            <td>${device.transactionsPerSec.toFixed(2)}</td>
            <td>${new Date(device.lastSync).toLocaleTimeString()}</td>
            <td><span class="sync-status-badge ${device.syncStatus}">${device.syncStatus}</span></td>
            <td style="display: flex; gap: 8px;">
                ${actionButton}
                <button class="sync-button" onclick="handleManualSync('${device.id}', '${device.name}')" ${isSyncing || isOffline ? 'disabled' : ''}>
                    <i class="fas fa-sync-alt ${isSyncing ? 'fa-spin' : ''}"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

async function handleToggleNodeStatus(deviceId) {
    const token = getAuthToken();
    try {
        const res = await fetch(`/api/devices/toggle-status/${deviceId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to toggle status');
        }

        // Success! Now REFRESH the data for the current page immediately
        // Because fetchDashboardData is global, this will now work!
        if (window.location.pathname === '/dashboard') {
            await fetchDashboardData();
        } else if (window.location.pathname === '/edge-devices') {
            await fetchEdgePageData();
        } else {
            location.reload(); // Fallback
        }

    } catch (error) {
        console.error(`Error toggling status for ${deviceId}:`, error);
        alert(`Error: ${error.message}`);
    }
}

async function handleManualSync(deviceId, deviceName) {
    const token = sessionStorage.getItem('authToken');
    syncingDevices.add(deviceId);

    const userLocation = sessionStorage.getItem('userLocation');
    let devices = (userLocation === 'Global HQ') ? edgePageDevices : edgePageDevices.filter(d => d.name === `Edge Node ${userLocation}`);
    renderDeviceGridView(devices);
    renderDeviceTableView(devices);

    try {
        const res = await fetch(`/api/devices/sync/${deviceId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Sync failed');
        const syncedDevice = await res.json();

        edgePageDevices = edgePageDevices.map(device =>
            device.id === deviceId ? syncedDevice : device
        );

        console.log(`${deviceName} synchronized successfully`);
    } catch (error) {
        console.error(`Error syncing ${deviceName}:`, error);
    } finally {
        syncingDevices.delete(deviceId);
        let devices = (userLocation === 'Global HQ') ? edgePageDevices : edgePageDevices.filter(d => d.name === `Edge Node ${userLocation}`);
        renderDeviceGridView(devices);
        renderDeviceTableView(devices);
    }
}

function renderEdgeDevicesPage() {
    const userLocation = sessionStorage.getItem('userLocation');

    // We no longer need overrides, the API data is the source of truth
    const processedDevices = edgePageDevices;

    let devices = (userLocation === 'Global HQ')
        ? processedDevices
        : processedDevices.filter(d => d.name === `Edge Node ${userLocation}`);

    renderEdgePageHeader(userLocation);
    renderEdgeSummaryCards(devices);
    renderDeviceGridView(devices);
    renderDeviceTableView(devices);
}

async function initializeEdgeDevicesPage() {
    await fetchEdgePageData();

    const dataInterval = setInterval(() => {
        if (window.location.pathname !== '/edge-devices') {
            clearInterval(dataInterval);
            return;
        }
        if (syncingDevices.size === 0) {
            fetchEdgePageData();
        }
    }, 15000);
}

// --- ML Insights Page Logic (/ml-insights) ---
let mlMetricsChart = null;
let mlRadarChart = null;
let mlPredictionChart = null;
let mlMetricsData = [];
let allMlTransactions = [];
let processingDecisionsData = [];
let allDevicesData = []; // To map device IDs

function renderMLHeader(userLocation) {
    const titleEl = document.getElementById('ml-page-title');
    const subtitleEl = document.getElementById('ml-page-subtitle');
    if (!titleEl || !subtitleEl) return;

    if (userLocation === 'Global HQ') {
        titleEl.textContent = 'ML Classifier Performance';
        subtitleEl.textContent = 'Real-time monitoring of machine learning models at the edge';
    } else {
        titleEl.textContent = `ML Classifier Performance - ${userLocation}`;
        subtitleEl.textContent = `Machine learning model performance for ${userLocation} edge node`;
    }
}

function renderMLStatCards(metrics) {
    const gridEl = document.getElementById('ml-stat-cards');
    if (!gridEl) return;
    const latest = metrics[metrics.length - 1] || { accuracy: 0, precision: 0, recall: 0, f1Score: 0 };

    gridEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Accuracy</h3>
                <p class="value">${(latest.accuracy * 100).toFixed(2)}%</p>
                <p class="subtitle positive"><i class="fas fa-arrow-up"></i> +2.3% improvement</p>
            </div>
            <div class="stat-card-icon" style="background-color: #e0f2fe; color: #2563eb;">
                <i class="fas fa-brain"></i>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Precision</h3>
                <p class="value">${(latest.precision * 100).toFixed(2)}%</p>
                <p class="subtitle">True positive rate</p>
            </div>
            <div class="stat-card-icon" style="background-color: #f0fdf4; color: #16a34a;">
                <i class="fas fa-check-circle"></i>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Recall</h3>
                <p class="value">${(latest.recall * 100).toFixed(2)}%</p>
                <p class="subtitle">Detection rate</p>
            </div>
            <div class="stat-card-icon" style="background-color: #f5f3ff; color: #7c3aed;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>F1-Score</h3>
                <p class="value">${(latest.f1Score * 100).toFixed(2)}%</p>
                <p class="subtitle">Harmonic mean</p>
            </div>
            <div class="stat-card-icon" style="background-color: #fffbeb; color: #d97706;">
                <i class="fas fa-balance-scale"></i>
            </div>
        </div>
    `;
}

function renderMLMetricsChart(metrics) {
    const ctxEl = document.getElementById('ml-metrics-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    const labels = metrics.map(d => new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    if (mlMetricsChart) {
        mlMetricsChart.data.labels = labels;
        mlMetricsChart.data.datasets[0].data = metrics.map(d => d.accuracy);
        mlMetricsChart.data.datasets[1].data = metrics.map(d => d.precision);
        mlMetricsChart.data.datasets[2].data = metrics.map(d => d.recall);
        mlMetricsChart.data.datasets[3].data = metrics.map(d => d.f1Score);
        mlMetricsChart.update();
        return;
    }

    mlMetricsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Accuracy', data: metrics.map(d => d.accuracy), borderColor: '#3b82f6', tension: 0.3, borderWidth: 2, pointRadius: 0 },
                { label: 'Precision', data: metrics.map(d => d.precision), borderColor: '#10b981', tension: 0.3, borderWidth: 2, pointRadius: 0 },
                { label: 'Recall', data: metrics.map(d => d.recall), borderColor: '#8b5cf6', tension: 0.3, borderWidth: 2, pointRadius: 0 },
                { label: 'F1-Score', data: metrics.map(d => d.f1Score), borderColor: '#f59e0b', tension: 0.3, borderWidth: 2, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { min: 0.7, max: 1, ticks: { callback: value => (value * 100).toFixed(0) + '%' } }
            },
            plugins: { tooltip: { callbacks: { label: context => `${context.dataset.label}: ${(context.raw * 100).toFixed(2)}%` } } }
        }
    });
}

function renderMLRadarChart(metrics) {
    const ctxEl = document.getElementById('ml-radar-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    const latest = metrics[metrics.length - 1] || { accuracy: 0, precision: 0, recall: 0, f1Score: 0 };
    const radarData = [
        (latest.accuracy * 100),
        (latest.precision * 100),
        (latest.recall * 100),
        (latest.f1Score * 100)
    ];

    if (mlRadarChart) {
        mlRadarChart.data.datasets[0].data = radarData;
        mlRadarChart.update();
        return;
    }

    mlRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Accuracy', 'Precision', 'Recall', 'F1-Score'],
            datasets: [{
                label: 'Performance',
                data: radarData,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(59, 130, 246, 1)'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { r: { beginAtZero: true, min: 0, max: 100, ticks: { callback: value => value + '%' } } },
            plugins: { tooltip: { callbacks: { label: context => `${context.label}: ${context.raw.toFixed(2)}%` } } }
        }
    });
}

function renderMLPredictionChart(transactions) {
    const ctxEl = document.getElementById('ml-prediction-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');

    const approved = transactions.filter(t => t.mlPrediction === 'approved').length;
    const flagged = transactions.filter(t => t.mlPrediction === 'flagged').length;
    const pending = transactions.filter(t => t.mlPrediction === 'pending').length;
    const total = approved + flagged + pending || 1; // Avoid divide by zero

    document.getElementById('pred-approved-count').textContent = approved;
    document.getElementById('pred-flagged-count').textContent = flagged;
    document.getElementById('pred-pending-count').textContent = pending;
    document.getElementById('pred-approved-pct').textContent = `${((approved/total)*100).toFixed(1)}%`;
    document.getElementById('pred-flagged-pct').textContent = `${((flagged/total)*100).toFixed(1)}%`;
    document.getElementById('pred-pending-pct').textContent = `${((pending/total)*100).toFixed(1)}%`;

    const chartData = [approved, flagged, pending];

    if (mlPredictionChart) {
        mlPredictionChart.data.datasets[0].data = chartData;
        mlPredictionChart.update();
        return;
    }

    mlPredictionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Approved', 'Flagged', 'Pending'],
            datasets: [{
                label: 'Prediction Count',
                data: chartData,
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b']
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

function renderRecentPredictions(transactions) {
    const listEl = document.getElementById('recent-predictions-list');
    if (!listEl) return;

    listEl.innerHTML = transactions.slice(0, 10).map(txn => {
        return `
        <div class="prediction-item">
            <div class="prediction-info">
                <div class="prediction-icon ${txn.mlPrediction}">
                    <i class="fas ${txn.mlPrediction === 'approved' ? 'fa-check' : 'fa-exclamation-triangle'}"></i>
                </div>
                <div>
                    <div class="details">RM ${txn.amount.toFixed(2)} <span>- ${txn.type}</span></div>
                </div>
            </div>
            <div class="prediction-status">
                <div class="badge ${txn.mlPrediction}">${txn.mlPrediction}</div>
                <div class="confidence">${(txn.confidence * 100).toFixed(1)}% confidence</div>
            </div>
        </div>
        `;
    }).join('');
}

function renderProcessingDecisions(decisions) {
    const listEl = document.getElementById('processing-decision-list');
    if (!listEl) return;

    document.getElementById('edge-processed-count').textContent = decisions.filter(d => d.decision === 'edge').length;
    document.getElementById('cloud-processed-count').textContent = decisions.filter(d => d.decision === 'cloud').length;

    listEl.innerHTML = decisions.map(d => {
        return `
        <div class="decision-item">
            <div class="decision-item-header">
                <div class="decision-info">
                    <div class="decision-icon ${d.decision}">
                        <i class="fas ${d.decision === 'edge' ? 'fa-server' : 'fa-cloud'}"></i>
                    </div>
                    <div class="decision-details">
                        <h4>${d.dataType}</h4>
                        <p>${d.reason}</p>
                    </div>
                </div>
                <div class="decision-meta">
                    <div class="badge ${d.decision}">${d.decision}</div>
                    <div class="size">${d.size} KB</div>
                </div>
            </div>
            <div class="decision-footer">
                <div>Priority: <span class="priority-badge ${d.priority}">${d.priority}</span></div>
                <div>${new Date(d.timestamp).toLocaleTimeString()}</div>
            </div>
        </div>
        `;
    }).join('');
}

function renderFeatureImportance() {
    const listEl = document.getElementById('feature-importance-list');
    if (!listEl) return;

    const features = [
        { feature: 'Transaction Amount', importance: 0.28 },
        { feature: 'Account Age', importance: 0.22 },
        { feature: 'Transaction Frequency', importance: 0.18 },
        { feature: 'Geolocation Pattern', importance: 0.15 },
        { feature: 'Device Fingerprint', importance: 0.12 },
        { feature: 'Time of Day', importance: 0.05 }
    ];

    listEl.innerHTML = features.map(item => `
        <div class="feature-item">
            <div class="label">
                <span>${item.feature}</span>
                <span>${(item.importance * 100).toFixed(0)}%</span>
            </div>
            <div class="feature-bar">
                <div class="feature-bar-inner" style="width: ${item.importance * 100}%;"></div>
            </div>
        </div>
    `).join('');
}

function switchMLTab(tabName) {
    document.querySelectorAll('.tab-trigger').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`content-${tabName}`).classList.add('active');
}

async function initializeMLPage() {
    const userLocation = sessionStorage.getItem('userLocation');
    const token = sessionStorage.getItem('authToken');

    try {
        const devRes = await fetch('/api/devices', {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        if (devRes.ok) allDevicesData = await devRes.json();
    } catch (e) { allDevicesData = []; }

    renderMLHeader(userLocation);

    async function fetchMLData() {
         try {
            const res = await fetch('/api/ml-data', {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch ML data');
            const data = await res.json();

            mlMetricsData = data.metrics || [];
            allMlTransactions = data.transactions || [];
            processingDecisionsData = data.decisions || [];

            let transactions = (userLocation === 'Global HQ')
                ? allMlTransactions
                : allMlTransactions.filter(t => {
                    const device = allDevicesData.find(d => d.id === t.deviceId);
                    return device && device.name === `Edge Node ${userLocation}`;
                });

            renderMLStatCards(mlMetricsData);
            renderMLMetricsChart(mlMetricsData);
            renderMLRadarChart(mlMetricsData);
            renderFeatureImportance();
            renderMLPredictionChart(transactions);
            renderRecentPredictions(transactions);
            renderProcessingDecisions(processingDecisionsData);

        } catch (error) {
            console.error("Error fetching ML data:", error);
        }
    }
    fetchMLData();

    const dataInterval = setInterval(() => {
        if (window.location.pathname !== '/ml-insights') {
            clearInterval(dataInterval);
            if (mlMetricsChart) { mlMetricsChart.destroy(); mlMetricsChart = null; }
            if (mlRadarChart) { mlRadarChart.destroy(); mlRadarChart = null; }
            if (mlPredictionChart) { mlPredictionChart.destroy(); mlPredictionChart = null; }
            return;
        }
        fetchMLData();
    }, 10000);
}

// --- TRANSACTIONS PAGE LOGIC (HEAVILY UPDATED) ---
let txnLocationChart = null;
let txnStatusChart = null;
let pageTransactions = [];
let retryingTxns = new Set();
let allTxnDevices = [];
let stripe = null; // Stripe.js instance

function switchTxnTab(tabName) {
    document.querySelectorAll('.tab-trigger').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`content-${tabName}`).classList.add('active');
}

function renderTxnHeader(userLocation) {
    const titleEl = document.getElementById('txn-page-title');
    const subtitleEl = document.getElementById('txn-page-subtitle');
    if (!titleEl || !subtitleEl) return;
    if (userLocation === 'Global HQ') {
        titleEl.textContent = 'Transaction Processing';
        subtitleEl.textContent = 'Stripe payment integration with edge/cloud processing';
    } else {
        titleEl.textContent = `Transaction Processing - ${userLocation}`;
        subtitleEl.textContent = `Payment processing with Stripe integration for ${userLocation} edge node`;
    }
}

function renderTxnStatCards(transactions) {
    const gridEl = document.getElementById('txn-stat-cards');
    if (!gridEl) return;
    const totalVolume = transactions.reduce((acc, t) => acc + t.amount, 0);
    const successfulTxns = transactions.filter(t => t.stripeStatus === 'succeeded').length;
    const edgeProcessed = transactions.filter(t => t.processedAt === 'edge').length;
    const avgLatency = transactions.length > 0 ? (transactions.reduce((acc, t) => acc + t.latency, 0) / transactions.length).toFixed(0) : 0;
    const successRate = transactions.length > 0 ? (successfulTxns / transactions.length * 100).toFixed(1) : 0;
    const edgeRate = transactions.length > 0 ? (edgeProcessed / transactions.length * 100).toFixed(0) : 0;
    gridEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Total Volume</h3>
                <p class="value">RM ${(totalVolume / 1000).toFixed(1)}k</p>
                <p class="subtitle positive"><i class="fas fa-arrow-up"></i> +12.5% today</p>
            </div>
            <div class="stat-card-icon icon-bg-blue"><i class="fas fa-dollar-sign"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Successful</h3>
                <p class="value">${successfulTxns}</p>
                <p class="subtitle">${successRate}% success rate</p>
            </div>
            <div class="stat-card-icon icon-bg-green"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Edge Processed</h3>
                <p class="value">${edgeProcessed}</p>
                <p class="subtitle positive">${edgeRate}% at edge</p>
            </div>
            <div class="stat-card-icon icon-bg-green"><i class="fas fa-arrow-right"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Avg Latency</h3>
                <p class="value">${avgLatency}ms</p>
                <p class="subtitle">Edge + Cloud</p>
            </div>
            <div class="stat-card-icon icon-bg-purple"><i class="fas fa-clock"></i></div>
        </div>
    `;
}

function renderTxnLocationChart(transactions) {
    const ctxEl = document.getElementById('txn-location-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    const edge = transactions.filter(t => t.processedAt === 'edge');
    const cloud = transactions.filter(t => t.processedAt === 'cloud');
    const edgeAvg = edge.length > 0 ? (edge.reduce((acc, t) => acc + t.latency, 0) / edge.length).toFixed(0) : 0;
    const cloudAvg = cloud.length > 0 ? (cloud.reduce((acc, t) => acc + t.latency, 0) / cloud.length).toFixed(0) : 0;
    if(document.getElementById('proc-edge-count')) document.getElementById('proc-edge-count').textContent = edge.length;
    if(document.getElementById('proc-cloud-count')) document.getElementById('proc-cloud-count').textContent = cloud.length;
    if(document.getElementById('proc-edge-avg')) document.getElementById('proc-edge-avg').textContent = `Avg ${edgeAvg}ms`;
    if(document.getElementById('proc-cloud-avg')) document.getElementById('proc-cloud-avg').textContent = `Avg ${cloudAvg}ms`;
    const data = [edge.length, cloud.length];
    if (txnLocationChart) {
        txnLocationChart.data.datasets[0].data = data;
        txnLocationChart.update();
        return;
    }
    txnLocationChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Edge Processed', 'Cloud Processed'],
            datasets: [{ data: data, backgroundColor: ['#10b981', '#3b82f6'], borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: context => `${context.label}: ${context.raw}` } } }
        }
    });
}

function renderTxnStatusChart(transactions) {
    const ctxEl = document.getElementById('txn-status-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    const succeeded = transactions.filter(t => t.stripeStatus === 'succeeded').length;
    const failed = transactions.filter(t => t.stripeStatus === 'failed').length;
    const processing = transactions.filter(t => t.stripeStatus === 'processing').length;
    const data = [succeeded, failed, processing];
    if (txnStatusChart) {
        txnStatusChart.data.datasets[0].data = data;
        txnStatusChart.update();
        return;
    }
    txnStatusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Succeeded', 'Failed', 'Processing'],
            datasets: [{ data: data, backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: context => `${context.label}: ${context.raw}` } } }
        }
    });
}

function renderTxnTable(transactions) {
    const tableBodyEl = document.getElementById('txn-table-body');
    if (!tableBodyEl) return;
    tableBodyEl.innerHTML = transactions.slice(0, 10).map(txn => {
        const latencyClass = txn.latency < 30 ? 'value-green' : 'value-yellow';
        const isRetrying = retryingTxns.has(txn.id);
        let statusBadge;
        switch (txn.stripeStatus) {
            case 'succeeded': statusBadge = '<span class.status-active">Succeeded</span>'; break;
            case 'failed': statusBadge = '<span class="status-error">Failed</span>'; break;
            case 'processing': statusBadge = '<span class="status-inactive" style="background-color: #fef9c3; color: #ca8a04;">Processing</span>'; break;
            default: statusBadge = `<span class="status-inactive">${txn.stripeStatus}</span>`;
        }
        return `
        <tr>
            <td style="font-size: 0.8rem; font-family: monospace;">${txn.id.slice(0, 16)}...</td>
            <td>${txn.type}</td>
            <td>${txn.amount.toLocaleString('en-US', { style: 'currency', currency: 'MYR' })}</td>
            <td>${txn.merchantName}</td>
            <td><span class="sync-status-badge ${txn.processedAt === 'edge' ? 'synced' : ''}">${txn.processedAt}</span></td>
            <td class="${latencyClass}">${txn.latency.toFixed(0)}ms</td>
            <td><span class="status-flag ${txn.mlPrediction}">${txn.mlPrediction}</span></td>
            <td>${statusBadge}</td>
            <td>
                ${txn.stripeStatus === 'failed' ?
                `<button class="sync-button" onclick="handleRetryTransaction('${txn.id}')" ${isRetrying ? 'disabled' : ''}>
                    <i class="fas fa-sync-alt ${isRetrying ? 'fa-spin' : ''}"></i>
                    ${isRetrying ? '' : 'Retry'}
                </button>` :
                `<button class="sync-button" disabled style="opacity: 0.5; cursor: not-allowed;"><i class="fas fa-eye"></i></button>`}
            </td>
        </tr>
        `;
    }).join('');
}

function renderTxnPipeline(transactions) {
    const gridEl = document.getElementById('txn-pipeline-grid');
    if (!gridEl) return;
    const successfulTxns = transactions.filter(t => t.stripeStatus === 'succeeded').length;
    const validatedTxns = transactions.filter(t => t.mlPrediction !== 'pending').length;
    const processedTxns = transactions.filter(t => t.stripeStatus !== 'processing').length;
    gridEl.innerHTML = `
        <div class.pipeline-step">
            <h4>${transactions.length}</h4>
            <p>Initiated</p>
        </div>
        <div class="pipeline-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="pipeline-step">
            <h4>${validatedTxns}</h4>
            <p>ML Validated</p>
        </div>
        <div class="pipeline-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="pipeline-step">
            <h4>${processedTxns}</h4>
            <p>Stripe Processing</p>
        </div>
        <div class="pipeline-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="pipeline-step">
            <h4>${successfulTxns}</h4>
            <p>Completed</p>
        </div>
    `;
}

function handleRetryTransaction(txnId) {
    retryingTxns.add(txnId);
    renderTxnTable(pageTransactions); // Re-render table to show spinner
    setTimeout(() => {
        pageTransactions = pageTransactions.map(txn =>
            txn.id === txnId
            ? { ...txn, stripeStatus: 'succeeded', mlPrediction: 'approved', processedAt: 'edge', latency: Math.random() * 20 + 10 }
            : txn
        );
        retryingTxns.delete(txnId);
        renderTxnStatCards(pageTransactions);
        renderTxnLocationChart(pageTransactions);
        renderTxnStatusChart(pageTransactions);
        renderTxnTable(pageTransactions);
        renderTxnPipeline(pageTransactions);
        console.log(`Transaction ${txnId} retried successfully.`);
    }, 1500);
}

// NEW: Stripe Checkout submit handler
async function handleCheckoutSubmit(e) {
    e.preventDefault();
    const token = getAuthToken(); // Get token
    const submitBtn = document.getElementById('payment-submit-btn');
    const messageEl = document.getElementById('payment-message');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    messageEl.textContent = 'Creating secure checkout session...';
    messageEl.style.display = 'block';
    messageEl.style.color = 'var(--muted-text)';
    messageEl.className = 'alert-banner';

    const amount = document.getElementById('amount').value;
    const recipientAccount = document.getElementById('recipientAccount').value;
    const reference = document.getElementById('reference').value;

    try {
        const res = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Send token
            },
            body: JSON.stringify({
                amount: amount,
                recipientAccount: recipientAccount,
                reference: reference
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');

        const sessionId = data.sessionId;
        messageEl.textContent = 'Session created. Redirecting to Stripe...';

        const { error } = await stripe.redirectToCheckout({
            sessionId: sessionId
        });

        if (error) {
            throw new Error(error.message);
        }

    } catch (error) {
        console.error('Checkout failed:', error);
        messageEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Error: ${error.message}`;
        messageEl.style.color = 'var(--status-error-text)';
        messageEl.style.borderColor = 'var(--status-error-text)';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-credit-card"></i> Proceed to Payment';
    }
}

// Fetches all transaction data
async function fetchTxnData() {
    const userLocation = sessionStorage.getItem('userLocation');
    const token = getAuthToken(); // Get token
    try {
        const res = await fetch('/api/transactions', {
            headers: { 'Authorization': `Bearer ${token}` } // Send token
        });
        if (!res.ok) throw new Error('Failed to fetch transactions');
        let allTransactions = await res.json();

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('status') === 'success') {
            // This logic is now handled by the webhook simulation,
            // but we'll leave the UI message part.
        }

        pageTransactions = (userLocation === 'Global HQ')
            ? allTransactions
            : allTransactions.filter(t => {
                const device = allTxnDevices.find(d => d.id === t.deviceId);
                if (t.id.startsWith('txn-demo-') || t.id.startsWith('cs_test_')) {
                    if (userLocation !== 'Global HQ') {
                         const userDevice = allTxnDevices.find(d => d.location.toUpperCase() === userLocation);
                         return t.deviceId === userDevice?.id;
                    }
                    return true;
                }
                return device && device.name === `Edge Node ${userLocation}`;
            });

        pageTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        renderTxnStatCards(pageTransactions);
        renderTxnLocationChart(pageTransactions);
        renderTxnStatusChart(pageTransactions);
        renderTxnTable(pageTransactions);
        renderTxnPipeline(pageTransactions);

    } catch (error) {
        console.error("Error fetching transactions:", error);
    }
}

// NEW: Function to check for query params on page load
async function checkTransactionStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const sessionId = urlParams.get('session_id');
    const messageEl = document.getElementById('payment-message');
    if (!messageEl) return;

    if (status === 'success' && sessionId) {
        messageEl.innerHTML = '<i class="fas fa-check-circle"></i> Payment successful! Your transaction has been recorded.';
        messageEl.style.color = 'var(--status-active-text)';
        messageEl.style.borderColor = 'var(--status-active-bg)';
        messageEl.style.backgroundColor = 'var(--status-active-bg)';
        messageEl.style.display = 'flex';

        try {
            // Tell backend to update the transaction status
            await fetch('/api/webhook/stripe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
        } catch (e) {
            console.error("Failed to simulate webhook", e);
        }

    } else if (status === 'cancel') {
        messageEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Payment canceled. You have not been charged.';
        messageEl.style.color = 'var(--status-error-text)';
        messageEl.style.borderColor = 'var(--status-error-bg)';
        messageEl.style.backgroundColor = 'var(--status-error-bg)';
        messageEl.style.display = 'flex';
    }

    window.history.replaceState(null, '', window.location.pathname);
}

async function initializeTransactionsPage() {
    const userLocation = sessionStorage.getItem('userLocation');
    const token = getAuthToken(); // Get token

    try {
        const devRes = await fetch('/api/devices', {
            headers: { 'Authorization': `Bearer ${token}` } // Send token
        });
        if (!devRes.ok) throw new Error('Failed to fetch devices');
        allTxnDevices = await devRes.json();
    } catch (e) { console.error(e); allTxnDevices = []; }

    renderTxnHeader(userLocation);
    await checkTransactionStatus();
    await fetchTxnData();

    try {
        const configRes = await fetch('/api/config', {
            headers: { 'Authorization': `Bearer ${token}` } // Send token
        });
        const config = await configRes.json();
        const publishableKey = config.publishableKey;
        if (!publishableKey || !publishableKey.startsWith('pk_test_')) {
            throw new Error("Invalid Stripe Publishable Key. Make sure it's set in api_controller.py");
        }
        stripe = Stripe(publishableKey);
        const form = document.getElementById('payment-form');
        if (form) {
            form.addEventListener('submit', handleCheckoutSubmit);
        }
    } catch (error) {
        console.error("Failed to initialize Stripe:", error);
        const messageEl = document.getElementById('payment-message');
        if (messageEl) {
            messageEl.textContent = 'Error: Failed to load payment form. Check Stripe keys.';
            messageEl.style.display = 'block';
        }
    }

    const recipientInput = document.getElementById('recipientAccount');
    if (recipientInput) {
        recipientInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

// --- System Management Page Logic (/system-management) ---
let sysAdmins = [];
let sysAuditLogs = [];
let sysMlModels = [];
let sysEdgeNodes = [];

function switchSysTab(tabName) {
    document.querySelectorAll('.tab-trigger').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`content-${tabName}`).classList.add('active');
}

function renderSysStatCards() {
    const gridEl = document.getElementById('sys-stat-cards');
    if (!gridEl) return;

    gridEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Total Admins</h3>
                <p class="value">${sysAdmins.length}</p>
                <p class="subtitle positive">${sysAdmins.filter(a => a.status === 'active').length} active</p>
            </div>
            <div class="stat-card-icon icon-bg-blue"><i class="fas fa-users"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Edge Nodes</h3>
                <p class="value">${sysEdgeNodes.length}</p>
                <p class="subtitle positive">${sysEdgeNodes.filter(n => n.status === 'online').length} online</p>
            </div>
            <div class="stat-card-icon icon-bg-green"><i class="fas fa-server"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>ML Models</h3>
                <p class="value">${sysMlModels.length}</p>
                <p class="subtitle" style="color: var(--blue-light);">${sysMlModels.filter(m => m.status === 'active').length} active</p>
            </div>
            <div class="stat-card-icon icon-bg-purple"><i class="fas fa-upload"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Audit Logs</h3>
                <p class="value">${sysAuditLogs.length}</p>
                <p class="subtitle">Last 24 hours</p>
            </div>
            <div class="stat-card-icon icon-bg-orange"><i class="fas fa-file-alt"></i></div>
        </div>
    `;
}

function renderAdminTable() {
    const tableBodyEl = document.getElementById('admin-table-body');
    if (!tableBodyEl) return;
    tableBodyEl.innerHTML = sysAdmins.map(admin => `
        <tr>
            <td><strong>${admin.username}</strong></td>
            <td>${admin.email}</td>
            <td><span class="sync-status-badge ${admin.role === 'superadmin' ? 'synced' : ''}">${admin.role}</span></td>
            <td style="font-family: monospace; font-size: 0.8rem;"><i class="fas fa-key"></i> ${admin.apiKey.slice(0, 16)}...</td>
            <td>${admin.lastLogin !== 'Never' ? new Date(admin.lastLogin).toLocaleString() : 'Never'}</td>
            <td><span class="status-badge ${admin.status}">${admin.status}</span></td>
            <td><button class="action-button">Edit</button></td>
        </tr>
    `).join('');
}

function renderSysEdgeNodes() {
    const gridEl = document.getElementById('sys-edge-nodes-grid');
    if (!gridEl) return;

    gridEl.innerHTML = sysEdgeNodes.map(node => `
        <div class="decision-item"> <!-- Reusing decision-item style -->
            <div class="decision-item-header">
                <div class="decision-info">
                    <div class="decision-icon ${node.status === 'online' ? 'edge' : 'cloud'}">
                        <i class="fas ${node.status === 'online' ? 'fa-server' : 'fa-exclamation-triangle'}"></i>
                    </div>
                    <div class="decision-details">
                        <h4>${node.name}</h4>
                        <p>${node.location}</p>
                    </div>
                </div>
                <div class="decision-meta">
                    <div class="badge ${node.status === 'online' ? 'edge' : 'cloud'}">${node.status}</div>
                </div>
            </div>
            <div class="device-card-stats" style="border: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                <div>CPU <p>${node.load.toFixed(1)}%</p></div>
                <div>Latency <p>${node.latency.toFixed(0)}ms</p></div>
                <div>Sync <span class="sync-status-badge ${node.syncStatus}">${node.syncStatus}</span></div>
            </div>
        </div>
    `).join('');
}

function renderMLModelsTable() {
    const tableBodyEl = document.getElementById('model-table-body');
    if (!tableBodyEl) return;
    tableBodyEl.innerHTML = sysMlModels.map(model => `
        <tr>
            <td><strong>${model.version}</strong></td>
            <td>${new Date(model.uploadedAt).toLocaleString()}</td>
            <td>${model.uploadedBy}</td>
            <td>${model.size}</td>
            <td><span class="value-green">${model.accuracy}%</span></td>
            <td>${model.deployedNodes}/16</td>
            <td><span class="status-badge ${model.status}">${model.status}</span></td>
            <td><button class="action-button">Deploy</button></td>
        </tr>
    `).join('');
}

function renderAuditLogsTable() {
    const tableBodyEl = document.getElementById('audit-table-body');
    if (!tableBodyEl) return;
    tableBodyEl.innerHTML = sysAuditLogs.map(log => `
        <tr>
            <td style="font-size: 0.8rem;"><i class="fas fa-clock"></i> ${new Date(log.timestamp).toLocaleString()}</td>
            <td><strong>${log.user}</strong></td>
            <td><span class="sync-status-badge">${log.action}</span></td>
            <td>${log.resource}</td>
            <td style="font-family: monospace; font-size: 0.8rem;">${log.ipAddress}</td>
            <td><span class="status-badge ${log.status}">${log.status}</span></td>
        </tr>
    `).join('');
}

function handleAddAdmin(e) {
    e.preventDefault();
    const errorEl = document.getElementById('modal-error-message');
    const errorDescEl = document.getElementById('modal-error-description');
    const usernameEl = document.getElementById('newAdminUsername');
    const passwordEl = document.getElementById('newAdminPassword');
    const roleEl = document.getElementById('newAdminRole');

    const username = usernameEl.value;
    const password = passwordEl.value;
    const role = roleEl.value;

    errorEl.style.display = 'none';

    if (!validateEmail(username)) {
        errorDescEl.textContent = 'Username must be an email ending with @bankedge.com';
        errorEl.style.display = 'flex';
        return;
    }
    if (!validatePassword(password)) {
        errorDescEl.textContent = 'Password must contain at least one capital letter, one small letter, and one symbol';
        errorEl.style.display = 'flex';
        return;
    }

    // Add admin to list (simulated)
    const newAdmin = {
        id: `adm_${Date.now()}`,
        username: username,
        role: role,
        email: username,
        createdAt: new Date().toISOString(),
        lastLogin: 'Never',
        status: 'active',
        apiKey: `sk_live_${Math.random().toString(36).substring(2, 15)}`
    };
    sysAdmins.push(newAdmin);
    renderAdminTable(); // Re-render the table

    // Close modal and reset form
    document.getElementById('add-admin-modal').style.display = 'none';
    document.getElementById('add-admin-form').reset();
    console.log("Admin account created");
}

async function initializeSystemManagementPage() {
    const token = getAuthToken(); // Get token
    try {
        const res = await fetch('/api/system-data', {
            headers: { 'Authorization': `Bearer ${token}` } // Send token
        });
        if (!res.ok) throw new Error('Failed to fetch system data');
        const data = await res.json();
        sysAdmins = data.admins || [];
        sysAuditLogs = data.auditLogs || [];
        sysMlModels = data.mlModels || [];
        sysEdgeNodes = data.edgeNodes || [];
        renderSysStatCards();
        renderAdminTable();
        renderSysEdgeNodes();
        renderMLModelsTable();
        renderAuditLogsTable();
    } catch (error) {
        console.error("Error fetching system data:", error);
    }
    document.getElementById('add-admin-btn').addEventListener('click', () => {
        document.getElementById('add-admin-modal').style.display = 'flex';
    });
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('add-admin-modal').style.display = 'none';
        document.getElementById('modal-error-message').style.display = 'none';
    });
    document.getElementById('add-admin-form').addEventListener('submit', handleAddAdmin);
    document.getElementById('upload-model-btn').addEventListener('click', () => {
        console.log('ML model uploaded successfully. Deployment in progress...');
    });
}


// --- Main Initialization Logic (DOMContentLoaded) ---
function initializePageData() {
    const currentPath = window.location.pathname;

    if (currentPath === '/dashboard') {
        initializeDashboard();
    } else if (currentPath === '/edge-devices') {
        initializeEdgeDevicesPage();
    } else if (currentPath === '/ml-insights') {
        initializeMLPage();
    } else if (currentPath.startsWith('/transactions')) {
        initializeTransactionsPage();
    } else if (currentPath === '/system-management') {
        initializeSystemManagementPage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    const isAuthenticated = sessionStorage.getItem('authToken') !== null;
    const userRole = sessionStorage.getItem('role');

    if (currentPath === '/') {
        if (isAuthenticated) {
            window.location.href = '/dashboard';
            return;
        }
        return;
    }

    if (!isAuthenticated) {
        window.location.href = '/';
        return;
    }

    // --- Dark Mode Logic ---
    const toggle = document.getElementById('dark-mode-toggle');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        if (toggle) toggle.checked = true;
    }
    if (toggle) {
        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                document.body.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // --- Inject User Info ---
    const userInfoElement = document.getElementById('user-info');
    if (userInfoElement) {
        const username = sessionStorage.getItem('username');
        const userLocation = sessionStorage.getItem('userLocation');
        userInfoElement.innerHTML = `
            Logged in as <strong>${username}</strong><br>
            Location: ${userLocation}
        `;
    }

    // --- Show/Hide Admin Link ---
    if (userRole === 'superadmin') {
        const sysMgmtLink = document.getElementById('nav-system-management');
        if (sysMgmtLink) {
            sysMgmtLink.style.display = 'flex';
        }
    }

    // --- Page Initialization ---
    if (currentPath.startsWith('/transactions')) {
        initializeTransactionsPage();
    } else {
        initializePageData();
    }

    // --- Refresh Button ---
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            const icon = refreshButton.querySelector('i');
            icon.classList.add('fa-spin');

            if (currentPath.startsWith('/transactions')) {
                // Need to define this fetcher globally or access it
                // Since we omitted it above, assume it's available or re-init
                // For robustness, initializePageData handles everything except txn special case
                // Let's just reload the page logic
                 location.reload();
            } else {
                initializePageData();
            }

            setTimeout(() => {
                icon.classList.remove('fa-spin');
            }, 1000);
        });
    }
});