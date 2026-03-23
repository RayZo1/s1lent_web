const bridge = window.chrome?.webview?.hostObjects?.bridge;

// Force the same API URL as the website
const API_URL = "https://xx.e.jrnm.app";

function showToast(msg, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
    }, 4000);
}

async function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const target = document.getElementById(screenId);
    if (!target) return;
    target.style.display = (screenId === 'login-screen') ? 'flex' : 'block';
    if(screenId === 'loader-screen') target.style.display = 'flex';
    
    setTimeout(() => target.classList.add('active'), 10);
}

async function startLoginTransition() {
    await showScreen('loader-screen');
    const texts = ["Initializing API...", "Loading Modules...", "Parsing Database...", "Finalizing UI..."];
    const textEl = document.querySelector('.loader-text');
    for (const t of texts) {
        if (textEl) textEl.textContent = t;
        await new Promise(r => setTimeout(r, 700));
    }
    await showScreen('main-menu');
    if(window.lucide) lucide.createIcons();
}

function minimizeWindow() { bridge?.MinimizeWindow(); }
function exitWindow() { bridge?.CloseWindow(); }

async function apiCall(endpoint, method = "GET", body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const fullUrl = `${API_URL}/api${endpoint}`;
        const res = await fetch(fullUrl, options);
        let data;
        try { data = await res.json(); } catch(e) { data = null; }

        if (!res.ok) {
            const msg = (data && data.message) ? data.message : `Error ${res.status}`;
            return { status: "error", message: msg };
        }
        return data;
    } catch (e) {
        return { status: "error", message: "Network error. Please try again." };
    }
}

async function handleLogin() {
    const key = document.getElementById('licenseKey').value.trim();
    if (!key) return showToast("Enter your license key", "error");

    const btn = document.querySelector('.btn-primary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Checking...";

    const res = await apiCall("/login", "POST", { key });
    
    if (res.status === "2fa_required") {
        btn.textContent = "Wait for Discord...";
        showToast("Check your Discord DMs to confirm login.", "info");
        
        const pollInterval = setInterval(async () => {
            const pollRes = await apiCall(`/login_check?auth_id=${res.auth_id}`);
            if (pollRes.status === "success") {
                clearInterval(pollInterval);
                showToast("Login confirmed!", "success");
                await startLoginTransition();
            } else if (pollRes.status === "denied" || pollRes.status === "error") {
                clearInterval(pollInterval);
                showToast(pollRes.message || "2FA Failed", "error");
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }, 2000);
        
        setTimeout(() => {
            clearInterval(pollInterval);
            if (btn.disabled && btn.textContent.includes("Discord")) {
                showToast("2FA Timed out.", "error");
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }, 300000);

    } else if (res.status === "success") {
        showToast("Authenticated", "success");
        await startLoginTransition();
    } else {
        showToast(res.message || "Invalid License", "error");
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Config State Management
let configState = {
    "prediction": 0.0,
    "hitchance": 100,
    "fov": 180,
    "priority": "Closest"
};

function updateVal(name, val) {
    configState[name] = val;
    const valDisplay = document.getElementById(`${name}-val`);
    if (valDisplay) {
        valDisplay.style.opacity = '0.5';
        setTimeout(() => {
            valDisplay.textContent = val;
            valDisplay.style.opacity = '1';
        }, 50);
    }
}

async function applyUpdate() {
    const btn = document.querySelector('.btn-update');
    const span = btn.querySelector('span');
    const icon = btn.querySelector('i');
    
    btn.style.pointerEvents = 'none';
    if (icon) icon.classList.add('spin-anim');
    if (span) span.textContent = "UPDATING...";

    try {
        if (bridge) {
            // Convert to JSON for C# storage
            const jsonStr = JSON.stringify(configState, null, 4);
            await bridge.InvokeSaveConfig(jsonStr);
            showToast("Sync Successful", "success");
        } else {
            console.log("[Bridge Demo] Saving:", configState);
            await new Promise(r => setTimeout(r, 800));
            showToast("Simulated Sync (No Bridge)", "info");
        }
    } catch (e) {
        showToast("Update Failed: " + e.message, "error");
    } finally {
        btn.style.pointerEvents = 'all';
        if (icon) icon.classList.remove('spin-anim');
        if (span) span.textContent = "UPDATE";
    }
}

function resetDefaults() {
    configState = { "prediction": 0.0, "hitchance": 100, "fov": 180, "priority": "Closest" };
    document.getElementById('prediction').value = 0.0;
    document.getElementById('prediction-val').textContent = "0.000";
    document.getElementById('hitchance').value = 100;
    document.getElementById('hitchance-val').textContent = "100%";
    document.getElementById('fov').value = 180;
    document.getElementById('fov-val').textContent = "180";
    document.getElementById('target-priority').value = "Closest";
    showToast("Values Restored", "info");
}

function switchCategory(category) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${category}'`)) {
            item.classList.add('active');
        }
    });
    // This would swap display of content panels in a larger app
}
