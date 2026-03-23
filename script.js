// WebView2 Bridge Reference
const bridge = window.chrome?.webview?.hostObjects?.bridge;

// --- Toast Notifications ---
function showToast(msg, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Screen Management ---
async function showScreen(screenId, animate = false) {
    const current = document.querySelector('.screen.active');
    const target = document.getElementById(screenId);

    if (animate && current) {
        current.classList.add('screen-exit');
        await new Promise(r => setTimeout(r, 450));
        current.classList.remove('active', 'screen-exit');
        
        target.classList.add('active', 'screen-enter');
        await new Promise(r => setTimeout(r, 550));
        target.classList.remove('screen-enter');
    } else {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'screen-exit', 'screen-enter'));
        target.classList.add('active');
    }
}

async function startLoginTransition() {
    // Show Loader
    await showScreen('loader-screen', true);
    
    // Simulate loading work
    const texts = ["Initializing Modules", "Loading Configuration", "Injecting Hooks", "Ready"];
    const textEl = document.querySelector('.loader-text');
    for (const t of texts) {
        textEl.textContent = t;
        await new Promise(r => setTimeout(r, 600));
    }

    // Switch to Main Menu
    await showScreen('main-menu', true);
    if(window.lucide) lucide.createIcons();
}

function minimizeWindow() {
    bridge?.MinimizeWindow();
}

function exitWindow() {
    bridge?.CloseWindow();
}

// --- Login Logic ---
async function handleLogin() {
    const key = document.getElementById('licenseKey').value.trim();
    if (!key) return showToast("Enter your license key", "error");

    const btn = document.querySelector('.btn-primary');
    btn.disabled = true;
    btn.textContent = "VERIFYING...";

    try {
        if (!bridge) {
            // Development/Fallback
            console.warn("Bridge not found, simulating success");
            setTimeout(async () => {
                showToast("Connected!", "success");
                await startLoginTransition();
            }, 1000);
            return;
        }

        const res = await bridge.Login(key);
        if (res === "success") {
            showToast("Authenticated", "success");
            await startLoginTransition();
        } else {
            showToast(res || "Invalid License", "error");
            btn.disabled = false;
            btn.textContent = "SIGN IN";
        }
    } catch (e) {
        showToast("Bridge Error: " + e.message, "error");
        btn.disabled = false;
        btn.textContent = "SIGN IN";
    }
}

// --- Sidebar & Navigation ---
function switchCategory(category) {
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(`'${category}'`)) {
            item.classList.add('active');
        }
    });

    // Update Tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        if (tab.dataset.category === category) {
            tab.style.display = 'block';
        } else {
            tab.style.display = 'none';
        }
    });

    // Default first tab of category
    const firstTab = Array.from(tabs).find(t => t.dataset.category === category);
    if (firstTab) switchTab(firstTab.textContent, category);
}

function switchTab(tabName, category) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => {
        if (t.textContent === tabName && t.dataset.category === category) {
            t.classList.add('active');
        }
    });

    // Update Settings Grid (filtered by category and tab)
    // In a real app, this would hide/show specific settings-groups
}

// --- Config State ---
let configState = {
    "prediction": 0.0,
    "hitchance": 100,
    "fov": 180,
    "smooth": 1.0,
    "hit-position": "Closest Point"
};

function updateVal(name, val) {
    configState[name] = val;
    const valDisplay = document.getElementById(`${name}-val`);
    if (valDisplay) {
        if (typeof val === 'string' && val.endsWith('%')) {
            valDisplay.textContent = val;
        } else {
            const numVal = parseFloat(val);
            valDisplay.textContent = isNaN(numVal) ? val : numVal.toFixed(name === 'prediction' ? 3 : 1);
        }
    }
    // No more automatic bridge call to prevent lag
}

async function applyUpdate() {
    const btn = document.querySelector('.btn-update');
    btn.style.pointerEvents = 'none';
    btn.querySelector('i').classList.add('spin-anim'); // We can add this CSS if needed, or just change text
    btn.querySelector('span').textContent = "UPDATING...";

    try {
        if (bridge) {
            await bridge.InvokeSaveConfig(JSON.stringify(configState, null, 4));
            showToast("Configuration Synced", "success");
        } else {
            console.log("Simulated Update:", configState);
            await new Promise(r => setTimeout(r, 500));
            showToast("Simulated Sync", "success");
        }
    } catch (e) {
        showToast("Update Failed: " + e.message, "error");
    } finally {
        btn.style.pointerEvents = 'all';
        btn.querySelector('span').textContent = "UPDATE";
    }
}

async function saveConfig() {
    try {
        if (bridge) {
            await bridge.InvokeSaveConfig(JSON.stringify(configState, null, 4));
            showToast("Config Saved", "success");
        }
    } catch (e) {
        showToast("Save Failed: " + e.message, "error");
    }
}

async function loadConfig() {
    try {
        if (bridge) {
            const configJson = await bridge.InvokeLoadConfig();
            if (!configJson) return;
            
            configState = JSON.parse(configJson);
            
            // Sync UI
            Object.keys(configState).forEach(key => {
                const val = configState[key];
                const input = document.querySelector(`[oninput*="'${key}'"]`);
                const select = document.querySelector(`[onchange*="'${key}'"]`);
                
                if (input) input.value = val.toString().replace('%', '');
                if (select) select.value = val;
                
                const valDisplay = document.getElementById(`${key}-val`);
                if (valDisplay) valDisplay.textContent = val;
            });

            showToast("Config Loaded", "success");
        }
    } catch (e) {
        showToast("Load Failed: " + e.message, "error");
    }
}

// Initial category
document.addEventListener('DOMContentLoaded', () => {
    switchCategory('assistance');
});