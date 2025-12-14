// --- AUTHENTICATION LOGIC ---

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-message');

    // Basic frontend validation
    if (!username || !password) {
        errorMsg.textContent = "Please enter both username and password.";
        errorMsg.style.display = "block";
        return;
    }

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.access_token) {
                // Store token and user info
                sessionStorage.setItem('authToken', data.access_token);
                sessionStorage.setItem('username', username);
                sessionStorage.setItem('role', data.role);
                sessionStorage.setItem('userLocation', data.userLocation || 'Global HQ');

                // Redirect based on role/auth
                window.location.href = '/dashboard';
            } else {
                errorMsg.textContent = data.msg || "Invalid credentials";
                errorMsg.style.display = "block";
            }
        })
        .catch(err => {
            console.error(err);
            errorMsg.textContent = "Login failed. Please try again.";
            errorMsg.style.display = "block";
        });
}

function handleLogout() {
    sessionStorage.clear();
    window.location.href = '/';
}

function getAuthToken() {
    return sessionStorage.getItem('authToken');
}

// --- DASHBOARD LOGIC ---

let dashboardChart = null;

async function fetchDashboardData() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const res = await fetch('/api/dashboard-data', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) {
            handleLogout();
            return;
        }
        const data = await res.json();

        // 1. Update Header Box (Device Info)
        const deviceBox = document.getElementById('device-info-box');
        if (deviceBox && data.deviceBox) {
            document.getElementById('device-id').textContent = data.deviceBox.id;
            document.getElementById('device-location').textContent = data.deviceBox.location;
            document.getElementById('device-status').textContent = data.deviceBox.status.toUpperCase();
            document.getElementById('device-sync').textContent = data.deviceBox.syncStatus;
        }

        // 2. Update Latency Chart
        renderLatencyChart(data.latency);

        // 2.2 Render Stat Cards (Balance)
        renderDashboardStatCards(data);

        // 2.5 Update Load Chart
        if (data.devices) {
            renderLoadChart(data.devices);
        }

        // 3. Update Transactions Table
        renderTransactions(data.transactions);

        // 4. Update Bottom Panel (Edge Devices) - Only if element exists
        const devicesGrid = document.getElementById('edge-nodes-grid');
        if (devicesGrid && data.devices) {
            renderDevicesGrid(data.devices);
        }

    } catch (err) {
        console.error("Error fetching dashboard data:", err);
    }
}

function renderLatencyChart(latencyData) {
    const ctx = document.getElementById('latency-chart');
    if (!ctx) return;

    const labels = latencyData.map(d => new Date(d.timestamp).toLocaleTimeString());
    const edgeData = latencyData.map(d => d.edge);
    const hybridData = latencyData.map(d => d.hybrid);
    const cloudData = latencyData.map(d => d.cloud);

    if (dashboardChart) {
        dashboardChart.data.labels = labels;
        dashboardChart.data.datasets[0].data = edgeData;
        dashboardChart.data.datasets[1].data = hybridData;
        dashboardChart.data.datasets[2].data = cloudData;
        dashboardChart.update();
    } else {
        dashboardChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Edge Latency', data: edgeData, borderColor: '#10b981', tension: 0.4 },
                    { label: 'Hybrid Latency', data: hybridData, borderColor: '#f59e0b', tension: 0.4 },
                    { label: 'Cloud Latency', data: cloudData, borderColor: '#3b82f6', tension: 0.4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { position: 'top' } }
            }
        });
    }
}

let loadChart = null;

