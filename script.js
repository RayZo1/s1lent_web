const API_URL = "https://xx.e.jrnm.app";

// --- Custom Toast Notifications ---
function showToast(msg, type = "info", duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = { success: "✓", error: "✕", warning: "⚠", info: "◆" };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || "◆"}</span><span class="toast-msg">${msg}</span>`;

    toast.onclick = () => dismiss();
    container.appendChild(toast);

    const dismiss = () => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 350);
    };
    setTimeout(dismiss, duration);
}

// --- Background Effects ---
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 100 + 20;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${Math.random() * 100}vw`;
        p.style.top = `${Math.random() * 100}vh`;
        p.style.animationDuration = `${Math.random() * 20 + 10}s`;
        p.style.animationDelay = `${Math.random() * 5}s`;
        container.appendChild(p);
    }
}
window.addEventListener('DOMContentLoaded', initParticles);

// --- Auth Utilities ---
function getToken() { return sessionStorage.getItem('ug_token'); }
function setToken(t) { sessionStorage.setItem('ug_token', t); }
function logout() { sessionStorage.removeItem('ug_token'); window.location.href = 'index.html'; }

// --- API Calls ---
async function apiCall(endpoint, method = "GET", body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(`${API_URL}${endpoint}`, options);
        return await res.json();
    } catch (e) {
        console.error("API Error", e);
        return { status: "error", message: "Failed to connect to backend" };
    }
}

// --- Login Page (index.html) ---
async function login() {
    const key = document.getElementById('licenseKey').value.trim();
    if (!key) return showToast("Please enter a license key.", "warning");

    const res = await apiCall("/web/login", "POST", { key });
    if (res.status === "success") {
        setToken(res.token);
        window.location.href = res.role === "admin" ? "admin.html" : "panel.html";
    } else {
        showToast(res.message || "Invalid license key.", "error");
    }
}

// --- User Panel (panel.html) ---
let downloadUrl = "";
async function initUserPanel() {
    if (!getToken()) return logout();

    const res = await apiCall("/web/user");
    if (res.status === "error") return logout();

    document.getElementById('contentBox').style.display = "block";

    // YYYYMMDD to Date String
    let expiryStr = res.expiry;
    if (expiryStr && expiryStr.length === 8) {
        expiryStr = `${expiryStr.substring(0, 4)}-${expiryStr.substring(4, 6)}-${expiryStr.substring(6, 8)}`;
    }

    document.getElementById('u_status').textContent = res.status_code.toUpperCase();
    document.getElementById('u_expiry').textContent = expiryStr;
    document.getElementById('u_hwid').textContent = res.hwid;
    document.getElementById('u_discord').textContent = res.discord_id;
    downloadUrl = res.download_url;
}

async function downloadProduct() {
    const res = await apiCall("/download/validate", "POST", { key: getToken() });
    if (res.status === "success" && res.url) {
        window.location.href = res.url;
    } else {
        showToast(`Download failed: ${res.status}`, "error");
    }
}

// --- Admin Panel (admin.html) ---
async function initAdminPanel() {
    if (!getToken()) return logout();

    const res = await apiCall("/admin/stats");
    if (res.status === "unauthorized") return logout();

    document.getElementById('contentBox').style.display = "block";
    refreshAdminStats();
    refreshUserList();
}

function switchAdminTab(tab) {
    document.querySelectorAll('.list-tabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.list-card .tab-pane').forEach(p => {
        p.classList.toggle('active', p.id === 'tab-' + tab);
        p.style.display = p.id === 'tab-' + tab ? 'block' : 'none';
    });
}

async function refreshAdminStats() {
    const res = await apiCall("/admin/stats");
    if (res.status === "success") {
        document.getElementById('a_users').textContent = res.total_users;
        const aAvailable = document.getElementById('a_available');
        if (aAvailable) aAvailable.textContent = res.available_licenses ?? 0;
        document.getElementById('a_bans').textContent = res.active_bans;
        document.getElementById('a_version').textContent = res.version;
    }
}

