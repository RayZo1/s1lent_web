const bridge = window.chrome?.webview?.hostObjects?.bridge;

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

async function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const target = document.getElementById(screenId);
    target.style.display = 'flex';
    setTimeout(() => target.classList.add('active'), 10);
}

async function startLoginTransition() {
    await showScreen('loader-screen');
    const texts = ["Initializing Modules", "Loading Configuration", "Injecting Hooks", "Ready"];
    const textEl = document.querySelector('.loader-text');
    for (const t of texts) {
        textEl.textContent = t;
        await new Promise(r => setTimeout(r, 600));
    }
    await showScreen('main-menu');
    if(window.lucide) lucide.createIcons();
}

function minimizeWindow() { bridge?.MinimizeWindow(); }
function exitWindow() { bridge?.CloseWindow(); }

async function handleLogin() {
    const key = document.getElementById('licenseKey').value.trim();
    if (!key) return showToast("Enter your license key", "error");

    const btn = document.querySelector('.btn-primary');
    btn.disabled = true;
    btn.textContent = "VERIFYING...";

    try {
        if (!bridge) {
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

function switchCategory(category) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(`'${category}'`)) item.classList.add('active');
    });
    // This is a simplified version, in a real app you'd swap content panels
}

let configState = { "prediction": 0.0, "hitchance": 100, "fov": 180, "smooth": 1.0, "hit-position": "Closest Point" };

function updateVal(name, val) {
    configState[name] = val;
    const valDisplay = document.getElementById(`${name}-val`);
    if (valDisplay) valDisplay.textContent = val;
}

async function applyUpdate() {
    const btn = document.querySelector('.btn-update');
    btn.style.pointerEvents = 'none';
    btn.querySelector('i').classList.add('spin-anim');
    btn.querySelector('span').textContent = "UPDATING...";
    try {
        if (bridge) {
            await bridge.InvokeSaveConfig(JSON.stringify(configState, null, 4));
            showToast("Configuration Synced", "success");
        } else {
            await new Promise(r => setTimeout(r, 500));
            showToast("Simulated Sync", "success");
        }
    } catch (e) { showToast("Update Failed: " + e.message, "error"); }
    finally {
        btn.style.pointerEvents = 'all';
        btn.querySelector('i').classList.remove('spin-anim');
        btn.querySelector('span').textContent = "UPDATE";
    }
}

async function saveConfig() {
    if (bridge) {
        await bridge.InvokeSaveConfig(JSON.stringify(configState, null, 4));
        showToast("Config Saved", "success");
    }
}
