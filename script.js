// Auto-detect API URL. If on file://, fallback to a prompt or hardcoded dev URL
let API_URL = ""; 
if (window.location.protocol === "file:") {
    API_URL = "http://localhost:8080"; // Fallback for local testing
    console.warn("Website opened from local file. Using fallback API_URL: " + API_URL);
}

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

// --- Auth Utilities ---
function getToken() { return sessionStorage.getItem('klient_token'); }
function setToken(t) { sessionStorage.setItem('klient_token', t); }
function logout() { sessionStorage.removeItem('klient_token'); window.location.href = 'index.html'; }

// --- API Calls ---
async function apiCall(endpoint, method = "GET", body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const fullUrl = `${API_URL}${endpoint}`;
        console.log(`[API] Calling: ${method} ${fullUrl}`);
        const res = await fetch(fullUrl, options);
        if (!res.ok) {
            const text = await res.text();
            console.error(`[API] HTTP ${res.status} for ${fullUrl}:`, text.substring(0, 200));
            return { status: "error", message: `Server Error ${res.status}: ${text.substring(0, 50)}` };
        }
        return await res.json();
    } catch (e) {
        console.error("[API] Fetch Exception:", e);
        return { status: "error", message: `Failed to connect: ${e.message}` };
    }
}

// --- Login Page (index.html) ---
async function login() {
    const key = document.getElementById('licenseKey').value.trim();
    if (!key) return showToast("Please enter a license key.", "warning");

    const btn = document.querySelector('.login-form button');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Checking...";

    const res = await apiCall("/web/login", "POST", { key });
    
    if (res.status === "2fa_required") {
        btn.textContent = "Waiting for Discord...";
        showToast("2FA Required: Check your Discord DMs to confirm login.", "info", 8000);
        
        // Polling for 2FA status
        const pollInterval = setInterval(async () => {
            const pollRes = await apiCall(`/web/login_check?auth_id=${res.auth_id}`);
            if (pollRes.status === "success") {
                clearInterval(pollInterval);
                setToken(pollRes.token);
                showToast("Login confirmed!", "success");
                setTimeout(() => {
                    window.location.href = pollRes.role === "admin" ? "admin.html" : "panel.html";
                }, 1000);
            } else if (pollRes.status === "denied" || pollRes.status === "error") {
                clearInterval(pollInterval);
                showToast(pollRes.message || "2FA Failed", "error");
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }, 2000);
        
        // Timeout after 5 minutes
        setTimeout(() => {
            clearInterval(pollInterval);
            if (btn.disabled) {
                showToast("2FA Timed out.", "warning");
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }, 300000);

    } else if (res.status === "success") {
        setToken(res.token);
        window.location.href = res.role === "admin" ? "admin.html" : "panel.html";
    } else {
        btn.disabled = false;
        btn.textContent = originalText;
        showToast(res.message || "Invalid license key.", "error");
    }
}

// --- User Panel (panel.html) ---
function getTimeRemaining(expiryStr) {
    if (!expiryStr || expiryStr === "Never" || expiryStr === "N/A") return "Lifetime";
    
    let year, month, day;
    if (expiryStr.length === 8) {
        year = parseInt(expiryStr.substring(0, 4));
        month = parseInt(expiryStr.substring(4, 6)) - 1;
        day = parseInt(expiryStr.substring(6, 8));
    } else if (expiryStr.includes("-")) {
        const parts = expiryStr.split("-");
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        day = parseInt(parts[2]);
    } else return expiryStr;

    const expiryDate = new Date(year, month, day, 23, 59, 59);
    const now = new Date();
    const diff = expiryDate - now;

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
}

async function initUserPanel() {
    if (!getToken()) return logout();

    const res = await apiCall("/web/user");
    if (res.status === "error") return logout();

    document.getElementById('contentBox').style.display = "block";

    let displayExpiry = res.expiry || "Never";
    if (displayExpiry && displayExpiry.length === 8) {
        displayExpiry = `${displayExpiry.substring(0, 4)}-${displayExpiry.substring(4, 6)}-${displayExpiry.substring(6, 8)}`;
    }

    const timeRemaining = getTimeRemaining(res.expiry);

    if (document.getElementById('p_license')) document.getElementById('p_license').textContent = res.license || "----";
    if (document.getElementById('p_expiry')) {
        const el = document.getElementById('p_expiry');
        el.textContent = timeRemaining;
        el.className = "user-main"; // Base class
        if (timeRemaining === "Expired") el.classList.add("status-banned");
        else if (timeRemaining && timeRemaining.includes("d") && parseInt(timeRemaining) < 3) el.classList.add("status-suspended");
        else el.classList.add("status-active");
    }
    if (document.getElementById('p_hwid')) document.getElementById('p_hwid').textContent = res.hwid || "Not Linked";
    if (document.getElementById('p_discord')) document.getElementById('p_discord').textContent = res.discord_id || "Not Linked";

    if (timeRemaining === "Expired") {
        showToast("Your license has expired. Please get a new one.", "warning", 10000);
    }
}

async function downloadClient() {
    const res = await apiCall("/download/validate", "POST", { key: getToken() });
    if (res.status === "success" && res.url) {
        window.location.href = res.url;
    } else {
        showToast(`Download failed: ${res.message || "Unknown error"}`, "error");
    }
}

async function resetHWID_User() {
    const res = await apiCall("/web/reset_hwid", "POST");
    if (res.status === "success") {
        showToast("HWID reset successful.", "success");
        initUserPanel();
    } else {
        showToast(res.message || "Failed to reset HWID.", "error");
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
    document.querySelectorAll('.tab-pane').forEach(p => {
        p.style.display = p.id === 'tab-' + tab ? 'block' : 'none';
        p.classList.toggle('active', p.id === 'tab-' + tab);
    });
}

async function refreshAdminStats() {
    const res = await apiCall("/admin/stats");
    if (res.status === "success") {
        if (document.getElementById('a_users')) document.getElementById('a_users').textContent = res.total_users;
        if (document.getElementById('a_available')) document.getElementById('a_available').textContent = res.available_licenses ?? 0;
        if (document.getElementById('a_bans')) document.getElementById('a_bans').textContent = res.active_bans;
        if (document.getElementById('a_version')) document.getElementById('a_version').textContent = res.version;
    }
}

async function refreshUserList() {
    const res = await apiCall("/admin/users");
    if (res.status !== "success") return;

    // Keys tab
    const availableListEl = document.getElementById('adminAvailableList');
    if (availableListEl) {
        availableListEl.innerHTML = "";
        const available = res.available_licenses || [];
        if (available.length === 0) {
            availableListEl.innerHTML = "<p style='color: var(--text-secondary); font-size: 0.9rem;'>No available keys. Generate some in the Create section above.</p>";
        } else {
            for (const row of available) {
                let expiryStr = row.expiry || "";
                if (expiryStr.length === 8) {
                    expiryStr = `${expiryStr.substring(0, 4)}-${expiryStr.substring(4, 6)}-${expiryStr.substring(6, 8)}`;
                }
                const div = document.createElement("div");
                div.className = "user-item";
                div.innerHTML = `
                    <div class="user-info">
                        <span class="user-main" style="font-family: monospace;">${row.license}</span>
                        <span class="user-sub">Expires: ${expiryStr}</span>
                    </div>
                    <button type="button" class="btn-primary btn-sm btn-danger" onclick="deleteAvailableLicense('${String(row.id).replace(/'/g, "\\'")}')" style="width: auto; margin: 0;">Delete</button>
                `;
                availableListEl.appendChild(div);
            }
        }
    }

    // Userbase tab
    const userListEl = document.getElementById('adminUserList');
    if (userListEl) {
        userListEl.innerHTML = "";
        const users = res.users || {};
        const banned = res.banned || [];

        if (Object.keys(users).length === 0) {
            userListEl.innerHTML = "<p style='color: var(--text-secondary); font-size: 0.9rem;'>No active users recorded.</p>";
        } else {
            // Header for userbase
            const header = document.createElement("div");
            header.className = "user-item";
            header.style.background = "var(--bg-card)";
            header.style.fontWeight = "700";
            header.style.fontSize = "0.75rem";
            header.style.textTransform = "uppercase";
            header.style.color = "var(--text-secondary)";
            header.innerHTML = `
                <div style="flex: 2;">User / ID</div>
                <div style="flex: 2;">License / HWID</div>
                <div style="flex: 1; text-align: center;">Time Left</div>
                <div style="flex: 1.5; text-align: center;">Last IP</div>
                <div style="flex: 2; text-align: right;">Actions</div>
            `;
            userListEl.appendChild(header);

            for (const [id, data] of Object.entries(users)) {
                let isBanned = banned.includes(data.hwid);
                let isSuspended = data.status === "suspended";
                
                const timeRemaining = getTimeRemaining(data.expiry);
                let statusBadge = isBanned ? "Banned" : (isSuspended ? "Suspended" : (timeRemaining === "Expired" ? "Expired" : "Active"));

                let statusClass = "user-sub";
                if (isBanned || timeRemaining === "Expired") statusClass += " status-banned";
                else if (isSuspended) statusClass += " status-suspended";
                else statusClass += " status-active";

                const item = document.createElement("div");
                item.className = "user-item";
                item.style.gap = "1rem";
                item.innerHTML = `
                    <div style="flex: 2; display: flex; flex-direction: column; gap: 4px; overflow: hidden;">
                        <span class="user-main" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.username || "Unknown"}</span>
                        <span class="user-sub" style="font-size: 0.7rem; opacity: 0.6;">${id}</span>
                    </div>
                    <div style="flex: 2; display: flex; flex-direction: column; gap: 4px; overflow: hidden;">
                        <span class="user-sub" style="font-family: monospace; color: var(--text-primary);">${data.license || "None"}</span>
                        <span class="user-sub" style="font-size: 0.65rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.hwid}</span>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <span class="${statusClass}" style="font-size: 0.75rem;">${timeRemaining}</span>
                    </div>
                    <div style="flex: 1.5; text-align: center;">
                        <span class="user-sub" style="font-size: 0.75rem; font-family: monospace;">${data.ip || "N/A"}</span>
                    </div>
                    <div style="flex: 2; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
                        <button class="btn-primary btn-sm btn-action-small" onclick="giveLicense('${esc(id)}')" title="Give License">Give</button>
                        <button class="btn-primary btn-sm btn-action-small btn-danger" onclick="takeLicense('${esc(id)}')" title="Take License">Take</button>
                        <button class="btn-primary btn-sm btn-action-small" onclick="takeAction('reset', '${esc(id)}')" title="Reset HWID">Reset</button>
                        <button class="btn-primary btn-sm btn-action-small" onclick="takeAction('unban', '${esc(data.hwid)}')" title="Unban">Unban</button>
                        <button class="btn-primary btn-sm btn-action-small btn-danger" onclick="takeAction('ban', '${esc(data.hwid)}')" title="Ban">Ban</button>
                        <button class="btn-primary btn-sm btn-action-small btn-danger" onclick="takeAction('wipe', '${esc(id)}')" title="Wipe User">Wipe</button>
                    </div>
                `;
                userListEl.appendChild(item);
            }
        }
    }
}

const _adminState = {
    target: null,
    licenseTarget: null
};

function esc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function openGiveLicenseModal(userId) {
    _adminState.licenseTarget = userId;
    const modal = document.getElementById("give-license-modal");
    if (modal) {
        modal.classList.add("show");
        modal.style.display = "flex";
    }
}

function closeGiveLicenseModal() {
    _adminState.licenseTarget = null;
    const modal = document.getElementById("give-license-modal");
    if (modal) {
        modal.classList.remove("show");
        modal.style.display = "none";
    }
}

async function takeAction(action, targetOverride, extra) {
    let target = targetOverride || _adminState.target || document.getElementById("manageTarget")?.value?.trim();
    if (!target) return showToast("No target user selected.", "warning");

    const body = { action, target };
    if (extra && typeof extra === 'object') Object.assign(body, extra);

    console.log(`[Admin] Action: ${action}`, body);
    const res = await apiCall("/admin/action", "POST", body);

    if (res.status === "success") {
        if (res.license) {
            showToast(`${res.message}\n\nKey: ${res.license}\nExpires: ${res.expiry}`, "success", 7000);
        } else {
            showToast(res.message || "Action successful", "success");
        }
        refreshAdminStats();
        refreshUserList();
    } else {
        showToast(res.message || "Action failed", "error");
    }
}

function giveLicense(uId) {
    _adminState.target = uId;
    openGiveLicenseModal(uId);
}

function takeLicense(uId) {
    takeAction("take_license", uId);
}

async function confirmGiveLicense() {
    const target = _adminState.licenseTarget || _adminState.target;
    if (!target) {
        showToast("Missing target user context.", "error");
        return closeGiveLicenseModal();
    }
    const days = parseInt(document.getElementById("giveLicenseDays")?.value || "30", 10);
    const prefix = document.getElementById("giveLicensePrefix")?.value || "";
    closeGiveLicenseModal();
    await takeAction("give_license", target, { days, prefix });
}

function resetHWID(uId) {
    takeAction("reset", uId);
}

function deleteAvailableLicense(recordId) {
    takeAction("wipe", recordId);
}

function filterUsers() {
    const input = document.getElementById('userSearch').value.toLowerCase();
    const items = document.querySelectorAll('#adminUserList .user-item');
    items.forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(input) ? "flex" : "none";
    });
}

async function generateLicense() {
    const days = parseInt(document.getElementById('genDays').value || "30", 10);
    const prefix = document.getElementById('genPrefix').value || "";
    const res = await apiCall("/admin/create_license", "POST", { days, prefix });
    if (res.status === "success") {
        showToast(`Created: ${res.license}`, "success", 7000);
        refreshAdminStats();
        refreshUserList();
    } else showToast(res.message || "Failure.", "error");
}

async function updateProduct() {
    const version = document.getElementById('updateVersion').value.trim();
    const url = document.getElementById('updateUrl').value.trim();
    if (!version) return showToast("Version tag is required.", "warning");
    const res = await apiCall("/admin/publish", "POST", { version, url });
    if (res.status === "success") {
        showToast("Configuration deployed!", "success");
        refreshAdminStats();
    } else showToast(res.message || "Error", "error");
}

async function uploadUpdate() {
    const fileInput = document.getElementById('updateFile');
    if (!fileInput.files.length) return showToast("Select a file first.", "warning");

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    showToast("Uploading...", "info", 2000);
    
    try {
        const response = await fetch(`${API_URL}/admin/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const res = await response.json();
        if (res.status === "success") {
            document.getElementById('updateUrl').value = res.url;
            showToast("Success! URL mapped.", "success");
        } else {
            showToast(res.message || "Upload failed.", "error");
        }
    } catch (e) {
        showToast("Connection error.", "error");
    }
}