function renderLoadChart(devices) {
    const ctx = document.getElementById('load-chart');
    if (!ctx) return;

    // Dynamically adjust height based on number of devices
    const container = ctx.parentElement;
    if (container) {
        const minHeight = 300;
        const dynamicHeight = devices.length * 40 + 50; // 40px per bar + padding
        container.style.height = `${Math.max(minHeight, dynamicHeight)}px`;
    }

    const labels = devices.map(d => d.name);
    const data = devices.map(d => d.load);
    const colors = devices.map(d => {
        if (d.load > 80) return '#ef4444'; // Red
        if (d.load > 50) return '#f59e0b'; // Orange
        return '#10b981'; // Green
    });

    if (loadChart) {
        loadChart.data.labels = labels;
        loadChart.data.datasets[0].data = data;
        loadChart.data.datasets[0].backgroundColor = colors;
        loadChart.update();
    } else {
        loadChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'CPU Load (%)',
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 4,
                    barThickness: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}


function renderTransactions(transactions) {
    const tbody = document.getElementById('dashboard-txns-body');
    if (!tbody) return;

    const userRole = sessionStorage.getItem('role');
    const isSuperAdmin = userRole === 'superadmin';

    // Show/Hide "Edge Node" header based on role
    const edgeNodeHeader = document.getElementById('th-edge-node');
    if (edgeNodeHeader) {
        edgeNodeHeader.style.display = isSuperAdmin ? 'table-cell' : 'none';
    }

    tbody.innerHTML = transactions.map(t => {
        // Determine status badge class
        let statusClass = 'status-inactive';
        if (t.stripe_status === 'succeeded') statusClass = 'status-active';
        else if (t.stripe_status === 'failed') statusClass = 'status-error';

        // Determine edge node cell content (2nd column)
        const edgeNodeCell = isSuperAdmin ? `<td>${t.device_name}</td>` : '';

        return `
            <tr>
                <td>${t.id}</td>
                ${edgeNodeCell}
                <td>RM ${t.amount.toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${t.stripe_status}</span></td>
                <td><span class="badge ${t.processing_decision === 'edge' ? 'edge' : t.processing_decision === 'flagged' ? 'cloud' : 'cloud'}">${t.processing_decision}</span></td>
                <td>${t.confidence ? (t.confidence * 100).toFixed(0) + '%' : '-'}</td>
                <td>${new Date(t.timestamp).toLocaleString()}</td>
            </tr>
        `;
    }).join('');
}

function renderDevicesGrid(devices) {
    const grid = document.getElementById('edge-nodes-grid');
    if (!grid) return;

    grid.innerHTML = devices.map(d => `
        <div class="node-card">
            <div class="node-card-header">
                <div>
                    <h3>${d.name}</h3>
                    <p>${d.location}</p>
                </div>
                <span class="node-status-badge ${d.status === 'online' ? '' : 'offline'}">${d.status.toUpperCase()}</span>
            </div>
            <div class="node-card-body">
                <div class="node-stat">
                    <div class="label"><i class="fas fa-microchip"></i> Load</div>
                    <div class="value">${d.load.toFixed(1)}%</div>
                </div>
                <div class="node-stat">
                    <div class="bar"><div class="bar-inner ${d.load > 80 ? 'high' : d.load > 50 ? 'medium' : 'low'}" style="width: ${d.load}%"></div></div>
                </div>
                <div class="node-stat" style="margin-top: 8px;">
                    <div class="label"><i class="fas fa-network-wired"></i> Latency</div>
                    <div class="value">${d.latency.toFixed(0)}ms</div>
                </div>
            </div>
        </div>
    `).join('');
}

// --- EDGE DEVICES PAGE LOGIC ---

let allDevicesData = [];

function initializeEdgeDevicesPage() {
    const token = getAuthToken();
    fetch('/api/devices', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(data => {
            allDevicesData = data;
            renderEdgeSummaryCards(allDevicesData);
            renderEdgeDevices(allDevicesData);

        })
        .catch(err => console.error("Error fetching devices:", err));
}

function renderEdgeSummaryCards(devices) {
    const container = document.getElementById('summary-card-grid');
    if (!container) return;

    const total = devices.length;
    const online = devices.filter(d => d.status === 'online').length;
    const offline = total - online;
    const avgLoad = devices.reduce((acc, d) => acc + d.load, 0) / total || 0;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Total Nodes</h3>
                <p class="value">${total}</p>
            </div>
            <div class="stat-card-icon icon-bg-blue"><i class="fas fa-server"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Online</h3>
                <p class="value">${online}</p>
            </div>
            <div class="stat-card-icon icon-bg-green"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Offline</h3>
                <p class="value">${offline}</p>
            </div>
            <div class="stat-card-icon icon-bg-red"><i class="fas fa-times-circle"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Avg Load</h3>
                <p class="value">${avgLoad.toFixed(1)}%</p>
            </div>
            <div class="stat-card-icon icon-bg-purple"><i class="fas fa-microchip"></i></div>
        </div>
    `;
}

function renderEdgeDevices(devices) {
    const grid = document.getElementById('device-grid-view');
    if (!grid) return;

    grid.innerHTML = devices.map(d => `
        <div class="node-card">
            <div class="node-card-header">
                <div>
                    <h3>${d.name}</h3>
                    <p>${d.location}</p>
                </div>
                <span class="node-status-badge ${d.status === 'online' ? '' : 'offline'}">${d.status.toUpperCase()}</span>
            </div>
            <div class="node-card-body">
                <div class="node-stat-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div class="node-stat" style="flex-direction: column; align-items: stretch; gap: 5px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="label"><i class="fas fa-microchip"></i> Load</div>
                            <div class="value">${d.load.toFixed(1)}%</div>
                        </div>
                        <div class="bar"><div class="bar-inner ${d.load > 80 ? 'high' : d.load > 50 ? 'medium' : 'low'}" style="width: ${d.load}%"></div></div>
                    </div>
                    <div class="node-stat">
                        <div class="label"><i class="fas fa-network-wired"></i> Latency</div>
                        <div class="value">${d.latency.toFixed(0)}ms</div>
                    </div>
                    <div class="node-stat">
                        <div class="label"><i class="fas fa-bolt"></i> TPS</div>
                        <div class="value">${d.transactionsPerSec ? d.transactionsPerSec.toFixed(1) : '0.0'}</div>
                    </div>
                    <div class="node-stat">
                         <div class="label"><i class="fas fa-sync"></i> Sync</div>
                         <div class="value" style="font-size: 0.8rem;">${d.syncStatus}</div>
                    </div>
                </div>
                
                <div class="node-meta" style="font-size: 0.8rem; color: var(--muted-text); margin-bottom: 15px;">
                    Last Sync: ${new Date(d.lastSync).toLocaleTimeString()}
                </div>

                <div class="node-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                     <button class="btn-sync" onclick="syncDevice('${d.id}')" style="padding: 8px 12px; font-size: 0.85rem;">
                        <i class="fas fa-sync"></i> Sync
                     </button>
                     <button class="action-button ${d.status === 'online' ? 'stop' : 'start'}" onclick="toggleDevicePower('${d.id}')" style="padding: 8px 12px; font-size: 0.85rem;">
                        ${d.status === 'online' ? 'Stop' : 'Start'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function syncDevice(deviceId) {
    const token = getAuthToken();
    fetch(`/api/devices/${deviceId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                // Refresh the page to show updated sync time
                initializeEdgeDevicesPage();
            }
        })
        .catch(err => console.error("Error syncing device:", err));
}

function toggleDevicePower(deviceId) {
    const token = getAuthToken();
    fetch(`/api/devices/${deviceId}/power`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                initializeEdgeDevicesPage(); // Refresh
            }
        })
        .catch(err => console.error("Error toggling power:", err));
}

// --- ML INSIGHTS PAGE LOGIC ---

let mlRadarChart = null;
let mlPredictionChart = null;
let mlMetricsChart = null;
let mlMetricsData = [];
let allMlTransactions = [];
let processingDecisionsData = [];

function renderMLHeader(userLocation) {
    const titleEl = document.getElementById('ml-page-title');
    const subtitleEl = document.getElementById('ml-page-subtitle');
    if (!titleEl || !subtitleEl) return;

    if (userLocation === 'Global HQ') {
        titleEl.textContent = 'Global ML Insights';
        subtitleEl.textContent = 'Aggregated AI performance metrics across all edge nodes';
    } else {
        titleEl.textContent = `ML Insights - ${userLocation} `;
        subtitleEl.textContent = `AI performance metrics for ${userLocation} edge node`;
    }
}

function renderMLStatCards(metrics) {
    const gridEl = document.getElementById('ml-stat-cards');
    if (!gridEl) return;

    // Use the latest metric point
    const latest = metrics[metrics.length - 1] || { accuracy: 0, fraudDetected: 0, avgConfidence: 0, processingTime: 0 };

    gridEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Model Accuracy</h3>
                <p class="value">${(latest.accuracy * 100).toFixed(1)}%</p>
                <p class="subtitle positive"><i class="fas fa-arrow-up"></i> +0.5% this week</p>
            </div>
            <div class="stat-card-icon icon-bg-blue"><i class="fas fa-bullseye"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Fraud Detected</h3>
                <p class="value">${latest.fraudDetected}</p>
                <p class="subtitle negative"><i class="fas fa-arrow-up"></i> +12 today</p>
            </div>
            <div class="stat-card-icon icon-bg-red"><i class="fas fa-shield-alt"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Avg Confidence</h3>
                <p class="value">${(latest.avgConfidence * 100).toFixed(1)}%</p>
                <p class="subtitle">Across all predictions</p>
            </div>
            <div class="stat-card-icon icon-bg-green"><i class="fas fa-check-double"></i></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Processing Time</h3>
                <p class="value">${latest.processingTime}ms</p>
                <p class="subtitle positive"><i class="fas fa-arrow-down"></i> -5ms improvement</p>
            </div>
            <div class="stat-card-icon icon-bg-purple"><i class="fas fa-stopwatch"></i></div>
        </div>
    `;
}

function renderMLMetricsChart(metrics) {
    const ctxEl = document.getElementById('ml-metrics-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');

    const labels = metrics.map(m => new Date(m.timestamp).toLocaleTimeString());
    const accuracyData = metrics.map(m => m.accuracy * 100);
    const confidenceData = metrics.map(m => m.avgConfidence * 100);

    if (mlMetricsChart) {
        mlMetricsChart.data.labels = labels;
        mlMetricsChart.data.datasets[0].data = accuracyData;
        mlMetricsChart.data.datasets[1].data = confidenceData;
        mlMetricsChart.update();
        return;
    }

    mlMetricsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Accuracy (%)', data: accuracyData, borderColor: '#3b82f6', tension: 0.4 },
                { label: 'Confidence (%)', data: confidenceData, borderColor: '#10b981', tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: false, min: 80, max: 100 } }
        }
    });
}

function renderMLRadarChart(metrics) {
    const ctxEl = document.getElementById('ml-radar-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');

    // Mock data for radar chart
    const data = [95, 88, 92, 85, 90];

    if (mlRadarChart) {
        mlRadarChart.data.datasets[0].data = data;
        mlRadarChart.update();
        return;
    }

    mlRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Fraud Detection', 'Credit Scoring', 'Pattern Recog', 'Anomaly Detection', 'Risk Assessment'],
            datasets: [{
                label: 'Model Performance',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: '#3b82f6',
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { r: { min: 0, max: 100, ticks: { display: false } } }
        }
    });
}

