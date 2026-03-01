// --- State Management ---
let totalPoints = 0;

// --- DOM Elements ---
const stepUpload = document.getElementById('step-upload');
const stepExtract = document.getElementById('step-extract');
const stepProcess = document.getElementById('step-process');
const stepReward = document.getElementById('step-reward');

const stageUpload = document.getElementById('stage-upload');
const stageExtracting = document.getElementById('stage-extracting');
const stageResults = document.getElementById('stage-results');

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const ocrProgress = document.getElementById('ocr-progress');

// Result Elements
const valRawMerchant = document.getElementById('val-raw-merchant');
const valDate = document.getElementById('val-date');
const valTotal = document.getElementById('val-total');
const valItems = document.getElementById('val-items');
const valCategory = document.getElementById('val-category');
const valEarnedPoints = document.getElementById('val-earned-points');
const valRewardLogic = document.getElementById('val-reward-logic');
const totalPointsDisplay = document.getElementById('total-points');

// Action Buttons
const btnReset = document.getElementById('btn-reset');
const btnAddBalance = document.getElementById('btn-add-balance');
const btnViewHistory = document.getElementById('btn-view-history');
const btnCloseHistory = document.getElementById('btn-close-history');

// History Section Elements
const sectionHistory = document.getElementById('section-history');
const historyTableBody = document.getElementById('history-table-body');
const historyLoading = document.getElementById('history-loading');
const historyEmpty = document.getElementById('history-empty');
const historyTable = document.querySelector('.history-table');

// Auth Elements
const sectionAuth = document.getElementById('section-auth');
const appContent = document.getElementById('app-content');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authNameGroup = document.getElementById('auth-name-group');
const authName = document.getElementById('auth-name');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');

let isLoginMode = true;

// API Auth Headers helper
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        sectionAuth.classList.add('hidden');
        appContent.classList.remove('hidden');
        btnLogout.classList.remove('hidden');
        fetchTotalPoints();
    } else {
        sectionAuth.classList.remove('hidden');
        appContent.classList.add('hidden');
        btnLogout.classList.add('hidden');
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', checkAuth);

// --- Auth Logic ---

authSwitchLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.innerText = "Login to Account";
        authSubtitle.innerText = "Access your reward dashboard";
        authNameGroup.classList.add('hidden');
        authSubmitBtn.innerText = "Login";
        authSwitchText.innerText = "Don't have an account?";
        authSwitchLink.innerText = "Sign up";
        authName.required = false;
    } else {
        authTitle.innerText = "Create Account";
        authSubtitle.innerText = "Join the rewards program";
        authNameGroup.classList.remove('hidden');
        authSubmitBtn.innerText = "Sign Up";
        authSwitchText.innerText = "Already have an account?";
        authSwitchLink.innerText = "Login";
        authName.required = true;
    }
    authError.classList.add('hidden');
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    authSubmitBtn.disabled = true;
    authSubmitBtn.innerText = "Processing...";

    const endpoint = isLoginMode ? '/api/login' : '/api/signup';
    const payload = {
        email: authEmail.value,
        password: authPassword.value,
        name: authName.value
    };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.token) {
            localStorage.setItem('token', data.token);
            authEmail.value = "";
            authPassword.value = "";
            authName.value = "";
            checkAuth();
        } else {
            authError.innerText = data.error || "Authentication failed.";
            authError.classList.remove('hidden');
        }
    } catch (err) {
        authError.innerText = "Network Error.";
        console.error(err);
        authError.classList.remove('hidden');
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.innerText = isLoginMode ? "Login" : "Sign Up";
    }
});

btnLogout.addEventListener('click', () => {
    localStorage.removeItem('token');
    totalPoints = 0;
    totalPointsDisplay.innerText = "0";
    historyTableBody.innerHTML = "";
    valRawMerchant.innerText = '--';
    valDate.innerText = '--';
    valTotal.innerText = '--';
    valItems.innerHTML = '';
    valCategory.innerText = '--';
    valEarnedPoints.innerText = '0';
    valRewardLogic.innerText = '--';
    resetUI();
    checkAuth();
});

