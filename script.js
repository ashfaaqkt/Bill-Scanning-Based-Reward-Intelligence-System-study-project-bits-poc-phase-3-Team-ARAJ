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

// --- Initialization ---
document.addEventListener('DOMContentLoaded', fetchTotalPoints);

async function fetchTotalPoints() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        if (data && data.totalPoints !== undefined) {
            totalPoints = data.totalPoints;
            totalPointsDisplay.innerText = totalPoints;
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

    const formData = new FormData();
    formData.append('receipt', fileInput.files[0]);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            ocrProgress.style.transition = 'width 0.2s linear';
            ocrProgress.style.width = '100%';

            setTimeout(() => {
                processReceiptData(result.data);
            }, 500);
        } else {
            alert('Error processing receipt: ' + (result.error || 'Unknown error'));
            resetUI();
        }
    } catch (error) {
        console.error('Upload Error:', error);
        alert('Network error while processing receipt.');
        resetUI();
    }
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
        const response = await fetch('/api/history');
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
                    <td style="padding: 1rem 0.5rem; text-align: right; font-weight: bold; color: var(--primary-color);">+${receipt.points_earned || 0}</td>
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