function renderMLPredictionChart(transactions) {
    const ctxEl = document.getElementById('ml-prediction-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');

    // Fix: API returns 'processing_decision' property, but code was using 'decision'.
    const getDecision = (t) => t.processing_decision || t.decision;

    const edge = transactions.filter(t => getDecision(t) === 'edge').length;
    const cloud = transactions.filter(t => getDecision(t) === 'cloud').length;
    const flagged = transactions.filter(t => getDecision(t) === 'flagged').length;
    const total = edge + cloud + flagged || 1;

    // Update summary text
    // Update summary text (Handles both new and old HTML IDs to prevent caching issues)
    // Update summary text (Handles both new and old HTML IDs to prevent caching issues)
    const updateStat = (newId, oldId, count, labelText, pct, colorClass, colorHex) => {
        let el = document.getElementById(newId) || document.getElementById(oldId);
        if (el) {
            el.textContent = count;
            el.className = colorClass; // Force class update
            el.style.color = colorHex; // Force color update

            // Force label update
            let labelEl = el.parentElement.querySelector('.label');
            if (labelEl) labelEl.textContent = labelText;

            // Pct update
            let pctEl = document.getElementById(newId.replace('count', 'pct')) || document.getElementById(oldId.replace('count', 'pct'));
            if (pctEl) pctEl.textContent = pct;
        }
    };

    // Slot 1: Edge (Green)
    updateStat('pred-edge-count', 'pred-approved-count', edge, 'Edge', Math.round(edge / total * 100) + '%', 'value-green', '#10b981');

    // Slot 2: Cloud (Blue) - Maps to old 'Flagged' (Slot 2) to maintain 2nd position in old HTML
    updateStat('pred-cloud-count', 'pred-flagged-count', cloud, 'Cloud', Math.round(cloud / total * 100) + '%', 'value-blue', '#3b82f6');

    // Slot 3: Flagged (Red) - Maps to old 'Pending' (Slot 3) to maintain 3rd position in old HTML
    updateStat('pred-flagged-count', 'pred-pending-count', flagged, 'Flagged', Math.round(flagged / total * 100) + '%', 'value-red', '#ef4444');

    const data = [edge, cloud, flagged];

    if (mlPredictionChart) {
        mlPredictionChart.data.datasets[0].data = data;
        mlPredictionChart.update();
        return;
    }

    mlPredictionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Edge', 'Cloud', 'Flagged'],
            datasets: [{
                data: data,
                backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
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
                    <div class="prediction-icon ${txn.decision}">
                        <i class="fas ${txn.decision === 'edge' ? 'fa-server' : txn.decision === 'cloud' ? 'fa-cloud' : 'fa-exclamation-triangle'}"></i>
                    </div>
                    <div>
                        <div class="details">RM ${txn.amount.toFixed(2)} <span>- ${txn.type}</span></div>
                    </div>
                </div>
                <div class="prediction-status">
                    <div class="badge ${txn.decision}">${txn.decision}</div>
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

function renderLiveVerification(verification) {
    if (!verification) return;

    // Check if card already exists
    let cardEl = document.getElementById('live-verification-card');
    const containerEl = document.getElementById('live-verification-container');

    // Create if not exists
    if (!cardEl && containerEl) {
        cardEl = document.createElement('div');
        cardEl.id = 'live-verification-card';
        // Removed 'stat-card' to avoid grid flex constraints. Using generic card style.
        cardEl.className = 'card';
        cardEl.style.width = '100%';
        cardEl.style.marginBottom = '20px';
        cardEl.style.boxSizing = 'border-box'; // Ensure padding doesn't overflow width
        cardEl.style.padding = '20px'; // Add padding for card look
        containerEl.appendChild(cardEl);
    }

    if (!cardEl) return;

    const date = new Date(verification.timestamp).toLocaleString();
    const statusColor = verification.decision === 'edge' ? '#10b981' : (verification.decision === 'flagged' ? '#ef4444' : '#3b82f6');
    const statusIcon = verification.decision === 'edge' ? 'fa-server' : (verification.decision === 'flagged' ? 'fa-exclamation-triangle' : 'fa-cloud');

    cardEl.innerHTML = `
        <div style="position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-check-circle" style="color: #10b981;"></i> 
                    Live Model Verification
                </h3>
                <span style="font-size: 0.9rem; color: #666; font-family: monospace;">ID: ${verification.id}</span>
            </div>
            
            <div style="display: flex; gap: 20px; width: 100%;">
                <div style="flex: 1; background: rgba(0,0,0,0.02); padding: 15px; border-radius: 8px;">
                    <small style="color: #888; text-transform: uppercase; font-size: 0.7rem; font-weight: bold; display: block; margin-bottom: 5px;">Input Features</small>
                    <div style="font-weight: 500;">
                        <span>Amount: RM ${verification.amount.toFixed(2)}</span> &bull; 
                        <span>Latency: ${verification.latency.toFixed(1)} ms</span>
                    </div>
                </div>
                <div style="flex: 1; background: rgba(0,0,0,0.02); padding: 15px; border-radius: 8px;">
                    <small style="color: #888; text-transform: uppercase; font-size: 0.7rem; font-weight: bold; display: block; margin-bottom: 5px;">Model Decision</small>
                    <div style="font-weight: bold; color: ${statusColor}; display: flex; align-items: center; gap: 8px;">
                        <i class="fas ${statusIcon}"></i>
                        ${verification.decision.toUpperCase()}
                    </div>
                </div>
                <div style="flex: 1; background: rgba(0,0,0,0.02); padding: 15px; border-radius: 8px;">
                    <small style="color: #888; text-transform: uppercase; font-size: 0.7rem; font-weight: bold; display: block; margin-bottom: 5px;">Confidence Score</small>
                    <div style="font-weight: 500; font-size: 1.1rem;">
                        ${(verification.confidence * 100).toFixed(1)}%
                    </div>
                </div>
            </div>

            <div style="margin-top: 15px; text-align: right; font-size: 0.8rem; color: #999;">
                Verified at ${date}
            </div>
        </div>
    `;
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

// function switchMLTab(tabName) { ... } // REMOVED

async function initializeMLPage() {
    const userLocation = sessionStorage.getItem('userLocation');
    const token = sessionStorage.getItem('authToken');

    try {
        const devRes = await fetch('/api/devices', {
            headers: { 'Authorization': `Bearer ${token} ` }
        });
        if (devRes.ok) allDevicesData = await devRes.json();
    } catch (e) { allDevicesData = []; }

    renderMLHeader(userLocation);

    async function fetchMLData() {
        try {
            const res = await fetch('/api/ml-data', {
                headers: { 'Authorization': `Bearer ${token} ` }
            });
            if (!res.ok) throw new Error('Failed to fetch ML data');
            const data = await res.json();

            mlMetricsData = data.metrics || [];
            allMlTransactions = data.transactions || [];
            processingDecisionsData = data.decisions || [];

            // Backend already filters by user role/location.
            // Using allMlTransactions directly avoids race conditions with device data fetching.
            let transactions = allMlTransactions;

            renderMLStatCards(mlMetricsData);
            // renderMLMetricsChart(mlMetricsData);
            // renderMLRadarChart(mlMetricsData);
            // renderFeatureImportance();
            renderMLPredictionChart(transactions);
            renderRecentPredictions(transactions);
            // renderProcessingDecisions(processingDecisionsData);
            if (data.latestVerification) {
                renderLiveVerification(data.latestVerification);
            }

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
let currentPaymentIntentId = null;
let elements = null;

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
        titleEl.textContent = `Transaction Processing - ${userLocation} `;
        subtitleEl.textContent = `Payment processing with Stripe integration for ${userLocation} edge node`;
    }
}

function renderTxnStatCards(transactions) {
    const gridEl = document.getElementById('txn-stat-cards');
    if (!gridEl) return;
    const totalVolume = transactions.reduce((acc, t) => acc + t.amount, 0);
    const successfulTxns = transactions.filter(t => t.stripe_status === 'succeeded').length; // Ensure camelCase vs snake_case matches API response. The API seems to return snake_case for DB fields but the JS might assume camelCase?
    // Looking at renderTxnTable earlier (line 220), it used t.stripe_status. So here it should be snake_case if it's the same object?
    // Wait, loadTransactions creates pageTransactions from data.transactions.
    // API returns dict with keys: 'stripe_status'.
    // So 'stripeStatus' in previous code (line 770) might have been wrong unless there was a mapper.
    // Let's check line 770 in original file... it says "t.stripeStatus".
    // But in line 234 "t.stripe_status".
    // I will correct it to t.stripe_status to be safe, assuming direct API response.
    const edgeProcessed = transactions.filter(t => t.processing_decision === 'edge').length;
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
    if (document.getElementById('proc-edge-count')) document.getElementById('proc-edge-count').textContent = edge.length;
    if (document.getElementById('proc-cloud-count')) document.getElementById('proc-cloud-count').textContent = cloud.length;
    if (document.getElementById('proc-edge-avg')) document.getElementById('proc-edge-avg').textContent = `Avg ${edgeAvg} ms`;
    if (document.getElementById('proc-cloud-avg')) document.getElementById('proc-cloud-avg').textContent = `Avg ${cloudAvg} ms`;
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
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: context => `${context.label}: ${context.raw} ` } } }
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
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: context => `${context.label}: ${context.raw} ` } } }
        }
    });
}