async function fetchTotalPoints() {
    try {
        const response = await fetch('/api/user', { headers: getAuthHeaders() });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            checkAuth();
            return;
        }
        const data = await response.json();
        if (data && data.totalPoints !== undefined) {
            totalPoints = data.totalPoints;
            totalPointsDisplay.innerText = totalPoints;
            // Welcome user name optional logic
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
}

// --- Utility Functions ---

function activateStep(stepEl) {
    [stepUpload, stepExtract, stepProcess, stepReward].forEach(el => el.classList.remove('active'));
    stepEl.classList.add('active');
}

function showStage(stageEl) {
    [stageUpload, stageExtracting, stageResults].forEach(el => el.classList.add('hidden'));
    stageEl.classList.remove('hidden');
}

// Format currency
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

// --- Core Logic ---

// 1. Upload Handler
fileInput.addEventListener('change', handleUpload);
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleUpload();
    }
});

async function handleUpload() {
    if (!fileInput.files.length) return;

    // Move to Extract step
    activateStep(stepExtract);
    showStage(stageExtracting);

    // Start an infinite progress bar for the UI while waiting for the Gemini API
    ocrProgress.style.transition = 'width 10s ease-out';
    ocrProgress.style.width = '90%';

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const base64String = e.target.result.split(',')[1];

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    receipt: base64String,
                    mimeType: file.type
                })
            });

            const status = response.status;
            const result = await response.json();

            if (status === 200 && result.success) {
                ocrProgress.style.transition = 'width 0.2s linear';
                ocrProgress.style.width = '100%';

                setTimeout(() => {
                    processReceiptData(result.data);
                }, 500);
            } else if (status === 409 || status === 422) {
                alert(result.error);
                resetUI();
            } else {
                alert('Error processing receipt: ' + (result.error || 'Unknown error'));
                resetUI();
            }
        } catch (error) {
            console.error('Upload Error:', error);
            alert('Network error while processing receipt.');
            resetUI();
        }
    };

    reader.onerror = () => {
        alert("Error reading file");
        resetUI();
    };

    reader.readAsDataURL(file);
}

// 2. Process Data
function processReceiptData(receiptData) {
    activateStep(stepProcess);

    // Populate raw data
    valRawMerchant.innerText = receiptData.rawMerchant || 'Unknown Merchant';
    valDate.innerText = receiptData.date || 'Unknown Date';
    valTotal.innerText = formatCurrency(receiptData.total || 0);

    // Populate items
    if (receiptData.items && Array.isArray(receiptData.items)) {
        valItems.innerHTML = receiptData.items.map(item => `
            <div class="item-row">
                <span>${item.name || 'Item'}</span>
                <span>${item.price != null ? '₹' + parseFloat(item.price).toFixed(2) : '-'}</span>
            </div>
        `).join('');
    } else {
        valItems.innerHTML = `<div class="item-row"><span>No items found</span></div>`;
    }

    // Display Category (from GenAI)
    valCategory.innerText = receiptData.category || 'General';

    // Move to Reward step
    setTimeout(() => {
        activateStep(stepReward);

        // Display Rewards (calculated on backend)
        valEarnedPoints.innerText = receiptData.rewardPoints || 0;
        valRewardLogic.innerText = receiptData.rewardLogic || '';

        // Store temporarily in the add button for the dashboard UI update
        // We know the DB is already updated! But we wait for user click to show it nicely.
        btnAddBalance.dataset.pendingPoints = receiptData.rewardPoints || 0;

        showStage(stageResults);
    }, 600);
}

function resetUI() {
    // Reset UI state
    fileInput.value = "";
    ocrProgress.style.width = '0%';
    btnAddBalance.disabled = false;
    btnAddBalance.innerText = "Add to Balance";

    activateStep(stepUpload);
    showStage(stageUpload);
}

// --- Interactions ---

