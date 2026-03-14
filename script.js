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
async function initUserPanel() {
    if (!getToken()) return logout();

    const res = await apiCall("/web/user");
    if (res.status === "error") return logout();

    document.getElementById('contentBox').style.display = "block";

    let expiryStr = res.expiry || "Never";
    if (expiryStr && expiryStr.length === 8) {
        expiryStr = `${expiryStr.substring(0, 4)}-${expiryStr.substring(4, 6)}-${expiryStr.substring(6, 8)}`;
    }

    if (document.getElementById('p_license')) document.getElementById('p_license').textContent = res.license || "----";
    if (document.getElementById('p_expiry')) document.getElementById('p_expiry').textContent = expiryStr;
    if (document.getElementById('p_hwid')) document.getElementById('p_hwid').textContent = res.hwid || "Not Linked";
    if (document.getElementById('p_discord')) document.getElementById('p_discord').textContent = res.discord_id || "Not Linked";
}

async function downloadClient() {
    const res = await apiCall("/download/validate", "POST", { key: getToken() });
    if (res.status === "success" && res.url) {
        window.location.href = res.url;
    } else {
        showToast(`Download failed: ${res.message || "Unknown error"}`, "error");
    }
}

async function resetHWID() {
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
            for (const [id, data] of Object.entries(users)) {
                let isBanned = banned.includes(data.hwid);
                let isSuspended = data.status === "suspended";
                let statusBadge = isBanned ? "Banned" : (isSuspended ? "Suspended" : (data.status || "Active"));
                
                let statusClass = "user-sub";
                if (isBanned) statusClass += " status-banned";
                else if (isSuspended) statusClass += " status-suspended";
                else if (statusBadge === "Active") statusClass += " status-active";

                const item = document.createElement("div");
                item.className = "user-item";
                item.style.flexDirection = "column";
                item.style.alignItems = "stretch";
                item.style.gap = "0.75rem";
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="user-info">
                            <span class="user-main">${data.username || "Unknown Entity"}</span>
                            <span class="${statusClass}">${statusBadge}</span>
                        </div>
                        <span class="user-sub" style="font-size: 0.75rem;">${id}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.75rem;">
                        <div class="user-info"><span class="user-sub">HWID</span><span style="font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${data.hwid}</span></div>
                        <div class="user-info"><span class="user-sub">License</span><span style="font-family: monospace;">${data.license || "None"}</span></div>
                    </div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                        <button class="btn-primary btn-sm" onclick="giveLicense('${esc(id)}')" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.75rem;">Give</button>
                        <button class="btn-primary btn-sm" onclick="takeLicense('${esc(id)}')" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.75rem;">Take</button>
                        <button class="btn-primary btn-sm" onclick="takeAction('reset', '${esc(id)}')" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.75rem;">Reset</button>
                        <button class="btn-primary btn-sm btn-glow-yellow" onclick="takeAction('suspend', '${esc(id)}')" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.75rem;">Suspend</button>
                        <button class="btn-primary btn-sm btn-glow-green" onclick="takeAction('unsuspend', '${esc(id)}')" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.75rem;">Unsuspend</button>
                        <button class="btn-primary btn-sm btn-glow-green" onclick="takeAction('unban', '${esc(data.hwid)}')" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.75rem;">Unban</button>
                        <button class="btn-primary btn-sm btn-danger" onclick="takeAction('ban', '${esc(data.hwid)}')" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.75rem;">Ban</button>
                        <button class="btn-primary btn-sm btn-danger" onclick="takeAction('wipe', '${esc(id)}')" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.75rem;">Wipe</button>
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
    const prefix = document.getElementById("giveLicensePrefix")?.value || "UG";
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
    const prefix = document.getElementById('genPrefix').value || "UG";
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
    if (!version && !url) return showToast("Empty fields.", "warning");
    const res = await apiCall("/admin/publish", "POST", { version, url });
    if (res.status === "success") {
        showToast("Published.", "success");
        refreshAdminStats();
    } else showToast(res.message || "Error", "error");
}