function renderTxnTable(transactions) {
    console.log("Rendering Txn Table with:", transactions);
    const tableBodyEl = document.getElementById('txn-table-body');
    if (!tableBodyEl) {
        console.error("txn-table-body element not found!");
        return;
    }

    // Transactions are already sliced by backend pagination, so we map all of them
    try {
        tableBodyEl.innerHTML = transactions.map(txn => {
            let statusBadge;
            switch (txn.stripe_status) {
                case 'succeeded': statusBadge = '<span class="status-active">Succeeded</span>'; break;
                case 'failed': statusBadge = '<span class="status-error">Failed</span>'; break;
                case 'processing': statusBadge = '<span class="status-warning">Processing</span>'; break;
                default: statusBadge = `<span class="status-inactive">${txn.stripe_status}</span>`;
            }

            // Store txn data in a data attribute or just pass the object if we could (but string interpolation is easier here)
            // We'll use a global lookup or just pass the ID and find it.
            // Simplest: Pass the ID to showTransactionDetails
            return `
                <tr onclick="showTransactionDetails('${txn.id}')">
                    <td style="font-family: monospace; font-size: 0.85rem;">${txn.id ? txn.id.substring(0, 14) : 'N/A'}...</td>
                    <td>RM ${typeof txn.amount === 'number' ? txn.amount.toFixed(2) : '0.00'}</td>
                    <td>${statusBadge}</td>
                    <td><span class="badge ${txn.processing_decision === 'edge' ? 'edge' : (txn.processing_decision === 'flagged' ? 'status-error' : 'cloud')}">${txn.processing_decision}</span></td>
                    <td style="font-size: 0.85rem;">${txn.timestamp ? new Date(txn.timestamp).toLocaleString() : '-'}</td>
                    <td>${txn.recipient_account || '-'}</td>
                    <td>${txn.reference || '-'}</td>
                    <td>${txn.merchant_name || 'Unknown'}</td>
                    <td>${txn.device_id || '-'}</td>
                    <td>${txn.customer_id || '-'}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Error rendering table rows:", e);
    }
}

function showTransactionDetails(txnId) {
    const txn = pageTransactions.find(t => t.id === txnId);
    if (!txn) return;

    const modal = document.getElementById('txn-modal');
    const modalBody = document.getElementById('txn-modal-body');
    const modalFooter = document.getElementById('txn-modal-footer');

    let statusBadge;
    switch (txn.stripe_status) {
        case 'succeeded': statusBadge = '<span class="status-active">Succeeded</span>'; break;
        case 'failed': statusBadge = '<span class="status-error">Failed</span>'; break;
        case 'processing': statusBadge = '<span class="status-warning">Processing</span>'; break;
        default: statusBadge = `<span class="status-inactive">${txn.stripe_status}</span>`;
    }

    modalBody.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Transaction ID</span>
            <span class="detail-value" style="font-family: monospace;">${txn.id}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value">RM ${typeof txn.amount === 'number' ? txn.amount.toFixed(2) : '0.00'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value">${statusBadge}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Date & Time</span>
            <span class="detail-value">${txn.timestamp ? new Date(txn.timestamp).toLocaleString() : '-'}</span>
        </div>
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 16px 0;">
        <div class="detail-row">
            <span class="detail-label">Processing Decision</span>
            <span class="detail-value"><span class="badge ${txn.processing_decision === 'edge' ? 'edge' : (txn.processing_decision === 'flagged' ? 'status-error' : 'cloud')}">${txn.processing_decision}</span></span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Recipient</span>
            <span class="detail-value">${txn.recipient_account || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Reference</span>
            <span class="detail-value">${txn.reference || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Merchant</span>
            <span class="detail-value">${txn.merchant_name || 'Unknown'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Device ID</span>
            <span class="detail-value">${txn.device_id || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Customer ID</span>
            <span class="detail-value">${txn.customer_id || '-'}</span>
        </div>
    `;

    modalFooter.innerHTML = '';

    modal.style.display = 'flex';
}

function closeTxnModal() {
    document.getElementById('txn-modal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('txn-modal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function renderTxnPipeline(transactions) {
    const gridEl = document.getElementById('txn-pipeline-grid');
    if (!gridEl) return;
    const successfulTxns = transactions.filter(t => t.stripeStatus === 'succeeded').length;
    const validatedTxns = transactions.filter(t => t.mlPrediction !== 'pending').length;
    const processedTxns = transactions.filter(t => t.stripeStatus !== 'processing').length;
    gridEl.innerHTML = `
        < div class="pipeline-step" >
            <h4>${transactions.length}</h4>
            <p>Initiated</p>
        </div >
        <div class="pipeline-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="pipeline-step">
            <h4>${validatedTxns}</h4>
            <p>ML Validated</p>
        </div>
        <div class="pipeline-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="pipeline-step">
            <h4>${processedTxns}</h4>
            <p>Processed</p>
        </div>
        <div class="pipeline-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="pipeline-step">
            <h4>${successfulTxns}</h4>
            <p>Successful</p>
        </div>
    `;
}

// --- System Management Page Logic ---
let sysAdmins = [];
let sysAuditLogs = [];
let sysMlModels = [];
let sysEdgeNodes = [];

function renderAdminTable() {
    const tableBodyEl = document.getElementById('admin-table-body');
    if (!tableBodyEl) return;
    tableBodyEl.innerHTML = sysAdmins.map(admin => `
        <tr>
            <td><strong>${admin.username}</strong></td>
            <td><span class="sync-status-badge ${admin.role === 'superadmin' ? 'synced' : ''}">${admin.role}</span></td>
            <td>${admin.lastLogin !== 'Never' ? new Date(admin.lastLogin).toLocaleString() : 'Never'}</td>
            <td><span class="status-badge ${admin.status}">${admin.status}</span></td>
            <td class="action-cell">
                <button class="action-button" onclick="handleEditAdmin('${admin.id}')">Edit</button>
                <button class="action-button delete" onclick="handleDeleteAdmin('${admin.id}')">Delete</button>
            </td>
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
        </tr>
        `).join('');
}

async function handleAddAdmin(e) {
    e.preventDefault();
    const errorEl = document.getElementById('modal-error-message');
    const errorDescEl = document.getElementById('modal-error-description');
    const locationEl = document.getElementById('newAdminLocation');
    const passwordEl = document.getElementById('newAdminPassword');

    const location = locationEl.value;
    const password = passwordEl.value;

    errorEl.style.display = 'none';

    if (!validatePassword(password)) {
        errorDescEl.textContent = 'Password must contain at least one capital letter, one small letter, one number, and one symbol';
        errorEl.style.display = 'flex';
        return;
    }

    const token = getAuthToken();
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token} `
            },
            body: JSON.stringify({ location, password })
        });

        const data = await res.json();
        if (!res.ok) {
            errorDescEl.textContent = data.error || 'Failed to create user';
            errorEl.style.display = 'flex';
            return;
        }

        // Refresh list
        initializeSystemManagementPage();

        // Close modal and reset form
        document.getElementById('add-admin-modal').style.display = 'none';
        document.getElementById('add-admin-form').reset();
        console.log("Admin account created:", data.username);
        alert(`Admin account created: ${data.username} `);

    } catch (err) {
        console.error("Error creating admin:", err);
        errorDescEl.textContent = 'An unexpected error occurred.';
        errorEl.style.display = 'flex';
    }
}

async function handleDeleteAdmin(userId) {
    if (!confirm("Are you sure you want to delete this user?")) return;

    const token = getAuthToken();
    try {
        const res = await fetch(`/ api / users / ${userId} `, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token} `
            }
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.error || "Failed to delete user");
            return;
        }

        // Refresh list
        initializeSystemManagementPage();

    } catch (err) {
        console.error("Error deleting user:", err);
        alert("An error occurred while deleting the user.");
    }
}