btnAddBalance.addEventListener('click', () => {
    const pointsToAdd = parseInt(btnAddBalance.dataset.pendingPoints || 0);
    if (pointsToAdd > 0) {
        totalPoints += pointsToAdd;
        totalPointsDisplay.innerText = totalPoints;

        // Visual bump effect
        totalPointsDisplay.classList.add('bump');
        setTimeout(() => totalPointsDisplay.classList.remove('bump'), 300);

        // Prevent double adding
        btnAddBalance.dataset.pendingPoints = 0;
        btnAddBalance.disabled = true;
        btnAddBalance.innerText = "Added!";
    }
});

btnReset.addEventListener('click', resetUI);

btnViewHistory.addEventListener('click', async () => {
    sectionHistory.style.display = 'block';
    btnViewHistory.style.display = 'none';

    historyLoading.style.display = 'block';
    historyTable.style.display = 'none';
    historyEmpty.style.display = 'none';

    try {
        const response = await fetch('/api/history', { headers: getAuthHeaders() });
        const data = await response.json();

        historyLoading.style.display = 'none';

        if (data && data.history && data.history.length > 0) {
            historyTable.style.display = 'table';
            historyTableBody.innerHTML = data.history.map(receipt => `
                <tr class="history-item-row" style="border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;">
                    <td class="history-date" style="padding: 1rem 0.5rem;">${new Date(receipt.created_at).toLocaleDateString()}</td>
                    <td class="history-merchant" style="padding: 1rem 0.5rem; font-weight: 500;">${receipt.merchant || 'Unknown'}</td>
                    <td class="history-category" style="padding: 1rem 0.5rem;"><span class="tag" style="font-size: 0.8rem; padding: 0.2rem 0.6rem;">${receipt.category || 'General'}</span></td>
                    <td style="padding: 1rem 0.5rem;">${formatCurrency(receipt.total || 0)}</td>
                    <td style="padding: 1rem 0.5rem; text-align: right; font-weight: bold; color: var(--color-gold);">+${receipt.points_earned || 0}</td>
                </tr>
            `).join('');
        } else {
            historyEmpty.style.display = 'block';
        }
    } catch (error) {
        console.error("Error fetching history:", error);
        historyLoading.style.display = 'none';
        historyEmpty.style.display = 'block';
        historyEmpty.innerText = 'Failed to load history.';
    }
});

btnCloseHistory.addEventListener('click', () => {
    sectionHistory.style.display = 'none';
    btnViewHistory.style.display = 'inline-block';
});

// History Search & Filter Logic
const historySearchInput = document.getElementById('history-search');
const historyCategoryFilter = document.getElementById('history-category-filter');

function filterHistoryTable() {
    if (!historySearchInput || !historyCategoryFilter) return;

    const searchTerm = historySearchInput.value.toLowerCase().trim();
    const filterCategory = historyCategoryFilter.value.toLowerCase();
    const rows = historyTableBody.querySelectorAll('.history-item-row');
    let visibleCount = 0;

    rows.forEach(row => {
        const date = row.querySelector('.history-date').innerText.toLowerCase();
        const merchant = row.querySelector('.history-merchant').innerText.toLowerCase();
        const category = row.querySelector('.history-category').innerText.toLowerCase();

        // Check text search match
        const matchesSearch = date.includes(searchTerm) || merchant.includes(searchTerm) || category.includes(searchTerm);

        // Check dropdown select match
        const matchesCategory = filterCategory === 'all' || category.includes(filterCategory);

        if (matchesSearch && matchesCategory) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Show empty state if no results match the search/filter
    if (visibleCount === 0 && rows.length > 0) {
        historyEmpty.innerText = 'No matching bills found.';
        historyEmpty.style.display = 'block';
        historyTable.style.display = 'none';
    } else if (visibleCount > 0) {
        historyEmpty.style.display = 'none';
        historyTable.style.display = 'table';
    }
}

if (historySearchInput) {
    historySearchInput.addEventListener('input', filterHistoryTable);
}
if (historyCategoryFilter) {
    historyCategoryFilter.addEventListener('change', filterHistoryTable);
}
