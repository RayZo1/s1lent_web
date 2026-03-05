const API_URL = "https://xx.e.jrnm.app";

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
    if (!key) return alert("Please enter a license key.");

    const res = await apiCall("/web/login", "POST", { key });
    if (res.status === "success") {
        setToken(res.token);
        window.location.href = res.role === "admin" ? "admin.html" : "panel.html";
    } else {
        alert(res.message || "Invalid license key.");
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
        alert(`Download failed: ${res.status}`);
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

async function refreshAdminStats() {
    const res = await apiCall("/admin/stats");
    if (res.status === "success") {
        document.getElementById('a_users').textContent = res.total_users;
        document.getElementById('a_bans').textContent = res.active_bans;
        document.getElementById('a_version').textContent = res.version;
    }
}

async function refreshUserList() {
    const res = await apiCall("/admin/users");
    const container = document.getElementById('adminUserList');
    if (res.status !== "success" || !container) return;

    container.innerHTML = "";

    const users = res.users;
    const banned = res.banned || [];

    if (Object.keys(users).length === 0) {
        container.innerHTML = "<p>No users found.</p>";
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
            <div class="btn-grid">
                <button class="btn warning-btn sm-btn" onclick="quickAction('reset', '${id}')">Reset HWID</button>
                <button class="btn danger-btn sm-btn" onclick="quickAction('wipe', '${id}')">Wipe</button>
                <button class="btn danger-btn sm-btn outline" onclick="quickAction('suspend', '${id}')">Suspend</button>
                <button class="btn primary-btn sm-btn outline" onclick="quickAction('unsuspend', '${id}')">Unsuspend</button>
                <button class="btn danger-btn sm-btn" onclick="quickAction('ban', '${data.hwid}')" style="grid-column: span 2;">Ban HWID</button>
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
    document.getElementById('manageTarget').value = target;
    await takeAction(action);
}

async function generateLicense() {
    const days = document.getElementById('genDays').value || 30;
    const prefix = document.getElementById('genPrefix').value || "UG";

    const res = await apiCall("/admin/create_license", "POST", { days, prefix });
    if (res.status === "success") {
        alert(`Created License:\n\n${res.license}\n\nExpiry: ${res.expiry}`);
        refreshAdminStats();
    } else {
        alert("Failed to generate license.");
    }
}

async function takeAction(action) {
    const target = document.getElementById('manageTarget').value.trim();
    if (!target) return alert("Provide a HWID or Discord ID.");

    const res = await apiCall("/admin/action", "POST", { action, target });
    if (res.status === "success") {
        alert(res.message);
        refreshAdminStats();
        refreshUserList();
    } else {
        alert(res.message || "Action failed.");
    }
}

async function updateProduct() {
    const version = document.getElementById('updateVersion').value.trim();
    const url = document.getElementById('updateUrl').value.trim();

    if (!version && !url) return alert("Provide version or URL to update.");

    const res = await apiCall("/admin/publish", "POST", { version, url });
    if (res.status === "success") {
        alert("Product updated successfully.");
        refreshAdminStats();
    }
}