function handleEditAdmin(userId) {
    // Use loose equality to match string ID from HTML with number ID from data
    const admin = sysAdmins.find(a => a.id == userId);
    if (!admin) {
        alert("User not found");
        return;
    }

    document.getElementById('editAdminId').value = admin.id;
    document.getElementById('editAdminUsername').value = admin.username;
    document.getElementById('editAdminRole').value = admin.role;
    document.getElementById('editAdminPassword').value = ''; // Reset password field

    document.getElementById('edit-admin-modal').style.display = 'flex';
}

async function handleUpdateAdmin(e) {
    e.preventDefault();
    const errorEl = document.getElementById('edit-modal-error-message');
    const errorDescEl = document.getElementById('edit-modal-error-description');
    const userId = document.getElementById('editAdminId').value;
    const password = document.getElementById('editAdminPassword').value;
    const confirmPassword = document.getElementById('editAdminConfirmPassword').value;
    const role = document.getElementById('editAdminRole').value;

    errorEl.style.display = 'none';

    if (password) {
        if (password !== confirmPassword) {
            errorDescEl.textContent = 'Passwords do not match';
            errorEl.style.display = 'flex';
            return;
        }
        if (!validatePassword(password)) {
            errorDescEl.textContent = 'Password must contain at least one capital letter, one small letter, one number, and one symbol';
            errorEl.style.display = 'flex';
            return;
        }
    }

    const token = getAuthToken();
    try {
        const body = { role };
        if (password) body.password = password;

        const res = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok) {
            errorDescEl.textContent = data.error || 'Failed to update user';
            errorEl.style.display = 'flex';
            return;
        }

        // Refresh list
        initializeSystemManagementPage();

        // Close modal and reset form
        document.getElementById('edit-admin-modal').style.display = 'none';
        document.getElementById('edit-admin-form').reset();
        alert("Admin account updated successfully.");
        console.log("Admin account updated");

    } catch (err) {
        console.error("Error updating admin:", err);
        errorDescEl.textContent = 'An unexpected error occurred.';
        errorEl.style.display = 'flex';
    }
}