async function refreshUserList() {
    const res = await apiCall("/admin/users");
    const userListEl = document.getElementById('adminUserList');
    const availableListEl = document.getElementById('adminAvailableList');
    if (res.status !== "success") return;

    // Available Licenses tab
    if (availableListEl) {
        availableListEl.innerHTML = "";
        const available = res.available_licenses || [];
        if (available.length === 0) {
            availableListEl.innerHTML = "<p>No available licenses. Generate some in the Create section above.</p>";
        } else {
            for (const row of available) {
                let expiryStr = row.expiry || "";
                if (expiryStr.length === 8) {
                    expiryStr = `${expiryStr.substring(0, 4)}-${expiryStr.substring(4, 6)}-${expiryStr.substring(6, 8)}`;
                }
                const div = document.createElement("div");
                div.className = "license-row";
                div.innerHTML = `
                    <span class="code-text">${row.license}</span>
                    <span class="code-text">Expires: ${expiryStr}</span>
                `;
                availableListEl.appendChild(div);
            }
        }
    }

    // Users tab
    if (!userListEl) return;
    userListEl.innerHTML = "";
    const users = res.users || {};
    const banned = res.banned || [];

    if (Object.keys(users).length === 0) {
        userListEl.innerHTML = "<p>No users yet. Once someone links and uses a license, they appear here.</p>";
        return;
    }

    for (const [id, data] of Object.entries(users)) {
        let isBanned = banned.includes(data.hwid);
        let displayStatus = isBanned ? "banned" : data.status;

        let item = document.createElement("div");
        item.className = "user-item";

        // Header
        let header = document.createElement("div");
        header.className = "user-header";
        header.innerHTML = `
            <span class="username">${data.username || "Unknown"}</span>
            <span class="status ${displayStatus}">${displayStatus}</span>
        `;

        // Details
        let details = document.createElement("div");
        details.className = "user-details";
        details.innerHTML = `
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Discord ID</span>
                    <span class="code-text">${id}</span>
                </div>
                <div class="info-item">
                    <span class="label">HWID</span>
                    <span class="code-text" style="font-size: 0.8rem;">${data.hwid}</span>
                </div>
                <div class="info-item">
                    <span class="label">License Key</span>
                    <span class="code-text">${data.license || "None"}</span>
                </div>
                <div class="info-item">
                    <span class="label">Expiry</span>
                    <span class="code-text">${data.expiry}</span>
                </div>
            </div>
            <div class="btn-grid" style="grid-template-columns: 1fr 1fr 1fr;">
                <button class="btn warning-btn sm-btn" onclick="quickAction('reset', '${id}')">Reset HWID</button>
                <button class="btn danger-btn sm-btn" onclick="quickAction('wipe', '${id}')">Wipe</button>
                <button class="btn danger-btn sm-btn outline" onclick="quickAction('suspend', '${id}')">Suspend</button>
                <button class="btn primary-btn sm-btn outline" onclick="quickAction('unsuspend', '${id}')">Unsuspend</button>
                <button class="btn danger-btn sm-btn" onclick="quickAction('ban', '${data.hwid}')">Ban HWID</button>
                <button class="btn success-btn sm-btn" onclick="quickAction('unban', '${data.hwid}')" style="background: var(--success); color: white;">Unban HWID</button>
            </div>
        `;

        header.onclick = () => {
            details.classList.toggle("show");
        };

        item.appendChild(header);
        item.appendChild(details);
        container.appendChild(item);
    }
}

async function quickAction(action, target) {
    await takeAction(action, target);
}

function filterUsers() {
    const input = document.getElementById('userSearch').value.toLowerCase();
    const list = document.getElementById('adminUserList');
    const items = list.getElementsByClassName('user-item');

    for (let i = 0; i < items.length; i++) {
        const textContent = items[i].textContent.toLowerCase();
        if (textContent.includes(input)) {
            items[i].style.display = "";
        } else {
            items[i].style.display = "none";
        }
    }
}

async function generateLicense() {
    const days = document.getElementById('genDays').value || 30;
    const prefix = document.getElementById('genPrefix').value || "UG";
    const isAdmin = document.getElementById('genIsAdmin').checked;

    let body = { days, prefix };
    if (isAdmin) {
        body.target_id = "admin";
    }

    const res = await apiCall("/admin/create_license", "POST", body);
    if (res.status === "success") {
        showToast(`License created!\n\n${res.license}\n\nExpires: ${res.expiry}`, "success", 7000);
        document.getElementById('genIsAdmin').checked = false;
        refreshAdminStats();
        refreshUserList();
    } else {
        showToast("Failed to generate license.", "error");
    }
}

async function takeAction(action, targetFromButton) {
    const target = targetFromButton != null ? targetFromButton : (document.getElementById('manageTarget')?.value?.trim() || "");
    if (!target) return showToast("Provide a HWID or Discord ID.", "warning");

    const body = { action, target };
    const res = await apiCall("/admin/action", "POST", body);
    if (res.status === "success") {
        showToast(res.message, "success");
        refreshAdminStats();
        refreshUserList();
    } else {
        showToast(res.message || "Action failed.", "error");
    }
}

async function updateProduct() {
    const version = document.getElementById('updateVersion').value.trim();
    const url = document.getElementById('updateUrl').value.trim();

    if (!version && !url) return showToast("Provide version or URL to update.", "warning");

    const res = await apiCall("/admin/publish", "POST", { version, url });
    if (res.status === "success") {
        showToast("Product updated successfully.", "success");
        refreshAdminStats();
    }
}