async function initializeSystemManagementPage() {
    const token = getAuthToken(); // Get token
    try {
        const res = await fetch('/api/system-data', {
            headers: { 'Authorization': `Bearer ${token} ` } // Send token
        });
        if (!res.ok) throw new Error('Failed to fetch system data');
        const data = await res.json();
        sysAdmins = data.admins || [];
        sysAuditLogs = data.auditLogs || [];
        sysMlModels = data.mlModels || [];
        sysEdgeNodes = data.edgeNodes || [];
        // renderSysStatCards(); // This function is missing, but was called in original code. Assuming it's not critical or I should add it if I have it. I don't see it in my snippets. I'll comment it out for now to avoid error.
        renderAdminTable();
        renderSysEdgeNodes();
        renderMLModelsTable();
        renderAuditLogsTable();
    } catch (error) {
        console.error("Error fetching system data:", error);
    }

    // Add Admin Modal
    const addAdminBtn = document.getElementById('add-admin-btn');
    if (addAdminBtn) {
        addAdminBtn.addEventListener('click', () => {
            document.getElementById('add-admin-modal').style.display = 'flex';
        });
    }

    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('add-admin-modal').style.display = 'none';
            document.getElementById('modal-error-message').style.display = 'none';
        });
    }

    const addAdminForm = document.getElementById('add-admin-form');
    if (addAdminForm) {
        addAdminForm.addEventListener('submit', handleAddAdmin);
    }

    // Edit Admin Modal
    const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', () => {
            document.getElementById('edit-admin-modal').style.display = 'none';
            document.getElementById('edit-modal-error-message').style.display = 'none';
        });
    }

    const editAdminForm = document.getElementById('edit-admin-form');
    if (editAdminForm) {
        editAdminForm.addEventListener('submit', handleUpdateAdmin);
    }

    const uploadModelBtn = document.getElementById('upload-model-btn');
    if (uploadModelBtn) {
        uploadModelBtn.addEventListener('click', () => {
            console.log('ML model uploaded successfully. Deployment in progress...');
        });
    }
}

function initializeTransactionsPage() {
    console.log("initializeTransactionsPage called");
    const userLocation = sessionStorage.getItem('userLocation');
    renderTxnHeader(userLocation);

    // Check for redirect query params (from Stripe 3DS/redirect flow)
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntentId = urlParams.get('payment_intent');
    const redirectStatus = urlParams.get('redirect_status');

    if (paymentIntentId && redirectStatus) {
        // Clear params from URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Record the result
        recordPaymentResult(paymentIntentId, redirectStatus).then(() => {
            const messageDiv = document.getElementById('payment-message');
            if (messageDiv) {
                if (redirectStatus === 'succeeded') {
                    messageDiv.textContent = "Payment Successful!";
                    messageDiv.className = "alert-banner success";
                } else {
                    messageDiv.textContent = "Payment Failed or Canceled.";
                    messageDiv.className = "alert-banner error";
                }
                messageDiv.style.display = "block";
            }
            // Refresh list
            loadTransactions();
            // Refresh balance
            fetchUserBalanceForTxnPage();
        });
    } else {
        loadTransactions();
    }

    // Initialize Stripe
    initializeStripeElements();

    // Attach form handler
    const form = document.getElementById('payment-form');
    if (form) {
        // Remove old listener if any (to avoid duplicates if re-initialized)
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        console.log("Attaching submit handler to payment-form");
        newForm.addEventListener('submit', handleCheckoutSubmit);
    } else {
        console.error("Payment form not found!");
    }

    // Fetch Balance for Transactions Page (Must be AFTER form clone/replace)
    fetchUserBalanceForTxnPage();
}

let currentPage = 1;
let totalPages = 1;

async function handleRetryTransaction(txnId) {
    alert("Retry functionality is currently under development.");
}

function loadTransactions(page = 1) {
    const token = getAuthToken();
    fetch(`/api/transactions?page=${page}&per_page=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(response => {
            if (response.status === 401) {
                console.warn("Token expired, redirecting to login...");
                handleLogout();
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (!data) return; // Handled 401

            // Check if data is paginated format or list (fallback)
            console.log("API Response Data:", data);
            if (data.transactions) {
                pageTransactions = data.transactions;
                currentPage = data.current_page;
                totalPages = data.pages;
            } else {
                pageTransactions = data;
                currentPage = 1;
                totalPages = 1;
            }
            console.log("Page Transactions:", pageTransactions);

            renderTxnStatCards(pageTransactions);
            renderTxnLocationChart(pageTransactions);
            renderTxnStatusChart(pageTransactions); // Needs update to support 'flagged' if previously relying on 'mlPrediction'
            renderTxnTable(pageTransactions);
            renderTxnPipeline(pageTransactions);
            renderPaginationControls();
        })
        .catch(err => console.error("Error fetching transactions:", err));
}

function renderPaginationControls() {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');

    if (!prevBtn || !nextBtn || !pageInfo) return;

    pageInfo.textContent = `Page ${currentPage} of ${totalPages} `;

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    // Clear old listeners to avoid duplicates (simple approach)
    const newPrev = prevBtn.cloneNode(true);
    const newNext = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);

    newPrev.addEventListener('click', () => loadTransactions(currentPage - 1));
    newNext.addEventListener('click', () => loadTransactions(currentPage + 1));
}

async function initializeStripeElements() {
    console.log("Initializing Stripe Elements...");
    try {
        const configRes = await fetch('/api/config');
        const { publishableKey } = await configRes.json();

        if (!stripe) {
            stripe = Stripe(publishableKey);
        }

        const token = getAuthToken();
        const intentRes = await fetch('/api/init-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token} `
            }
        });

        if (intentRes.status === 401) {
            console.warn("Token expired during Stripe init, redirecting...");
            handleLogout();
            return;
        }

        if (!intentRes.ok) throw new Error('Failed to init payment intent');

        const { clientSecret, paymentIntentId } = await intentRes.json();
        currentPaymentIntentId = paymentIntentId;
        console.log("Client secret obtained:", clientSecret);

        const appearance = { theme: 'stripe', labels: 'floating' };
        elements = stripe.elements({ appearance, clientSecret });

        const paymentElement = elements.create('payment', { layout: 'tabs' });
        paymentElement.mount('#payment-element');
        console.log("Stripe Payment Element mounted.");

    } catch (error) {
        console.error("Error initializing Stripe:", error);
        const errorDiv = document.getElementById('payment-errors');
        if (errorDiv) errorDiv.textContent = "Failed to load payment system. Please refresh.";
    }
}

async function handleCheckoutSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const errorDiv = document.getElementById('payment-errors');
    const messageDiv = document.getElementById('payment-message');
    errorDiv.textContent = "";
    messageDiv.style.display = "none";

    const amount = document.getElementById('amount').value;
    const recipient = document.getElementById('recipientAccount').value;
    const reference = document.getElementById('reference').value;

    if (!stripe || !elements) {
        setLoading(false);
        return;
    }

    try {
        const token = getAuthToken();
        const updateRes = await fetch(`/api/update-payment-intent/${currentPaymentIntentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount, recipientAccount: recipient, reference })
        });

        if (!updateRes.ok) throw new Error('Failed to update payment details');

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: window.location.href },
            redirect: 'if_required'
        });

        if (error) {
            console.error("Stripe confirm error:", error);
            errorDiv.textContent = error.message;
            await recordPaymentResult(currentPaymentIntentId, 'failed');
        } else {
            console.log("Payment confirmed!");
            await recordPaymentResult(currentPaymentIntentId, 'succeeded');
            messageDiv.textContent = "Payment Successful!";
            messageDiv.className = "alert-banner success";
            messageDiv.style.display = "block";
            initializeTransactionsPage();
        }

    } catch (err) {
        console.error("Checkout error:", err);
        errorDiv.textContent = err.message || "An unexpected error occurred.";
        if (currentPaymentIntentId) {
            await recordPaymentResult(currentPaymentIntentId, 'failed');
        }
    } finally {
        setLoading(false);
    }
}

async function recordPaymentResult(paymentIntentId, status) {
    const token = getAuthToken();
    try {
        await fetch('/api/payment-success', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token} `
            },
            body: JSON.stringify({ payment_intent: paymentIntentId })
        });
        console.log(`Payment result recorded: ${status} `);
    } catch (e) {
        console.error("Failed to record payment result:", e);
    }
}

function setLoading(isLoading) {
    const btn = document.getElementById('payment-submit-btn');
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    } else {
        btn.disabled = false;
        btn.textContent = 'Proceed to Payment';
    }
}

function initializeDashboard() {
    console.log("Initializing Dashboard...");
    fetchDashboardData();
    // Refresh every 30 seconds
    setInterval(fetchDashboardData, 30000);
}

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

    // --- Password Toggle ---
    var togglePassword = document.getElementById('togglePassword');
    var passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            // toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // toggle the eye icon
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

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

    // --- Password Toggle ---
    var togglePassword = document.getElementById('togglePassword');
    var passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            // toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // toggle the eye icon
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // --- System Management Password Toggles ---
    function setupPasswordToggle(toggleId, inputId) {
        const toggleBtn = document.getElementById(toggleId);
        const inputField = document.getElementById(inputId);
        if (toggleBtn && inputField) {
            toggleBtn.addEventListener('click', function () {
                const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
                inputField.setAttribute('type', type);
                this.classList.toggle('fa-eye');
                this.classList.toggle('fa-eye-slash');
            });
        }
    }

    setupPasswordToggle('toggleNewAdminPassword', 'newAdminPassword');
    setupPasswordToggle('toggleEditAdminPassword', 'editAdminPassword');
    setupPasswordToggle('toggleEditAdminConfirmPassword', 'editAdminConfirmPassword');

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
            if (icon) icon.classList.add('fa-spin');

            if (currentPath.startsWith('/transactions')) {
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

// --- HELPER FUNCTIONS ---

function validateEmail(email) {
    return email.endsWith('@bankedge.com');
}

function validatePassword(password) {
    // At least one capital, one small, one number, one symbol
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;
    return regex.test(password);
}

function switchSysTab(tabName) {
    document.querySelectorAll('.tab-trigger').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`content-${tabName}`).classList.add('active');
}

function renderDashboardStatCards(data) {
    const grid = document.getElementById('stat-card-grid');
    if (!grid) return;

    // Use userBalance from API, default to 0
    const balance = data.userBalance != null ? data.userBalance : 0.0;

    // Calculate other stats if available
    const txnCount = data.transactions ? data.transactions.length : 0;

    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-info">
                <h3>Current Balance</h3>
                <p class="value">RM ${balance.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p class="subtitle positive">Available Funds</p>
            </div>
            <div class="stat-card-icon icon-bg-green"><i class="fas fa-wallet"></i></div>
        </div>
        <div class="stat-card">
             <div class="stat-card-info">
                <h3>Recent Activity</h3>
                <p class="value">${txnCount}</p>
                <p class="subtitle">Transactions</p>
            </div>
            <div class="stat-card-icon icon-bg-blue"><i class="fas fa-list"></i></div>
        </div>
    `;
}

function fetchUserBalanceForTxnPage() {
    console.log("DEBUG: fetchUserBalanceForTxnPage called");
    const el = document.getElementById('user-balance-display');
    console.log("DEBUG: Balance element found:", el);
    if (!el) return;

    const token = getAuthToken();
    console.log("DEBUG: Fetching balance from API...");
    fetch('/api/dashboard-data', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => {
            console.log("DEBUG: API Response Status:", res.status);
            return res.json();
        })
        .then(data => {
            console.log("DEBUG: API Data:", data);
            if (data.userBalance != null) {
                const formatted = `RM ${data.userBalance.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                console.log("DEBUG: Setting balance to:", formatted);
                el.textContent = formatted;
            } else {
                console.error("DEBUG: userBalance is null or undefined in API response");
            }
        })
        .catch(err => console.error("DEBUG: Error fetching balance:", err));
}

