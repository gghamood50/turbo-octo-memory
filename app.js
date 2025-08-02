// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCNjGhWVguIWBAHyyLfTapsF_5Bp6ztRG0", // Keep your actual API key secure
    authDomain: "safewayos2.firebaseapp.com",
    projectId: "safewayos2",
    storageBucket: "safewayos2.appspot.com",
    messagingSenderId: "216681158749",
    appId: "1:216681158749:web:35de32f542ad71fa7295b4"
};

// --- Cloud Function URLs ---
const GENERATE_TRIP_SHEETS_URL = 'https://generate-trip-sheets-216681158749.us-central1.run.app';
const ASK_DANIEL_URL = 'https://ask-daniel-216681158749.us-central1.run.app';

// --- Global State ---
let allJobsData = [];
let allTechniciansData = [];
let inventoryItemsData = [];
let currentTripSheets = [];
let currentView = 'dashboard';
let conversationHistory = [];
let currentTripSheetListener = null;
let workerJobsListener = null; // Listener for the worker's specific jobs
let currentWorkerAssignedJobs = []; // To store jobs for the current worker view
let currentWorkerTechnicianName = ''; // To store current worker's name for view rendering
let signaturePad = null;
let confirmedSignatureDataURL = null;
let currentAppView = 'login'; // 'login', 'worker', 'admin'
let currentUser = null;
let currentAdminScreen = 'home'; // 'home', 'invoicesList', 'workers', 'invoiceWorkerSelect'
let previousAppView = 'login';
let currentFilteredWorker = null;
let allAdminInvoicesCache = [];
let currentlyViewedInvoiceData = null;
let currentlySelectedWorker = null;
let pendingInvoices = [];
let currentJobIdForInvoicing = null;
let allWarrantiesData = [];
let currentProvider = null;
let currentFilteredData = [];


// --- DOM Elements ---
const loginScreen = document.getElementById('loginScreen');
const workerHomeScreen = document.getElementById('workerHomeScreen');
const adminHomeScreen = document.getElementById('adminHomeScreen');
const adminInvoicesScreen = document.getElementById('adminInvoicesScreen');
const adminWorkersScreen = document.getElementById('adminWorkersScreen');
const settingsScreen = document.getElementById('settingsScreen');
const adminInvoiceWorkerSelectScreen = document.getElementById('adminInvoiceWorkerSelectScreen');
const invoiceViewModal = document.getElementById('invoiceViewModal');
const workerDetailModal = document.getElementById('workerDetailModal');
const confirmationModal = document.getElementById('confirmationModal');
const adminBottomNav = document.getElementById('adminBottomNav');

const jobsTableBody = document.getElementById('jobsTableBody');
const jobsTable = document.getElementById('jobsTable');
const technicianCardsContainer = document.getElementById('technician-cards-container');
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');

const editTechModal = document.getElementById('editTechnicianModal');
const closeEditTechModalBtn = document.getElementById('closeEditTechModal');
const cancelEditTechBtn = document.getElementById('cancelEditTech');
const editTechForm = document.getElementById('editTechForm');

const scheduleJobModal = document.getElementById('scheduleJobModal');
const closeScheduleJobModalBtn = document.getElementById('closeScheduleJobModal');
const cancelScheduleJobBtn = document.getElementById('cancelScheduleJob');
const scheduleJobForm = document.getElementById('scheduleJobForm');

const generateTripSheetsBtn = document.getElementById('generateTripSheetsBtn');
const scheduleStatus = document.getElementById('scheduleStatus');
const tripSheetsContainer = document.getElementById('trip-sheets-container');
const tripSheetDateInput = document.getElementById('tripSheetDate');
const tripSheetApprovalContainer = document.getElementById('tripSheetApprovalContainer');
const approveTripSheetsBtn = document.getElementById('approveTripSheetsBtn');

const addJobModal = document.getElementById('addJobModal');
const openAddJobModalButton = document.getElementById('openAddJobModalButton');
const closeAddJobModalButton = document.getElementById('closeAddJobModal');
const cancelAddJobButton = document.getElementById('cancelAddJob');
const newJobForm = document.getElementById('newJobForm');

const inventoryTableBody = document.getElementById('inventoryTableBody');
const inventoryTotalSKUs = document.getElementById('inventoryTotalSKUs');
const inventoryLowStockItems = document.getElementById('inventoryLowStockItems');
const inventoryEstValue = document.getElementById('inventoryEstValue');

const addPartModal = document.getElementById('addPartModal');
const openAddPartModalButton = document.getElementById('openAddPartModalButton');
const closeAddPartModalButton = document.getElementById('closeAddPartModal');
const cancelAddPartButton = document.getElementById('cancelAddPart');
const newPartForm = document.getElementById('newPartForm');
const savePartButton = document.getElementById('savePartButton');

const logPartUsageModal = document.getElementById('logPartUsageModal');
const openLogPartUsageButton = document.getElementById('logPartUsageButton');
const closeLogPartUsageModalButton = document.getElementById('closeLogPartUsageModal');
const cancelLogPartUsageButton = document.getElementById('cancelLogPartUsage');
const logPartUsageForm = document.getElementById('logPartUsageForm');
const usageTechnicianSelect = document.getElementById('usageTechnician');
const inventoryPartsDatalist = document.getElementById('inventoryPartsList');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');

const dashboardUnscheduledJobsEl = document.getElementById('dashboardUnscheduledJobs');
const dashboardScheduledJobsEl = document.getElementById('dashboardScheduledJobs');
const dashboardTotalJobsEl = document.getElementById('dashboardTotalJobs');
const dashboardLifetimeTripSheetsEl = document.getElementById('dashboardLifetimeTripSheets');
const dashboardLatestJobsListEl = document.getElementById('dashboardLatestJobsList');

const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const sendChatButton = document.getElementById('sendChatButton');
    const sendAllInvoicesBtn = document.getElementById('sendAllInvoicesBtn');

// --- Worker PWA DOM Elements ---
const workerPwaView = document.getElementById('workerPwaView');
const workerNameEl = document.getElementById('workerName');
const workerCurrentDateEl = document.getElementById('workerCurrentDate');
const workerTodaysRouteEl = document.getElementById('workerTodaysRoute');
const workerLogoutBtn = document.getElementById('workerLogoutBtn');

// --- Invoice Form Elements ---
const invoiceFormScreen = document.getElementById('invoiceFormScreen');
const invoiceFormEl = document.getElementById('invoiceForm');
const backToCurrentHomeBtn = document.getElementById('backToCurrentHomeBtn');
const addItemBtn = document.getElementById('addItemBtn');
const saveInvoiceBtn = document.getElementById('saveInvoiceBtn');
const clearFormBtn = document.getElementById('clearFormBtn');
const signatureCanvas = document.getElementById('signatureCanvas');
const clearSignatureBtn = document.getElementById('clearSignatureBtn');
const confirmSignatureBtn = document.getElementById('confirmSignatureBtn');
const lineItemsContainer = document.getElementById('lineItemsContainer');
const invoiceNumberDisplay = document.getElementById('invoiceNumberDisplay');
const customTaxArea = document.getElementById('customTaxArea');
const salesTaxRateInput = document.getElementById('salesTaxRate');
const previewSignatureImg = document.getElementById('previewSignatureImg');
const signaturePadContainer = document.querySelector('.signature-pad-container');
const signedBySection = document.getElementById('signedBySection');
const invoiceFormTitle = document.getElementById('invoiceFormTitle');
const signatureLoadingMessage = document.getElementById('signatureLoadingMessage');
const chequeNumberArea = document.getElementById('chequeNumberArea');
const chequeNumberInput = document.getElementById('chequeNumber');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalMarkPaidBtn = document.getElementById('modalMarkPaidBtn');
const modalDownloadPdfBtn = document.getElementById('modalDownloadPdfBtn');
const modalWorkerCloseBtn = document.getElementById('modalWorkerCloseBtn');
const modalRemoveWorkerBtn = document.getElementById('modalRemoveWorkerBtn');


// --- Render Functions ---
function renderJobs(jobs) {
    allJobsData = jobs;
    if (!jobsTableBody || !jobsTable) return;

    jobsTable.classList.remove('hidden');
    jobsTableBody.innerHTML = '';

    if (jobs.length === 0) {
        jobsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-500 py-4">No jobs found. Waiting for new emails...</td></tr>`;
        return;
    }

    const sortedJobs = [...jobs].sort((a, b) => {
        const dateA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
    });
    jobsTableBody.innerHTML = sortedJobs.map(job => {
        let statusText = job.status || 'Needs Scheduling';
        let statusClass = 'status-needs-scheduling';

        if (statusText === 'Scheduled') {
            statusClass = 'status-scheduled';
            if (job.scheduledDate && job.timeSlot) {
                statusText = `Scheduled: ${job.scheduledDate} (${job.timeSlot})`;
            }
        } else if (statusText === 'Awaiting completion') {
            statusClass = 'status-awaiting-completion';
        } else if (statusText === 'Completed') {
            statusClass = 'status-completed';
        }
        const isAdmin = auth.currentUser && auth.currentUser.email === 'admin@safewayos2.app';
        const actionsHtml = isAdmin
            ? `<button class="btn-secondary-stitch schedule-job-btn" data-id="${job.id}">View/Schedule</button>`
            : `<button class="btn-primary-stitch create-invoice-btn" data-id="${job.id}">Create Invoice</button>`;

        return `
            <tr>
                <td class="font-medium text-slate-800">${job.customer || 'N/A'}</td>
                <td>${job.address || 'N/A'}</td>
                <td>${job.issue || 'N/A'}</td>
                <td>${job.phone || 'N/A'}</td>
                <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                <td>${actionsHtml}</td>
            </tr>
        `;
    }).join('');
}

function renderTechnicians(technicians) {
    allTechniciansData = technicians;
    if (!technicianCardsContainer) return;
    technicianCardsContainer.innerHTML = technicians.map(tech => {
        const statusClass = tech.status === 'Online' ? 'status-online' : 'status-offline';
        const avatarChar = tech.name ? tech.name.charAt(0).toUpperCase() : 'T';
        const avatarColor = tech.status === 'Online' ? '059669' : '64748b';

        return `
        <div class="stat-card-stitch">
            <div class="flex items-center mb-2">
                <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 border-2 border-white shadow-sm mr-3" style='background-image: url("https://placehold.co/50x50/${avatarColor}/FFFFFF?text=${avatarChar}");'></div>
                <div>
                    <h4 class="text-slate-800 text-lg font-semibold">${tech.name}</h4>
                    <p class="text-sm text-slate-500">Lead Technician</p>
                </div>
            </div>
            <p class="text-sm text-slate-600 truncate"><span class="material-icons-outlined text-sm text-green-600 vm">location_on</span> ${tech.currentLocation || 'Not set'}</p>
            <p class="text-sm text-slate-600"><span class="material-icons-outlined text-sm text-green-600 vm">speed</span> Capacity: ${tech.maxJobs} jobs/day</p>
            <div class="mt-2 flex items-center justify-between">
                <span class="status-pill ${statusClass}">${tech.status}</span>
                <button class="btn-secondary-stitch manage-tech-btn" data-id="${tech.id}">Manage</button>
            </div>
        </div>
        `;
    }).join('');
}

function renderTripSheets(tripSheets, date) {
    currentTripSheets = tripSheets;
    if (!tripSheetsContainer) return;

    const displayDate = date ? new Date(date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "the selected date";

    if (!tripSheets || tripSheets.length === 0) {
        tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-slate-400"><span class="material-icons-outlined text-4xl">calendar_today</span><p>No trip sheets have been generated for ${displayDate}.</p></div>`;
        tripSheetApprovalContainer.classList.add('hidden');
        return;
    }

    let html = '';
    let isAnyJobNotApproved = false;

    const jobIdsInSheets = new Set(tripSheets.flatMap(sheet => sheet.route.map(job => job.id)));
    const liveJobs = allJobsData.filter(job => jobIdsInSheets.has(job.id));

    liveJobs.forEach(job => {
        if (job.status === 'Scheduled') {
            isAnyJobNotApproved = true;
        }
    });

    tripSheets.forEach(sheet => {
        const avatarChar = sheet.technicianName ? sheet.technicianName.charAt(0).toUpperCase() : 'T';
        html += `
        <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 class="font-semibold text-green-700 text-md mb-2 flex items-center">
                <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8 border-2 border-white shadow-sm mr-2" style='background-image: url("https://placehold.co/40x40/059669/FFFFFF?text=${avatarChar}");'></div>
                ${sheet.technicianName}'s Route
            </h4>
            <ol class="list-decimal list-inside text-sm text-slate-700 space-y-2 pl-2">
                ${sheet.route.map(job => `
                    <li>
                        <span class="font-semibold">${job.timeSlot}</span> - ${job.address}
                        <br>
                        <span class="text-xs text-slate-600">(${job.customer} - ${job.issue})</span>
                    </li>
                `).join('')}
            </ol>
        </div>
        `;
    });
    tripSheetsContainer.innerHTML = html;

    if (isAnyJobNotApproved) {
        tripSheetApprovalContainer.classList.remove('hidden');
        approveTripSheetsBtn.disabled = false;
        approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle</span>Approve Trip Sheets`;
    } else {
        tripSheetApprovalContainer.classList.remove('hidden');
        approveTripSheetsBtn.disabled = true;
        approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle_outline</span>Sheets Approved`;
    }
}

function renderInventory(items) {
    inventoryItemsData = items;
    if (!inventoryTableBody) return;

    if (inventoryTotalSKUs) inventoryTotalSKUs.textContent = items.length;

    let lowStockCount = 0;
    let totalValue = 0;
    items.forEach(item => {
        if (item.currentStock < item.reorderLevel) {
            lowStockCount++;
        }
        totalValue += (item.currentStock * (item.unitCost || 0));
    });
    if (inventoryLowStockItems) inventoryLowStockItems.textContent = lowStockCount;
    if (inventoryEstValue) inventoryEstValue.textContent = `$${totalValue.toFixed(2)}`;

    if (items.length === 0) {
        inventoryTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-slate-500 py-4">No inventory items found. Click "Add New Part" to get started.</td></tr>`;
    } else {
        inventoryTableBody.innerHTML = items.map(item => {
            let statusClass = 'status-instock';
            let statusText = 'In Stock';
            if (item.currentStock < item.reorderLevel) {
                statusClass = 'status-lowstock';
                statusText = 'Low Stock';
            }
            if (item.currentStock === 0) {
                statusText = 'Out of Stock';
            }
            return `
                <tr>
                    <td class="font-medium text-slate-800">${item.partName}</td>
                    <td>${item.sku}</td>
                    <td>${item.category || 'N/A'}</td>
                    <td>${item.currentStock}</td>
                    <td>${item.reorderLevel}</td>
                    <td>$${item.unitCost ? item.unitCost.toFixed(2) : '0.00'}</td>
                    <td>${item.supplier || 'N/A'}</td>
                    <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn-secondary-stitch text-xs edit-part-btn" data-id="${item.id}">Edit</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (inventoryPartsDatalist) {
        inventoryPartsDatalist.innerHTML = items.map(item => `<option value="${item.sku}">${item.partName}</option>`).join('');
    }
}

function formatCurrency(amount) { return `$${parseFloat(amount || 0).toFixed(2)}`; }

function updateDashboard(data) {
    currentFilteredData = data; // Store current filtered data
    renderInvoiceStats(data);
    renderProviderCardCounts(data);
    renderWarranties(data);
}

function renderInvoiceStats(warranties) {
    const statsTotalInvoices = document.getElementById('statsTotalInvoices');
    const statsUnclaimedInvoices = document.getElementById('statsUnclaimedInvoices');
    const statsClaimedInvoices = document.getElementById('statsClaimedInvoices');
    const statsClaimedValue = document.getElementById('statsClaimedValue');
    let total = 0, unclaimed = 0, claimed = 0, value = 0;
    if (warranties) warranties.forEach(w => w.invoices?.forEach(inv => {
        total++;
        inv.status === 'paid' ? (claimed++, value += inv.total || 0) : unclaimed++;
    }));
    if (statsTotalInvoices) statsTotalInvoices.textContent = total;
    if (statsUnclaimedInvoices) statsUnclaimedInvoices.textContent = unclaimed;
    if (statsClaimedInvoices) statsClaimedInvoices.textContent = claimed;
    if (statsClaimedValue) statsClaimedValue.textContent = formatCurrency(value);
}

function renderProviderCardCounts(warranties) {
    const providers = { firstAmerican: { count: 0, value: 0 }, homeGuard: { count: 0, value: 0 }, others: { count: 0, value: 0 } };
    warranties.forEach(w => {
        const pName = w.job?.warrantyProvider?.toLowerCase() || 'other';
        const total = w.invoices?.reduce((s, i) => s + (i.total || 0), 0) || 0;
        const count = w.invoices?.length || 0;
        if (pName.includes('first american')) { providers.firstAmerican.count += count; providers.firstAmerican.value += total; }
        else if (pName.includes('home guard')) { providers.homeGuard.count += count; providers.homeGuard.value += total; }
        else { providers.others.count += count; providers.others.value += total; }
    });
    document.getElementById('firstAmericanStats').innerHTML = `${providers.firstAmerican.count} <span class="provider-card-subtext">${formatCurrency(providers.firstAmerican.value)}</span>`;
    document.getElementById('homeGuardStats').innerHTML = `${providers.homeGuard.count} <span class="provider-card-subtext">${formatCurrency(providers.homeGuard.value)}</span>`;
    document.getElementById('othersStats').innerHTML = `${providers.others.count} <span class="provider-card-subtext">${formatCurrency(providers.others.value)}</span>`;
}

function openProviderClaimsWorkspace(providerName, warranties) {
    currentProvider = providerName;
    const modalTitle = document.getElementById('providerModalTitle');
    const unclaimedList = document.getElementById('unclaimedInvoicesList');
    const claimedList = document.getElementById('claimedInvoicesList');
    const processAllBtn = document.getElementById('processAllBtn');
    const providerInvoiceListOverlay = document.getElementById('providerInvoiceListOverlay');
    if (!providerInvoiceListOverlay || !modalTitle || !unclaimedList || !claimedList) return;

    modalTitle.textContent = `${providerName} Claims`;
    unclaimedList.innerHTML = '';
    claimedList.innerHTML = '';
    
    const providerKey = providerName.toLowerCase();
    const filteredWarranties = warranties.filter(w => {
        const pName = w.job?.warrantyProvider?.toLowerCase() || 'other';
        if (providerKey === 'first american') return pName.includes('first american');
        if (providerKey === 'home guard') return pName.includes('home guard');
        if (providerKey === 'others') return !pName.includes('first american') && !pName.includes('home guard');
        return false;
    });

    let unclaimedCount = 0;
    let claimedCount = 0;

    filteredWarranties.forEach(w => {
        w.invoices?.forEach(inv => {
            const card = document.createElement('div');
            card.className = 'invoice-card';
            card.dataset.invoiceNumber = inv.invoiceNumber;
            card.dataset.warrantyId = w.id;
            const isClaimed = inv.status === 'paid';
            card.innerHTML = `<div class="flex justify-between items-start"><div><p class="font-semibold text-slate-800">${w.job?.customer || 'N/A'}</p><p class="text-xs text-slate-500">#${inv.invoiceNumber || 'N/A'} &bull; ${inv.invoiceDate || 'N/A'}</p></div><p class="font-bold text-lg text-green-600">${formatCurrency(inv.total)}</p></div><div class="mt-3 flex justify-end items-center gap-2"><button class="btn-secondary-stitch text-xs view-warranty-btn" data-id="${w.id}">View Job</button>${!isClaimed ? `<button class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-md process-claim-btn">Process Claim</button>` : ''}</div>`;
            if(isClaimed) { card.classList.add('claimed'); claimedList.appendChild(card); claimedCount++; } 
            else { unclaimedList.appendChild(card); unclaimedCount++; }
        });
    });

    if (unclaimedCount === 0) { unclaimedList.innerHTML = '<p class="text-center text-sm text-slate-500 p-4">No unclaimed invoices.</p>'; processAllBtn.classList.add('hidden'); } 
    else { processAllBtn.classList.remove('hidden'); }
    if (claimedCount === 0) claimedList.innerHTML = '<p class="text-center text-sm text-slate-500 p-4">No claimed invoices.</p>';
    
    providerInvoiceListOverlay.classList.add('is-visible');
}

function openInvoiceDetailOverlay(warranty, invoice) {
    const content = document.getElementById('invoiceDetailContent');
    const invoiceDetailOverlay = document.getElementById('invoiceDetailOverlay');
    const job = warranty.job || {};
    
    const signatureHTML = invoice.signatureDataURL ? `<img src="${invoice.signatureDataURL}" alt="Signature" class="signature-image-modal">` : '<p class="text-sm text-slate-500 mt-2">No signature provided.</p>';
    const itemsHTML = invoice.items.map(item => `<tr><td class="py-1 pr-2">${item.description}</td><td class="py-1 pr-2 text-right">${item.quantity}</td><td class="py-1 pr-2 text-right">${formatCurrency(item.price)}</td><td class="py-1 text-right font-medium">${formatCurrency(item.total)}</td></tr>`).join('');
    const nonCoveredItemsHTML = invoice.nonCoveredItems ? `<div class="mt-2 pt-2 border-t border-slate-200"><strong>Non-Covered Items:</strong><p class="text-sm whitespace-pre-wrap">${invoice.nonCoveredItems}</p></div>` : '';
    
    content.innerHTML = `
        <h2 class="text-2xl font-bold text-slate-800">Invoice #${invoice.invoiceNumber}</h2>
        <p class="text-sm text-slate-500 mb-6">Date: ${invoice.invoiceDate || 'N/A'}</p>
        
        <h3 class="text-lg font-semibold mt-4 mb-2 text-slate-700">Items/Services:</h3>
        <table class="w-full text-sm custom-table"><thead><tr><th>Desc.</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead><tbody>${itemsHTML}</tbody></table>
        <div class="mt-4 flex justify-end"><div class="w-full max-w-xs space-y-1 text-sm"><div class="flex justify-between"><span>Subtotal:</span><span>${formatCurrency(invoice.subtotal)}</span></div><div class="flex justify-between"><span>Labor:</span><span>${formatCurrency(invoice.labor)}</span></div><div class="flex justify-between"><span>Service Call:</span><span>${formatCurrency(invoice.serviceCall)}</span></div><div class="flex justify-between"><span>Sales Tax (${invoice.salesTaxRate}%):</span><span>${formatCurrency(invoice.salesTaxAmount)}</span></div><div class="flex justify-between font-bold text-base border-t border-slate-300 mt-1 pt-1"><span>TOTAL:</span><span>${formatCurrency(invoice.total)}</span></div></div></div>
        ${nonCoveredItemsHTML}
        
        <div class="bg-slate-50 p-4 rounded-lg border mt-6">
            <h3 class="font-semibold text-slate-800 mb-2 text-base">Job Description & Recommendations</h3>
            <p class="text-sm text-slate-600 whitespace-pre-wrap"><strong>Issue:</strong> ${job.issue || 'N/A'}</p>
            <p class="text-sm text-slate-600 mt-2 whitespace-pre-wrap"><strong>Work Performed:</strong> ${job.jobDescription || 'N/A'}</p>
            <p class="text-sm text-slate-600 mt-2 whitespace-pre-wrap"><strong>Recommendations:</strong> ${job.recommendations || 'N/A'}</p>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-200">
            <h4 class="text-base font-semibold text-slate-700">Customer Signature</h4>
            <div class="mt-2">
                ${signatureHTML}
                <p class="text-sm text-slate-600 mt-1"><strong>Signed By:</strong> ${invoice.signedBy || 'N/A'}</p>
            </div>
        </div>
    `;
    invoiceDetailOverlay.classList.add('is-visible');
}

function openAllJobsOverlay(warranties, technicianName = 'All Technicians') {
    const tableBody = document.getElementById('allJobsTableBody');
    const title = document.getElementById('allJobsTitle');
    const allJobsOverlay = document.getElementById('allJobsOverlay');
    if (!tableBody || !allJobsOverlay) return;

    const filteredWarranties = technicianName === 'All Technicians'
        ? warranties
        : warranties.filter(w => w.job?.assignedTechnicianName === technicianName);

    const sortedWarranties = [...filteredWarranties].sort((a, b) => (b.completionDate?.toDate() || 0) - (a.completionDate?.toDate() || 0));
    title.textContent = `${technicianName} - Completed Jobs (${sortedWarranties.length})`;
    tableBody.innerHTML = sortedWarranties.map(w => {
        const completionDate = w.completionDate?.toDate().toLocaleDateString() || 'N/A';
        return `<tr><td class="font-medium text-slate-800">${w.job?.customer||'N/A'}</td><td>${w.job?.address||'N/A'}</td><td>${completionDate}</td><td>${w.job?.assignedTechnicianName||'N/A'}</td><td><button class="btn-secondary-stitch view-warranty-btn" data-id="${w.id}">View Details</button></td></tr>`;
    }).join('');
    
    allJobsOverlay.classList.add('is-visible');
}

function openTechnicianSelectionOverlay() {
    const container = document.getElementById('technicianSelectionCards');
    const technicianSelectionOverlay = document.getElementById('technicianSelectionOverlay');
    if (!container) return;

    container.innerHTML = `
        <div class="tech-selection-card" data-technician="All Technicians">
            <span class="material-icons-outlined text-5xl text-green-600 mb-2">groups</span>
            <h3 class="text-xl font-bold text-slate-800">All Technicians</h3>
        </div>
    `;

    allTechniciansData.forEach(tech => {
        const card = document.createElement('div');
        card.className = 'tech-selection-card';
        card.dataset.technician = tech.name;
        card.innerHTML = `
            <span class="material-icons-outlined text-5xl text-green-600 mb-2">person</span>
            <h3 class="text-xl font-bold text-slate-800">${tech.name}</h3>
        `;
        container.appendChild(card);
    });

    technicianSelectionOverlay.classList.add('is-visible');
}

function closeModal(modal) { if (modal) modal.style.display = 'none'; }
function closeOverlay(overlay) { if(overlay) overlay.classList.remove('is-visible'); }

function listenForWarranties() {
    const warrantiesQuery = firebase.firestore().collection("warranties").orderBy("completionDate", "desc");
    warrantiesQuery.onSnapshot((snapshot) => {
        allWarrantiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboard(allWarrantiesData);
    }, (error) => {
        console.error("Error listening for warranties:", error);
    });
}

function renderWarranties(warranties) {
    const warrantyTableBody = document.getElementById('warrantyTableBody');
    if (!warrantyTableBody) return;

    warrantyTableBody.innerHTML = '';

    if (warranties.length === 0) {
        warrantyTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-slate-500 py-4">No warranties found.</td></tr>`;
        return;
    }
    
    const viewAllBtn = document.getElementById('viewAllInvoicesBtn');

    const sortedWarranties = [...warranties].sort((a, b) => (b.completionDate?.toDate() || 0) - (a.completionDate?.toDate() || 0));
    const warrantiesToRender = sortedWarranties.slice(0, 5);
    
    if (viewAllBtn) {
        viewAllBtn.style.display = 'inline';
    }

    warrantyTableBody.innerHTML = warrantiesToRender.map(warranty => {
        const completionDate = warranty.completionDate && typeof warranty.completionDate.toDate === 'function' 
            ? warranty.completionDate.toDate().toLocaleDateString() 
            : 'N/A';
            
        return `
            <tr>
                <td class="font-medium text-slate-800">${warranty.job.customer || 'N/A'}</td>
                <td>${warranty.job.address || 'N/A'}</td>
                <td>${completionDate}</td>
                <td>${warranty.job.assignedTechnicianName || 'N/A'}</td>
                <td><button class="btn-secondary-stitch view-warranty-btn" data-id="${warranty.id}">View Details</button></td>
            </tr>
        `;
    }).join('');
}

function populateTechnicianDropdowns() {
    if (!usageTechnicianSelect || !allTechniciansData) return;

    const currentSelection = usageTechnicianSelect.value;
    usageTechnicianSelect.innerHTML = '<option value="">Select Technician</option>';
    allTechniciansData.forEach(tech => {
        if (tech.status === 'Online') {
            const option = document.createElement('option');
            option.value = tech.id;
            option.textContent = tech.name;
            usageTechnicianSelect.appendChild(option);
        }
    });
    if (currentSelection && usageTechnicianSelect.querySelector(`option[value="${currentSelection}"]`)) {
        usageTechnicianSelect.value = currentSelection;
    }
}

function animateCountUp(element, targetValue, duration = 500) {
    if (!element) return;
    targetValue = Number(targetValue) || 0;

    const startValue = parseInt(element.textContent, 10) || 0;
    const startTime = performance.now();

    function updateCount(currentTime) {
        const elapsedTime = currentTime - startTime;
        if (elapsedTime >= duration) {
            element.textContent = targetValue;
            return;
        }
        const progress = elapsedTime / duration;
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easedProgress);
        element.textContent = currentValue;
        requestAnimationFrame(updateCount);
    }
    requestAnimationFrame(updateCount);
}

function renderDashboardStats(jobs, tripSheets) {
    const unscheduledJobsCount = jobs.filter(j => j.status === 'Needs Scheduling').length;
    const scheduledJobsCount = jobs.filter(j => j.status === 'Scheduled' || j.status === 'Awaiting completion').length;
    const totalJobsCount = jobs.length;
    const totalTripSheetsCount = tripSheets.length;

    animateCountUp(dashboardUnscheduledJobsEl, unscheduledJobsCount);
    animateCountUp(dashboardScheduledJobsEl, scheduledJobsCount);
    animateCountUp(dashboardTotalJobsEl, totalJobsCount);
    animateCountUp(dashboardLifetimeTripSheetsEl, totalTripSheetsCount);

    const latestJobs = [...jobs].sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate()).slice(0, 5);
    if (dashboardLatestJobsListEl) {
        if (latestJobs.length === 0) {
            dashboardLatestJobsListEl.innerHTML = `<li class="p-3 text-slate-500">No jobs found yet.</li>`;
        } else {
            dashboardLatestJobsListEl.innerHTML = '';
            latestJobs.forEach((job, index) => {
                const issueSummary = job.issue ? job.issue.substring(0, 50) + (job.issue.length > 50 ? '...' : '') : 'No issue description';
                const customerName = job.customer || 'N/A';

                const listItem = document.createElement('li');
                listItem.className = 'latest-job-item p-3 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors';
                listItem.style.setProperty('--animation-delay', `${index * 0.07}s`);

                listItem.innerHTML = `
                    <p class="font-medium text-slate-700">${customerName} - <span class="text-sm text-slate-600">${issueSummary}</span></p>
                    <p class="text-xs text-slate-500">${job.address || 'No address'} - <span class="font-semibold">${job.status || 'N/A'}</span></p>
                `;
                dashboardLatestJobsListEl.appendChild(listItem);

                setTimeout(() => {
                    listItem.classList.add('latest-job-item-visible');
                }, 50);
            });
        }
    }
}

function renderWorkerPwaView(jobs, technicianName) {
    if (!workerPwaView || !workerNameEl || !workerCurrentDateEl || !workerTodaysRouteEl) return;

    // Store jobs and technician name for potential re-render by "Back" button
    currentWorkerAssignedJobs = jobs;
    currentWorkerTechnicianName = technicianName;

    workerNameEl.textContent = `Hello, ${technicianName}`;
    workerCurrentDateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    if (jobs.length === 0) {
        workerTodaysRouteEl.innerHTML = `
            <div class="text-center p-8 text-slate-500">
                <span class="material-icons-outlined text-6xl">task_alt</span>
                <h3 class="text-xl font-bold mt-4">All Clear!</h3>
                <p>You have no jobs assigned for today.</p>
            </div>
        `;
        return;
    }

    const timeSlotOrder = { "8am to 2pm": 1, "9am to 4pm": 2, "12pm to 6pm": 3 };
    const sortedJobs = [...jobs].sort((a, b) => (timeSlotOrder[a.timeSlot] || 99) - (timeSlotOrder[b.timeSlot] || 99));

    workerTodaysRouteEl.innerHTML = sortedJobs.map(job => `
        <div class="flex items-center gap-4 bg-white px-4 min-h-[72px] py-3 justify-between border-b border-slate-100 cursor-pointer hover:bg-slate-50 worker-job-item" data-id="${job.id}">
            <div class="flex items-center gap-4 overflow-hidden">
                <div class="text-[#111418] flex items-center justify-center rounded-lg bg-[#f0f2f5] shrink-0 size-12">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"></path></svg>
                </div>
                <div class="flex flex-col justify-center overflow-hidden">
                    <p class="text-[#111418] text-base font-medium leading-normal truncate">${job.timeSlot || 'Anytime'}</p>
                    <p class="text-[#60758a] text-sm font-normal leading-normal truncate">${job.address}</p>
                </div>
            </div>
            <div class="shrink-0">
                <div class="flex size-7 items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M181.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L164.69,128,98.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,181.66,133.66Z"></path></svg>
                </div>
            </div>
        </div>
    `).join('');
}

// --- Function to show detailed job view for worker ---
function showWorkerJobDetails(job) {
    if (!job) return;

    // Hide header elements
    if (workerCurrentDateEl) workerCurrentDateEl.style.display = 'none';
    const todaysRouteHeading = document.getElementById('todaysRouteHeading');
    if (todaysRouteHeading) todaysRouteHeading.style.display = 'none';
    
    // Main container styling
    if (workerNameEl) {
      workerNameEl.innerHTML = `
        <div class="flex items-center bg-white p-0 pb-2 justify-between">
          <div class="text-[#111418] flex size-12 shrink-0 items-center" data-icon="ArrowLeft" data-size="24px" data-weight="regular" id="backToWorkerJobListBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
            </svg>
          </div>
          <h2 class="text-[#111418] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">${job.customer}</h2>
          <div class="flex w-12 items-center justify-end"></div>
        </div>
      `;
    }
    workerTodaysRouteEl.innerHTML = `
    <div>
        <p class="text-[#60758a] text-base font-bold leading-normal tracking-[0.015em] shrink-0 text-center">Dispatch #${job.dispatchOrPoNumber}</p>
        <h3 class="text-[#111418] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Customer Information</h3>
        <div class="flex items-center gap-4 bg-white px-4 min-h-[72px] py-2">
          <div class="text-[#111418] flex items-center justify-center rounded-lg bg-[#f0f2f5] shrink-0 size-12" data-icon="MapPin" data-size="24px" data-weight="regular">
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path
                d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z"
              ></path>
            </svg>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[#111418] text-base font-medium leading-normal line-clamp-1">${job.customer}</p>
            <p class="text-[#60758a] text-sm font-normal leading-normal line-clamp-2">${job.address}</p>
          </div>
        </div>
        <div class="flex items-center gap-4 bg-white px-4 min-h-14">
          <div class="text-[#111418] flex items-center justify-center rounded-lg bg-[#f0f2f5] shrink-0 size-10" data-icon="Phone" data-size="24px" data-weight="regular">
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path
                d="M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.25.39-.5.57-.77a16,16,0,0,0,1.32-15.06l0-.12L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46ZM176,208A128.14,128.14,0,0,1,48,80,40.2,40.2,0,0,1,82.87,40a.61.61,0,0,0,0,.12l21,47L83.2,111.86a6.13,6.13,0,0,0-.57.77,16,16,0,0,0-1,15.7c9.06,18.53,27.73,37.06,46.46,46.11a16,16,0,0,0,15.75-1.14,8.44,8.44,0,0,0,.74-.56L168.89,152l47,21.05h0s.08,0,.11,0A40.21,40.21,0,0,1,176,208Z"
              ></path>
            </svg>
          </div>
          <p class="text-[#111418] text-base font-normal leading-normal flex-1 truncate">${job.phone}</p>
        </div>
        <div class="flex items-center gap-4 bg-white px-4 min-h-14">
            <div class="text-[#111418] flex items-center justify-center rounded-lg bg-[#f0f2f5] shrink-0 size-10" data-icon="ShieldCheck" data-size="24px" data-weight="regular">
                <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M223.49,68.76,144,36.22a16,16,0,0,0-14.7,0l-80,32.54A16,16,0,0,0,40,84.15V152a92.24,92.24,0,0,0,48.24,81.33,16,16,0,0,0,15.52,0A92.24,92.24,0,0,0,216,152V84.15A16,16,0,0,0,223.49,68.76ZM128,216c-33.15-18.47-48-50.84-48-70.27V91.13l48-19.49,48,19.49v54.6C176,165.16,161.15,197.53,128,216Zm-8.49-84.49,32-32a8,8,0,0,1,11.32,11.32L128,145.66l-16.49-16.5a8,8,0,0,1,11.32-11.32Z"></path></svg>
            </div>
            <p class="text-[#111418] text-base font-normal leading-normal flex-1 truncate">${job.warrantyProvider || 'N/A'}</p>
        </div>
        <div class="flex items-center gap-4 bg-white px-4 min-h-14">
            <div class="text-[#111418] flex items-center justify-center rounded-lg bg-[#f0f2f5] shrink-0 size-10" data-icon="Note" data-size="24px" data-weight="regular">
                <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM56,216V40h88V88a8,8,0,0,0,8,8h48V216Z"></path></svg>
            </div>
            <p class="text-[#111418] text-base font-normal leading-normal flex-1 truncate">${job.planType || 'N/A'}</p>
        </div>
        <h3 class="text-[#111418] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Job Description</h3>
        <div class="p-4">
          <div
            class="bg-cover bg-center flex flex-col items-stretch justify-end rounded-lg pt-[132px]"
            style='background-image: linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuAnoLfzaQ-gNxaBrMargt4ICzWZYHmg9DUhqW-Nl-F1FqVPk9xXLd5uMYx6Czsy70-bayIO-b76_wLsKCm_wlMfDbbph9Tk15Kc8mC_XP46qWfydpbMtwYcNM2oTwEu5tlIpYrVrpwadL9hq2KRmeYdU158YPk2z9kV2ZXEtXsD_E2rrRcBADn1l_yXJFT0IhaoShiEs5FP5wI66LN2YDopm8wgXCBux056jN_-P0jOONCxc6QLMFT3UQKXrMj_-mcFDB57g60UKzY");'
          >
            <div class="flex w-full items-end justify-between gap-4 p-4">
              <div class="flex max-w-[440px] flex-1 flex-col gap-1">
                <p class="text-white tracking-light text-2xl font-bold leading-tight max-w-[440px]">${job.issue}</p>
                <p class="text-white text-base font-medium leading-normal">${job.issue}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="flex justify-center">
          <div class="flex flex-1 gap-3 max-w-[480px] flex-col items-stretch px-4 py-3">
            <button
              class="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#0c7ff2] text-white text-sm font-bold leading-normal tracking-[0.015em] w-full"
            >
              <span class="truncate">On My Way!</span>
            </button>
            <button
              class="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f0f2f5] text-[#111418] text-sm font-bold leading-normal tracking-[0.015em] w-full"
              id="createInvoiceBtn"
              data-id="${job.id}"
            >
              <span class="truncate">Create Invoice</span>
            </button>
            <button
              class="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f0f2f5] text-[#111418] text-sm font-bold leading-normal tracking-[0.015em] w-full"
            >
              <span class="truncate">Reschedule</span>
            </button>
          </div>
        </div>
        <div class="h-5 bg-white"></div>
      </div>
    `;

    // Add event listener for the back button
    const backBtn = document.getElementById('backToWorkerJobListBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Restore header elements
            if (workerNameEl) workerNameEl.textContent = `Hello, ${currentWorkerTechnicianName}`;
            if (workerCurrentDateEl) workerCurrentDateEl.style.display = 'block';
            const todaysRouteHeading = document.getElementById('todaysRouteHeading');
            if (todaysRouteHeading) todaysRouteHeading.style.display = 'block';
            renderWorkerPwaView(currentWorkerAssignedJobs, currentWorkerTechnicianName);
        });
    }

}


// --- UI Navigation ---
function switchView(targetId) {
    contentSections.forEach(section => section.classList.add('hidden'));
    const activeSection = document.getElementById(targetId);
    if (activeSection) activeSection.classList.remove('hidden');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.target === targetId) {
            link.classList.add('active');
            currentView = targetId;
        }
    });

    if (targetId === 'schedule') {
        loadTripSheetsForDate(tripSheetDateInput.value);
    }
    if (targetId === 'daniel') {
        chatInput.focus();
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(e.currentTarget.dataset.target);
    });
});

// --- Modal Logic ---
function openEditTechModal(tech) {
    if (!tech) return;
    document.getElementById('modalTechId').value = tech.id;
    document.getElementById('modalTechName').textContent = `Edit ${tech.name}`;
    document.getElementById('modalTechStatus').value = tech.status;
    document.getElementById('modalTechLocation').value = tech.currentLocation;
    document.getElementById('modalTechMaxJobs').value = tech.maxJobs;
    editTechModal.style.display = 'block';
}

function closeEditTechModal() {
    editTechModal.style.display = 'none';
    editTechForm.reset();
}

function openScheduleJobModal(job) {
    if (!job) return;
    document.getElementById('modalScheduleJobId').value = job.id;
    document.getElementById('modalScheduleCustomer').textContent = job.customer || 'N/A';
    document.getElementById('modalScheduleAddress').textContent = job.address || 'N/A';
    document.getElementById('modalScheduleIssue').textContent = job.issue || 'N/A';
    document.getElementById('modalScheduleWarrantyProvider').textContent = job.warrantyProvider || 'N/A';
    document.getElementById('modalSchedulePlanType').textContent = job.planType || 'N/A';
    document.getElementById('modalScheduleDispatchOrPoNumber').textContent = job.dispatchOrPoNumber || 'N/A';

    const dateInput = document.getElementById('modalJobDate');
    dateInput.value = job.scheduledDate || new Date().toISOString().split('T')[0];

    const timeSlotSelect = document.getElementById('modalJobTimeSlot');
    timeSlotSelect.value = job.timeSlot || "";

    scheduleJobModal.style.display = 'block';
}

function closeScheduleJobModal() {
    scheduleJobModal.style.display = 'none';
    scheduleJobForm.reset();
}

function openAddPartModal(item = null) {
    newPartForm.reset();
    const modalTitle = addPartModal.querySelector('.modal-header h2');
    const partEditIdField = document.getElementById('partEditId');

    if (item) { // Editing existing item
        modalTitle.textContent = 'Edit Inventory Part';
        savePartButton.textContent = 'Save Changes';
        partEditIdField.value = item.id;
        document.getElementById('partName').value = item.partName;
        document.getElementById('partSKU').value = item.sku;
        document.getElementById('partCategory').value = item.category || '';
        document.getElementById('partSupplier').value = item.supplier || '';
        document.getElementById('partStock').value = item.currentStock;
        document.getElementById('partReorderLevel').value = item.reorderLevel;
        document.getElementById('partUnitCost').value = item.unitCost;
        document.getElementById('partSKU').disabled = true;
    } else { // Adding new item
        modalTitle.textContent = 'Add New Inventory Part';
        savePartButton.textContent = 'Add Part';
        partEditIdField.value = '';
        document.getElementById('partSKU').disabled = false;
    }
    addPartModal.style.display = 'block';
}

function closeAddPartModal() {
    addPartModal.style.display = 'none';
    newPartForm.reset();
    document.getElementById('partSKU').disabled = false;
}

function openLogPartUsageModal() {
    logPartUsageForm.reset();
    logPartUsageModal.style.display = 'block';
}

function closeLogPartUsageModal() {
    logPartUsageModal.style.display = 'none';
    logPartUsageForm.reset();
}

// --- Firebase Logic ---
let db;
let auth;

async function initializeTechnicians() {
    const techCollection = firebase.firestore().collection('technicians');
    const snapshot = await techCollection.get();
    if (snapshot.empty) {
        const defaultTechnicians = [
            { name: 'Ibaidallah', status: 'Online', currentLocation: '1100 S Flower St, Los Angeles, CA 90015', maxJobs: 8 },
            { name: 'Khaled', status: 'Online', currentLocation: '4059 Van Nuys Blvd, Sherman Oaks, CA 91403', maxJobs: 5 },
            { name: 'Ahmed', status: 'Online', currentLocation: '189 The Grove Dr, Los Angeles, CA 90036', maxJobs: 5 },
            { name: 'Omar', status: 'Offline', currentLocation: 'Home Base', maxJobs: 5 }
        ];
        for (const tech of defaultTechnicians) {
            await firebase.firestore().collection('technicians').add(tech);
        }
    }
}

function listenForJobs() {
    const jobsQuery = firebase.firestore().collection("jobs").orderBy("createdAt", "desc");
    jobsQuery.onSnapshot((snapshot) => {
        allJobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Always attempt to render jobs; renderJobs has internal checks for DOM elements
        renderJobs(allJobsData); 
        
        if (currentView === 'dashboard') {
            listenForDashboardData(); // This will re-render dashboard stats if needed
        }
        if (currentView === 'schedule') {
            // Re-load trip sheets which might depend on updated job data for status
            loadTripSheetsForDate(tripSheetDateInput.value); 
        }
    }, (error) => {
        console.error("Error listening for jobs:", error);
    });
}

function listenForTechnicians() {
    const techQuery = firebase.firestore().collection("technicians");
    techQuery.onSnapshot((snapshot) => {
        const technicians = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTechniciansData = technicians;
        // Always attempt to render technicians; renderTechnicians has internal checks
        renderTechnicians(technicians); 
        
        populateTechnicianDropdowns();
        // If on dashboard, tech data might be relevant for map or other elements (future)
        // if (currentView === 'dashboard') { /* Potentially update dashboard elements */ }
    }, (error) => console.error("Error listening for technicians:", error));
}

async function initializeInventory() {
    const inventoryCollection = firebase.firestore().collection('inventoryItems');
    const snapshot = await inventoryCollection.get();
    if (snapshot.empty) {
        console.log("Inventory collection is empty. No default items will be added.");
    }
}

function listenForInventoryItems() {
    const inventoryQuery = firebase.firestore().collection("inventoryItems").orderBy("createdAt", "desc");
    inventoryQuery.onSnapshot((snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        inventoryItemsData = items;
        if (currentView === 'inventory') {
            renderInventory(items);
        }
    }, (error) => console.error("Error listening for inventory items:", error));
}

function listenForDashboardData() {
    const tripSheetsQuery = firebase.firestore().collection("tripSheets");
    tripSheetsQuery.onSnapshot((snapshot) => {
        const tripSheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboardStats(allJobsData, tripSheets);
    }, (error) => {
        console.error("Error listening for trip sheets for dashboard:", error);
    });
}

function listenForWorkerJobs(technicianId, technicianName) {
    if (workerJobsListener) {
        workerJobsListener(); // Detach any previous listener
    }
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDateString = `${year}-${month}-${day}`;

    const jobsQuery = firebase.firestore().collection("jobs")
        .where("assignedTechnicianId", "==", technicianId)
        .where("status", "==", "Awaiting completion")
        .where("scheduledDate", "==", todayDateString);

    workerJobsListener = jobsQuery.onSnapshot((snapshot) => {
        const assignedJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allJobsData = assignedJobs;
        renderWorkerPwaView(assignedJobs, technicianName);
    }, (error) => {
        console.error(`Error listening for jobs for technician ${technicianId}:`, error);
        if (workerTodaysRouteEl) {
            workerTodaysRouteEl.innerHTML = `<div class="text-center p-8 text-red-500"><p>Error loading your jobs. Please try again later.</p></div>`;
        }
    });
}


// --- Form Submit Handlers & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // This is the main entry point after the page loads.
    // All form listeners and event handlers that need DOM elements will be set up here.
    const adminNavHomeBtn = document.getElementById('adminNavHomeBtn');
    const adminNavWorkersBtn = document.getElementById('adminNavWorkersBtn');
    const adminNavAddBtn = document.getElementById('adminNavAddBtn');
    const adminNavInvoicesBtn = document.getElementById('adminNavInvoicesBtn');
    const adminNavSettingsBtn = document.getElementById('adminNavSettingsBtn');
    const createInvoiceBtnHome = document.getElementById('createInvoiceBtnHome');
    const settingsBtnWorker = document.getElementById('settingsBtnWorker');
    const seeAllAdminDashboard = document.getElementById('seeAllAdminDashboard');
    const backToMainViewBtn = document.getElementById('backToMainViewBtn');
    const backToCurrentHomeBtn = document.getElementById('backToCurrentHomeBtn');
    const addItemBtn = document.getElementById('addItemBtn');
    const laborInput = document.getElementById('labor');
    const serviceCallInput = document.getElementById('serviceCall');
    const customTaxRateInput = document.getElementById('customTaxRate');
    const countyTaxRadios = document.querySelectorAll('input[name="countyTax"]');
    const paymentMethodRadioGroup = document.getElementById('paymentMethodRadioGroup');
    const chequeNumberArea = document.getElementById('chequeNumberArea');
    const chequeNumberInput = document.getElementById('chequeNumber');
    const saveInvoiceBtn = document.getElementById('saveInvoiceBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalMarkPaidBtn = document.getElementById('modalMarkPaidBtn');
    const modalDownloadPdfBtn = document.getElementById('modalDownloadPdfBtn');
    const modalWorkerCloseBtn = document.getElementById('modalWorkerCloseBtn');
    const modalRemoveWorkerBtn = document.getElementById('modalRemoveWorkerBtn');
    const showAllInvoicesBtn = document.getElementById('showAllInvoicesBtn');
    const backToWorkerSelectBtn = document.getElementById('backToWorkerSelectBtn');
    const filterTabs = document.querySelectorAll('#adminInvoicesScreen .filter-tabs button');
    const invoiceYearFilter = document.getElementById('invoiceYearFilter');
    const applyDateFiltersBtn = document.getElementById('applyDateFiltersBtn');
    const adminInvoiceSearchInput = document.getElementById('adminInvoiceSearchInput');
    const addWorkerForm = document.getElementById('addWorkerForm');

    if(createInvoiceBtnHome) createInvoiceBtnHome.addEventListener('click', () => showInvoiceFormScreen());
    if(settingsBtnWorker) settingsBtnWorker.addEventListener('click', showSettingsScreen);
    
    if (signatureCanvas) {
        signaturePad = new SignaturePad(signatureCanvas, {
            backgroundColor: 'rgb(255, 255, 255)'
        });
    }

    function resizeCanvas() {
        if (!signatureCanvas || !signaturePad) {
            return;
        }

        const container = signatureCanvas.parentElement;
        if (!container) return;

        // Delay getting container width until it's actually visible
        requestAnimationFrame(() => {
            const containerWidth = container.offsetWidth;
            if (containerWidth === 0) return; // Still not visible

            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            
            signatureCanvas.width = containerWidth * ratio;
            signatureCanvas.height = 150 * ratio; // Fixed height
            signatureCanvas.getContext("2d").scale(ratio, ratio);

            signaturePad.clear(); // Reclears the canvas after resizing
        });
    }

    window.addEventListener("resize", resizeCanvas);
    
    // We will call resizeCanvas() when the invoice screen is actually shown,
    // not just on initial DOM load. This is handled in the `showInvoiceScreen` function.

    if (clearSignatureBtn) {
        clearSignatureBtn.addEventListener('click', () => {
            if (signaturePad) {
                signaturePad.clear();
            }
        });
    }

    if(confirmSignatureBtn) {
        confirmSignatureBtn.addEventListener('click', () => {
            if (signaturePad && !signaturePad.isEmpty()) {
                const signaturePadContainer = document.querySelector('.signature-pad-container');
                const customerNameInput = document.getElementById('customerName');
                const signedByName = document.getElementById('signedByName');
                
                if (!signaturePadContainer || !previewSignatureImg || !signedBySection || !clearSignatureBtn || !editSignatureBtn || !customerNameInput || !signedByName) {
                    return;
                }

                confirmedSignatureDataURL = signaturePad.toDataURL();
                previewSignatureImg.src = confirmedSignatureDataURL;
                previewSignatureImg.classList.remove('hidden');
                signaturePadContainer.classList.add('hidden');
                
                const customerName = customerNameInput.value.trim();
                signedByName.textContent = customerName || "Customer";
                signedBySection.classList.remove('hidden');
                
                confirmSignatureBtn.classList.add('hidden');
                clearSignatureBtn.classList.add('hidden');
                editSignatureBtn.classList.remove('hidden');
                
                setFormEditable(false); // Lock the form
            } else {
                showMessage("Please provide a signature first.", "error");
            }
        });
    }

    const editSignatureBtn = document.getElementById('editSignatureBtn');
    if(editSignatureBtn) {
        editSignatureBtn.addEventListener('click', () => {
            editSignature();
        });
    }

    function editSignature() {
        signaturePadContainer.classList.remove('hidden');
        previewSignatureImg.classList.add('hidden');
        clearSignatureBtn.classList.remove('hidden');
        confirmSignatureBtn.classList.remove('hidden');
        editSignatureBtn.classList.add('hidden');
        
        setFormEditable(true);
        confirmedSignatureDataURL = null;
        if (signedBySection) signedBySection.classList.add('hidden');
    }

    if(seeAllAdminDashboard) seeAllAdminDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        showInvoiceListScreen(); // No filter options means show all
    });


    if(backToMainViewBtn) backToMainViewBtn.addEventListener('click', () => {
        console.log(`Settings Back button clicked. previousAppView: ${previousAppView}, currentAdminScreen: ${currentAdminScreen}`);
        if (currentUser && currentUser.type === 'admin') {
            if (currentAdminScreen === 'invoicesList') showAdminInvoiceWorkerSelectScreen();
            else if (currentAdminScreen === 'workers') showAdminWorkersScreen();
            else showAdminHomeScreen();
        } else { // Worker
            showWorkerHomeScreen();
        }
    });
    
    if(backToCurrentHomeBtn) backToCurrentHomeBtn.addEventListener('click', () => {
        console.log(`Invoice Form Back button clicked. currentAppView: ${currentAppView}, currentAdminScreen: ${currentAdminScreen}`);
        if (currentUser && currentUser.type === 'admin') {
            if (currentAdminScreen === 'invoicesList') showInvoiceListScreen({ worker: currentFilteredWorker });
            else if(currentAdminScreen === 'invoiceWorkerSelect') showAdminInvoiceWorkerSelectScreen();
            else if (currentAdminScreen === 'workers') showAdminWorkersScreen();
            else showAdminHomeScreen();
        } else { // Worker goes to worker home
            showWorkerHomeScreen();
        }
    });

    if(addItemBtn) addItemBtn.addEventListener('click', () => addLineItem());
    
    if(laborInput) laborInput.addEventListener('input', updateTotals);
    if(serviceCallInput) serviceCallInput.addEventListener('input', updateTotals);

    if (customTaxRateInput) {
        customTaxRateInput.addEventListener('input', function() {
            const otherRadio = document.querySelector('input[name="countyTax"][value="Other"]');
            if (otherRadio && otherRadio.checked) {
                const customRate = parseFloat(this.value) || 0;
                if (salesTaxRateInput) {
                    salesTaxRateInput.value = customRate.toFixed(2);
                }
                updateTotals();
            }
        });
    }
    
    // Event listener for County Tax Radio Buttons
    countyTaxRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (isFormLocked) {
                const previouslySelected = Array.from(countyTaxRadios).find(r => r.dataset.wasChecked === 'true');
                if (previouslySelected && previouslySelected !== this) {
                    previouslySelected.checked = true; 
                    this.checked = false;
                }
                return;
            }
            
            if (this.value === 'Other') {
                customTaxArea.classList.remove('hidden');
                salesTaxRateInput.value = (parseFloat(customTaxRateInput.value) || 0).toFixed(2);
            } else {
                customTaxArea.classList.add('hidden');
                if (this.checked) {
                    const rate = parseFloat(this.dataset.rate);
                    if (salesTaxRateInput) {
                        salesTaxRateInput.value = rate.toFixed(2);
                    }
                }
            }
            updateTotals();
            countyTaxRadios.forEach(r => r.dataset.wasChecked = (r === this) ? 'true' : 'false');
        });
    });

    if (paymentMethodRadioGroup) {
        paymentMethodRadioGroup.addEventListener('change', function(e) {
            if (e.target.name === 'paymentMethod') {
                if (e.target.value === 'Cheque') {
                    chequeNumberArea.classList.remove('hidden');
                    chequeNumberInput.required = true;
                } else {
                    chequeNumberArea.classList.add('hidden');
                    chequeNumberInput.required = false;
                }
            }
        });
    }

    if(saveInvoiceBtn) saveInvoiceBtn.addEventListener('click', async function() {
        const paymentMethodRadio = document.querySelector('input[name="paymentMethod"]:checked');
        if (!paymentMethodRadio) {
            showMessage("A payment method is required.", "error");
            document.getElementById('paymentMethodRadioGroup').scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (paymentMethodRadio.value === 'Cheque' && !chequeNumberInput.value.trim()) {
            showMessage("Cheque # is required for cheque payments.", "error");
            chequeNumberInput.focus();
            return;
        }
        
        if (!invoiceFormEl.checkValidity()) {
             showMessage("Please fill out all required fields.", "error");
             invoiceFormEl.reportValidity();
             return;
        }

        const dataToSave = collectInvoiceData("PENDING");
        pendingInvoices.push(dataToSave);
        showMessage('Invoice added to queue.', 'success');
        showAfterSendInvoiceScreen();
    });
    

    if(clearFormBtn) clearFormBtn.addEventListener('click', () => {
        showConfirmationModal(
            "Clear Form",
            "Are you sure you want to clear the form? Unsaved data will be lost.",
            () => {
                if(invoiceFormEl) invoiceFormEl.reset();
                setFormEditable(true); 
                if(customTaxArea) customTaxArea.classList.add('hidden');
                if(chequeNumberArea) chequeNumberArea.classList.add('hidden');

                if(invoiceNumberDisplay) { 
                    invoiceNumberDisplay.value = "Loading next...";
                     db.collection('counters').doc('invoiceCounter').get().then(counterDoc => {
                        let nextNumber = 1;
                        if (counterDoc.exists && counterDoc.data().lastNumber) {
                            nextNumber = counterDoc.data().lastNumber + 1;
                        }
                        invoiceNumberDisplay.value = formatInvoiceNumber(nextNumber);
                    }).catch(err => {
                        console.error("Error re-fetching next invoice number on clear:", err);
                        invoiceNumberDisplay.value = "Error loading #";
                    });
                }
                if(lineItemsContainer) lineItemsContainer.innerHTML = '';
                lineItemCount = 0;
                setInitialDate();
                addLineItem();
                if (salesTaxRateInput) { 
                    salesTaxRateInput.value = "0.00";
                }
                updateTotals();
                currentEditingInvoiceId = null; 
                if(invoiceFormTitle) invoiceFormTitle.textContent = "New Invoice";
                if(document.getElementById('nonCoveredItemsText')) document.getElementById('nonCoveredItemsText').value = '';
                
                confirmedSignatureDataURL = null;
                if(signaturePad) {
                    signaturePad.clear();
                    signaturePad.on();
                }
                if(previewSignatureImg) {
                    previewSignatureImg.classList.add('hidden');
                    previewSignatureImg.src = '#';
                }
                if(signaturePadContainer) signaturePadContainer.classList.remove('hidden');
                if(signedBySection) signedBySection.classList.add('hidden');
                if(confirmSignatureBtn) confirmSignatureBtn.classList.remove('hidden');
                if(clearSignatureBtn) clearSignatureBtn.classList.remove('hidden');
                
                const editSignatureBtn = document.getElementById('editSignatureBtn');
                if(editSignatureBtn) editSignatureBtn.classList.add('hidden');


                if(signatureLoadingMessage) signatureLoadingMessage.classList.remove('hidden');
                requestAnimationFrame(() => {
                    if (signaturePadContainer && signaturePadContainer.offsetParent !== null) {
                       resizeCanvas();
                    }
                    if(signatureLoadingMessage) signatureLoadingMessage.classList.add('hidden');
                });

                showMessage('Form cleared.', 'success');
            }
        );
    });

    if(downloadPdfBtn) downloadPdfBtn.addEventListener('click', async () => {
        showMessage("Please save the invoice first to generate and download the PDF.", "info");
    });

    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeInvoiceViewModal);
    
    if(modalMarkPaidBtn) modalMarkPaidBtn.addEventListener('click', async function() {
        if (currentlyViewedInvoiceData) {
            const newStatus = currentlyViewedInvoiceData.status === 'paid' ? 'pending' : 'paid';
            let invoiceToUpdate = { ...currentlyViewedInvoiceData, status: newStatus, updatedAt: new Date().toISOString() };
            
            const updatedPdfData = generatePDF(invoiceToUpdate);

            if (updatedPdfData) {
                invoiceToUpdate.pdfDataURL = updatedPdfData;
            } else {
                console.warn("[Modal Mark Paid] Could not re-generate PDF on status change. Old PDF data (if any) will be kept.");
            }

            if (await saveInvoiceData(invoiceToUpdate, true, currentlyViewedInvoiceData.id)) { 
                showMessage(`Invoice #${currentlyViewedInvoiceData.invoiceNumber} marked as ${newStatus}.`, 'success');
                allAdminInvoicesCache = [];
                closeInvoiceViewModal(); 
            }
        }
    });
    
    if(modalDownloadPdfBtn) modalDownloadPdfBtn.addEventListener('click', async function() {
        if (currentlyViewedInvoiceData && currentlyViewedInvoiceData.pdfDataURL) {
            await triggerPdfDownload(currentlyViewedInvoiceData.pdfDataURL, `Safeway-Invoice-${currentlyViewedInvoiceData.invoiceNumber || 'draft'}.pdf`);
        } else if (currentlyViewedInvoiceData) {
            const pdfData = generatePDF(currentlyViewedInvoiceData);
            if (pdfData) {
                currentlyViewedInvoiceData.pdfDataURL = pdfData;
                if (await saveInvoiceData(currentlyViewedInvoiceData, true, currentlyViewedInvoiceData.id)) { 
                     await triggerPdfDownload(pdfData, `Safeway-Invoice-${currentlyViewedInvoiceData.invoiceNumber || 'draft'}.pdf`);
                     allAdminInvoicesCache = [];
                } else {
                    showMessage('Failed to update invoice with new PDF before download.', 'error');
                }
            } else {
                showMessage('Failed to generate PDF for download.', 'error');
            }
        } else {
            showMessage('No invoice data to download PDF.', 'error');
        }
    });
    if(modalWorkerCloseBtn) modalWorkerCloseBtn.addEventListener('click', closeWorkerDetailModal);
    if(modalRemoveWorkerBtn) modalRemoveWorkerBtn.addEventListener('click', function() {
        console.log("Modal Remove Worker button clicked. currentlySelectedWorker:", currentlySelectedWorker);
        if (currentlySelectedWorker) {
             removeWorker(currentlySelectedWorker); 
        }
    });


    // Main Navigation Handlers
    if(adminNavHomeBtn) adminNavHomeBtn.addEventListener('click', () => showAdminHomeScreen());
    if(adminNavWorkersBtn) adminNavWorkersBtn.addEventListener('click', () => showAdminWorkersScreen());
    if(adminNavAddBtn) adminNavAddBtn.addEventListener('click', () => showInvoiceFormScreen());
    if(adminNavInvoicesBtn) adminNavInvoicesBtn.addEventListener('click', () => showAdminInvoiceWorkerSelectScreen());
    if(adminNavSettingsBtn) adminNavSettingsBtn.addEventListener('click', showSettingsScreen);

    // Invoice List Screen Handlers
    if(showAllInvoicesBtn) showAllInvoicesBtn.addEventListener('click', () => showInvoiceListScreen());
    if(backToWorkerSelectBtn) backToWorkerSelectBtn.addEventListener('click', () => showAdminInvoiceWorkerSelectScreen());


    if (filterTabs && filterTabs.length > 0) {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                console.log(`Filter tab clicked: ${this.dataset.filter}`);
                filterTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                loadAdminInvoicesListData(); 
            });
        });
    } else {
        console.warn("Filter tabs not found or empty, event listeners not attached.");
    }
    
    if (invoiceYearFilter) {
        invoiceYearFilter.addEventListener('change', () => {
            populateMonthFilter();
        });
    }
    if (applyDateFiltersBtn) {
        applyDateFiltersBtn.addEventListener('click', () => {
            loadAdminInvoicesListData();
        });
    }
    
    let searchTimeout;
    if(adminInvoiceSearchInput) adminInvoiceSearchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadAdminInvoicesListData();
        }, 500); 
    });
    if(addWorkerForm) addWorkerForm.addEventListener('submit', handleAddWorker);

    // Modal Close/Cancel Buttons
    if(closeEditTechModalBtn) closeEditTechModalBtn.addEventListener('click', closeEditTechModal);
    if(cancelEditTechBtn) cancelEditTechBtn.addEventListener('click', closeEditTechModal);
    if(closeScheduleJobModalBtn) closeScheduleJobModalBtn.addEventListener('click', closeScheduleJobModal);
    if(cancelScheduleJobBtn) cancelScheduleJobBtn.addEventListener('click', closeScheduleJobModal);
    if(closeAddJobModalButton) closeAddJobModalButton.addEventListener('click', () => addJobModal.style.display = 'none');
    if(cancelAddJobButton) cancelAddJobButton.addEventListener('click', () => addJobModal.style.display = 'none');
    if(closeAddPartModalButton) closeAddPartModalButton.addEventListener('click', closeAddPartModal);
    if(cancelAddPartButton) cancelAddPartButton.addEventListener('click', closeAddPartModal);
    if(closeLogPartUsageModalButton) closeLogPartUsageModalButton.addEventListener('click', closeLogPartUsageModal);
    if(cancelLogPartUsageButton) cancelLogPartUsageButton.addEventListener('click', closeLogPartUsageModal);
    
    // Modal Open Buttons
    if(openAddJobModalButton) openAddJobModalButton.addEventListener('click', () => {
        addJobModal.style.display = 'block';
        const saveJobButton = document.getElementById('saveJobButton');
        if(saveJobButton) {
            saveJobButton.disabled = false;
            saveJobButton.textContent = 'Save Job';
        }
        newJobForm.reset();
    });
    if(openAddPartModalButton) openAddPartModalButton.addEventListener('click', () => openAddPartModal());
    if(openLogPartUsageButton) openLogPartUsageButton.addEventListener('click', openLogPartUsageModal);

    // Form Submissions
    if(editTechForm) editTechForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const techId = document.getElementById('modalTechId').value;
        const techRef = firebase.firestore().doc(`technicians/${techId}`);
        const updatedData = {
            status: document.getElementById('modalTechStatus').value,
            currentLocation: document.getElementById('modalTechLocation').value,
            maxJobs: parseInt(document.getElementById('modalTechMaxJobs').value, 10)
        };
        try {
            await techRef.update(updatedData);
            closeEditTechModal();
        } catch (error) {
            console.error("Error updating technician:", error);
        }
    });

    if(scheduleJobForm) scheduleJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const jobId = document.getElementById('modalScheduleJobId').value;
        const jobRef = firebase.firestore().doc(`jobs/${jobId}`);
        const updatedData = {
            status: 'Scheduled',
            scheduledDate: document.getElementById('modalJobDate').value,
            timeSlot: document.getElementById('modalJobTimeSlot').value
        };
        try {
            await jobRef.update(updatedData);
            closeScheduleJobModal();
        } catch (error) {
            console.error("Error scheduling job:", error);
        }
    });
    
    if(newJobForm) newJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveJobButton = document.getElementById('saveJobButton');
        if (saveJobButton.disabled) return;
        saveJobButton.disabled = true;
        saveJobButton.textContent = 'Saving...';
        const jobData = {
            customer: document.getElementById('jobCustomer').value,
            address: document.getElementById('jobAddress').value,
            issue: document.getElementById('jobIssue').value,
            phone: document.getElementById('jobPhone').value,
            status: 'Needs Scheduling',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await firebase.firestore().collection('jobs').add(jobData);
            addJobModal.style.display = 'none';
            newJobForm.reset();
        } catch (error) {
            console.error("Error adding new job:", error);
            alert(`Error adding job: ${error.message}`);
        } finally {
            saveJobButton.disabled = false;
            saveJobButton.textContent = 'Save Job';
        }
    });
    
    if(newPartForm) newPartForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const partEditId = document.getElementById('partEditId').value;
        const partData = {
            partName: document.getElementById('partName').value,
            sku: document.getElementById('partSKU').value,
            category: document.getElementById('partCategory').value,
            supplier: document.getElementById('partSupplier').value,
            currentStock: parseInt(document.getElementById('partStock').value, 10),
            reorderLevel: parseInt(document.getElementById('partReorderLevel').value, 10),
            unitCost: parseFloat(document.getElementById('partUnitCost').value),
        };

        try {
            if (partEditId) {
                const partRef = firebase.firestore().doc(`inventoryItems/${partEditId}`);
                await partRef.update(partData);
            } else {
                const skuQuery = firebase.firestore().collection("inventoryItems").where("sku", "==", partData.sku);
                const skuSnapshot = await skuQuery.get();
                if (!skuSnapshot.empty) {
                    alert(`Error: SKU "${partData.sku}" already exists. Please use a unique SKU.`);
                    return;
                }
                partData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await firebase.firestore().collection('inventoryItems').add(partData);
            }
            closeAddPartModal();
        } catch (error) {
            console.error("Error saving part:", error);
            alert(`Error saving part: ${error.message}`);
        }
    });

    if(logPartUsageForm) logPartUsageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const skuToLog = document.getElementById('usagePartSKU').value;
        const quantityUsed = parseInt(document.getElementById('usageQuantity').value, 10);
        const technicianId = document.getElementById('usageTechnician').value;
        const jobId = document.getElementById('usageJobId').value;

        if (quantityUsed <= 0) {
            alert("Quantity used must be greater than zero.");
            return;
        }

        const itemToUpdate = inventoryItemsData.find(item => item.sku === skuToLog);

        if (!itemToUpdate) {
            alert(`Part with SKU "${skuToLog}" not found.`);
            return;
        }

        if (itemToUpdate.currentStock < quantityUsed) {
            alert(`Not enough stock for SKU "${skuToLog}". Available: ${itemToUpdate.currentStock}, Tried to use: ${quantityUsed}`);
            return;
        }
        
        const newStock = itemToUpdate.currentStock - quantityUsed;
        const partRef = firebase.firestore().doc(`inventoryItems/${itemToUpdate.id}`);

        try {
            await partRef.update({ currentStock: newStock });
            
            await firebase.firestore().collection('inventoryUsageLog').add({
                sku: skuToLog,
                partName: itemToUpdate.partName,
                quantityUsed: quantityUsed,
                technicianId: technicianId, 
                jobId: jobId || null,
                loggedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            closeLogPartUsageModal();
        } catch (error) {
            console.error("Error logging part usage:", error);
            alert(`Error logging part usage: ${error.message}`);
        }
    });

    // Event Delegation for dynamic buttons
    document.body.addEventListener('click', function(event) {
        if (event.target.classList.contains('manage-tech-btn')) {
            const techId = event.target.dataset.id;
            const techData = allTechniciansData.find(t => t.id === techId);
            if(techData) openEditTechModal(techData);
        }
        if (event.target.classList.contains('schedule-job-btn')) {
            const jobId = event.target.dataset.id;
            const jobData = allJobsData.find(j => j.id === jobId);
            if(jobData) openScheduleJobModal(jobData);
        }
        if (event.target.classList.contains('edit-part-btn')) {
            const partId = event.target.dataset.id;
            const partData = inventoryItemsData.find(p => p.id === partId);
            if(partData) openAddPartModal(partData); 
        }
        if (event.target.classList.contains('create-invoice-btn')) {
            const jobId = event.target.dataset.id;
            showInvoiceScreen(jobId);
        }
        if (event.target.classList.contains('view-warranty-btn')) {
            const warrantyId = event.target.dataset.id;
            const warrantyData = allWarrantiesData.find(w => w.id === warrantyId);
            if(warrantyData) openWarrantyDetailModal(warrantyData);
        }
    });

    const modalWarrantyInvoicesContainer = document.getElementById('modalWarrantyInvoicesContainer');
    if (modalWarrantyInvoicesContainer) {
        modalWarrantyInvoicesContainer.addEventListener('click', (event) => {
            event.preventDefault(); 
            const card = event.target.closest('.invoice-pressable-card');
            if (card) {
                const warrantyId = card.dataset.warrantyId;
                const invoiceNumber = card.dataset.invoiceNumber;
                const warranty = allWarrantiesData.find(w => w.id === warrantyId);
                const invoice = warranty?.invoices.find(i => i.invoiceNumber === invoiceNumber);
                if (warranty && invoice) {
                    closeModal(warrantyDetailModal); // Close the job modal first
                    openInvoiceDetailOverlay(warranty, invoice);
                }
            }
        });
    }

    const providerCardsContainer = document.getElementById('provider-cards-container');
    if (providerCardsContainer) {
        providerCardsContainer.addEventListener('click', (event) => {
            const card = event.target.closest('.provider-card');
            if (card) {
                const providerName = card.dataset.provider;
                openProviderClaimsWorkspace(providerName, allWarrantiesData);
            }
        });
    }

    const viewAllInvoicesBtn = document.getElementById('viewAllInvoicesBtn');
    if (viewAllInvoicesBtn) {
        viewAllInvoicesBtn.addEventListener('click', () => {
            openTechnicianSelectionOverlay();
        });
    }

    const technicianSelectionCards = document.getElementById('technicianSelectionCards');
    if (technicianSelectionCards) {
        technicianSelectionCards.addEventListener('click', (event) => {
            const card = event.target.closest('.tech-selection-card');
            if (card) {
                const techName = card.dataset.technician;
                closeOverlay(technicianSelectionOverlay);
                openAllJobsOverlay(currentFilteredData, techName);
            }
        });
    }

    const warrantyDetailModal = document.getElementById('warrantyDetailModal');
    if (warrantyDetailModal) {
        warrantyDetailModal.querySelectorAll('.close-button').forEach(btn => btn.addEventListener('click', () => closeModal(warrantyDetailModal)));
    }
    
    const providerInvoiceListOverlay = document.getElementById('providerInvoiceListOverlay');
    const fullscreenCloseBtn = document.getElementById('fullscreenCloseBtn');
    if (fullscreenCloseBtn) {
        fullscreenCloseBtn.addEventListener('click', () => closeOverlay(providerInvoiceListOverlay));
    }
    
    const invoiceDetailOverlay = document.getElementById('invoiceDetailOverlay');
    const invoiceDetailCloseBtn = document.getElementById('invoiceDetailCloseBtn');
    if (invoiceDetailCloseBtn) {
        invoiceDetailCloseBtn.addEventListener('click', () => closeOverlay(invoiceDetailOverlay));
    }

    const allJobsOverlay = document.getElementById('allJobsOverlay');
    const allJobsCloseBtn = document.getElementById('allJobsCloseBtn');
    if (allJobsCloseBtn) {
        allJobsCloseBtn.addEventListener('click', () => closeOverlay(allJobsOverlay));
    }

    const technicianSelectionOverlay = document.getElementById('technicianSelectionOverlay');
    const technicianSelectionCloseBtn = document.getElementById('technicianSelectionCloseBtn');
    if (technicianSelectionCloseBtn) {
        technicianSelectionCloseBtn.addEventListener('click', () => closeOverlay(technicianSelectionOverlay));
    }

    // --- DATE FILTER LOGIC ---
    const dateFilterToggle = document.getElementById('dateFilterToggle');
    const dateFilterPopup = document.getElementById('dateFilterPopup');

    if (dateFilterToggle) {
        dateFilterToggle.addEventListener('click', () => {
            dateFilterPopup.classList.toggle('is-visible');
        });
    }

    document.addEventListener('click', (event) => {
        if (dateFilterToggle && dateFilterPopup && !dateFilterToggle.contains(event.target) && !dateFilterPopup.contains(event.target)) {
            dateFilterPopup.classList.remove('is-visible');
        }
    });

    const presetsContainer = document.getElementById('date-filter-presets');
    if (presetsContainer) {
        presetsContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') {
                presetsContainer.querySelectorAll('.date-filter-btn').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
                document.getElementById('activeFilterDisplay').textContent = event.target.textContent;
                dateFilterPopup.classList.remove('is-visible');

                const range = event.target.dataset.range;
                if (range === 'all') {
                    updateDashboard(allWarrantiesData);
                    return;
                }

                const days = parseInt(range, 10);
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - days);
                
                const filteredData = allWarrantiesData.filter(w => {
                    const completionDate = w.completionDate?.toDate();
                    return completionDate && completionDate >= startDate && completionDate <= endDate;
                });
                updateDashboard(filteredData);
            }
        });
    }

    const applyDateRange = document.getElementById('applyDateRange');
    if (applyDateRange) {
        applyDateRange.addEventListener('click', () => {
            presetsContainer.querySelectorAll('.date-filter-btn').forEach(btn => btn.classList.remove('active'));
            const fromDateStr = document.getElementById('dateFrom').value;
            const toDateStr = document.getElementById('dateTo').value;

            if (!fromDateStr || !toDateStr) {
                alert("Please select both a 'From' and 'To' date.");
                return;
            }
            
            document.getElementById('activeFilterDisplay').textContent = `Custom Range`;
            dateFilterPopup.classList.remove('is-visible');

            const startDate = new Date(fromDateStr);
            const endDate = new Date(toDateStr);
            endDate.setHours(23, 59, 59, 999);

            const filteredData = allWarrantiesData.filter(w => {
                const completionDate = w.completionDate?.toDate();
                return completionDate && completionDate >= startDate && completionDate <= endDate;
            });
            updateDashboard(filteredData);
        });
    }

    // --- CLAIMS PROCESSING LOGIC ---
    const claimsWorkspace = document.getElementById('claimsWorkspace');
    if (claimsWorkspace) {
        claimsWorkspace.addEventListener('click', async (event) => {
            const processBtn = event.target.closest('.process-claim-btn');
            if (processBtn) {
                const card = processBtn.closest('.invoice-card');
                const warrantyId = card.dataset.warrantyId;
                const invoiceNumber = card.dataset.invoiceNumber;
                const claimsEmail = document.getElementById('claimsEmailInput').value;

                if (!claimsEmail || !claimsEmail.includes('@')) {
                    alert('Please enter a valid email address for claims submission.');
                    return;
                }

                if (confirm(`This will submit invoice #${invoiceNumber} for processing to ${claimsEmail}. Proceed?`)) {
                    processBtn.textContent = 'Processing...';
                    processBtn.disabled = true;

                    const warrantyToUpdate = allWarrantiesData.find(w => w.id === warrantyId);
                    if (warrantyToUpdate && warrantyToUpdate.invoices) {
                        const invoiceIndex = warrantyToUpdate.invoices.findIndex(inv => inv.invoiceNumber === invoiceNumber);
                        if (invoiceIndex !== -1) {
                            // FIX: Set status to 'processing' and add the email
                            warrantyToUpdate.invoices[invoiceIndex].status = 'processing';
                            warrantyToUpdate.invoices[invoiceIndex].claimsEmail = claimsEmail;
                            
                            const warrantyRef = db.collection('warranties').doc(warrantyId);
                            try {
                                await warrantyRef.update({ invoices: warrantyToUpdate.invoices });
                                // The front-end's job is now done. The backend will handle the rest.
                            } catch (error) {
                                console.error("Failed to update invoice status:", error);
                                alert("Failed to start the claim process. Please try again.");
                                // Re-enable the button if the update fails
                                processBtn.textContent = 'Process Claim';
                                processBtn.disabled = false;
                            }
                        }
                    }
                }
            }
        });
    }

    const processAllBtn = document.getElementById('processAllBtn');
    if (processAllBtn) {
        processAllBtn.addEventListener('click', async () => {
            const processAllBtn = document.getElementById('processAllBtn');
            const claimsEmail = document.getElementById('claimsEmailInput').value;

            if (!claimsEmail || !claimsEmail.includes('@')) {
                alert('Please enter a valid email address for claims submission.');
                return;
            }
            
            const providerKey = currentProvider.toLowerCase();
            const unclaimedWarranties = allWarrantiesData
                .filter(w => {
                    const pName = w.job?.warrantyProvider?.toLowerCase() || 'other';
                    if (providerKey === 'first american') return pName.includes('first american');
                    if (providerKey === 'home guard') return pName.includes('home guard');
                    if (providerKey === 'others') return !pName.includes('first american') && !pName.includes('home guard');
                    return false;
                })
                .filter(w => w.invoices?.some(inv => inv.status !== 'paid'));
            
            const unclaimedCount = unclaimedWarranties.reduce((sum, w) => sum + w.invoices.filter(i => i.status !== 'paid').length, 0);

            if (unclaimedCount === 0) {
                alert('No unclaimed invoices to process.');
                return;
            }

            if (confirm(`This will process ${unclaimedCount} unclaimed invoices for ${currentProvider}. Proceed?`)) {
                processAllBtn.textContent = 'Processing...';
                processAllBtn.disabled = true;

                const batch = db.batch();
                unclaimedWarranties.forEach(warrantyDoc => {
                    const updatedInvoices = warrantyDoc.invoices.map(inv => inv.status !== 'paid' ? { ...inv, status: 'paid' } : inv);
                    const warrantyRef = db.collection('warranties').doc(warrantyDoc.id);
                    batch.update(warrantyRef, { invoices: updatedInvoices });
                });

                try {
                    await batch.commit();
                    console.log(`Successfully processed ${unclaimedCount} invoices.`);
                } catch (error) {
                    console.error("Error processing all claims:", error);
                    alert("An error occurred while processing claims. Please try again.");
                } finally {
                    processAllBtn.textContent = 'Process All';
                    processAllBtn.disabled = false;
                }
            }
        });
    }
    
    // Search logic for All Jobs overlay
    const jobsSearchInput = document.getElementById('jobsSearchInput');
    if (jobsSearchInput) {
        jobsSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.getElementById('allJobsTableBody').getElementsByTagName('tr');
            Array.from(rows).forEach(row => {
                const rowText = row.textContent.toLowerCase();
                row.style.display = rowText.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    if (workerTodaysRouteEl) {
        workerTodaysRouteEl.addEventListener('click', (event) => {
            const jobItem = event.target.closest('.worker-job-item');
            if (jobItem) {
                const jobId = jobItem.dataset.id;
                const jobData = currentWorkerAssignedJobs.find(j => j.id === jobId);
                if (jobData) {
                    showWorkerJobDetails(jobData);
                }
            }

            const createInvoiceButton = event.target.closest('#createInvoiceBtn');
            if (createInvoiceButton) {
                const jobId = createInvoiceButton.dataset.id;
                if (jobId) {
                    showInvoiceScreen(jobId);
                }
            }
        });
    }
    
    // Close modals on outside click
    window.addEventListener('click', (event) => {
        if (event.target == editTechModal) closeEditTechModal();
        if (event.target == scheduleJobModal) closeScheduleJobModal();
        if (event.target == addPartModal) closeAddPartModal();
        if (event.target == logPartUsageModal) closeLogPartUsageModal();
        if (event.target == addJobModal) addJobModal.style.display = 'none';
        if (event.target == warrantyDetailModal) warrantyDetailModal.style.display = 'none';
    });

    // Logout Buttons
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                console.log("Admin user signed out successfully.");
            } catch (error) {
                console.error("Sign out error:", error);
            }
        });
    }
    if (workerLogoutBtn) {
        workerLogoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                console.log("Worker user signed out successfully.");
            } catch (error) {
                console.error("Sign out error:", error);
            }
        });
    }

    // Trip Sheet Logic
    if(generateTripSheetsBtn) generateTripSheetsBtn.addEventListener('click', async () => {
        const selectedDate = tripSheetDateInput.value;
        if (!selectedDate) {
            alert("Please select a date for the trip sheets.");
            tripSheetDateInput.focus();
            return;
        }

        generateTripSheetsBtn.disabled = true;
        generateTripSheetsBtn.innerHTML = `<span class="material-icons-outlined text-lg animate-spin">sync</span> Generating...`;
        scheduleStatus.textContent = `Generating trip sheets for ${selectedDate}. This may take a moment.`;
        tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-slate-400"><span class="material-icons-outlined text-4xl animate-spin">settings</span><p>Optimizing routes for ${selectedDate}...</p></div>`;
        tripSheetApprovalContainer.classList.add('hidden');

        try {
            const response = await fetch(GENERATE_TRIP_SHEETS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate })
            });
            const result = await response.json();
            if (!response.ok) {
                const errorDetail = result.error || result.message || 'An unknown server error occurred.';
                throw new Error(errorDetail);
            }
            scheduleStatus.textContent = `Successfully generated trip sheets for ${selectedDate}. Review and approve to finalize.`;
        } catch (error) {
            console.error('Error generating trip sheets:', error);
            scheduleStatus.textContent = `Error generating trip sheets for ${selectedDate}: ${error.message}`;
            tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-red-500"><span class="material-icons-outlined text-4xl">error</span><p>Failed to generate trip sheets for ${selectedDate}.</p><p class="text-sm">${error.message}</p></div>`;
        } finally {
            generateTripSheetsBtn.disabled = false;
            generateTripSheetsBtn.innerHTML = `<span class="material-icons-outlined text-lg">route</span>Generate Trip Sheets`;
        }
    });

    if(approveTripSheetsBtn) approveTripSheetsBtn.addEventListener('click', async () => {
        const date = tripSheetDateInput.value;
        if (!currentTripSheets || currentTripSheets.length === 0) {
            alert("No trip sheets to approve.");
            return;
        }
    
        approveTripSheetsBtn.disabled = true;
        approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined animate-spin">sync</span>Approving...`;
    
        try {
            const batch = firebase.firestore().batch();
            const jobsToUpdate = new Map();
    
            currentTripSheets.forEach(sheet => {
                sheet.route.forEach(job => {
                    const liveJob = allJobsData.find(j => j.id === job.id);
                    if (liveJob && liveJob.status === 'Scheduled') {
                        jobsToUpdate.set(job.id, {
                            technicianId: sheet.technicianId,
                            technicianName: sheet.technicianName
                        });
                    }
                });
            });
    
            if (jobsToUpdate.size > 0) {
                jobsToUpdate.forEach((techInfo, jobId) => {
                    const jobRef = firebase.firestore().doc(`jobs/${jobId}`);
                    batch.update(jobRef, {
                        status: 'Awaiting completion',
                        assignedTechnicianId: techInfo.technicianId,
                        assignedTechnicianName: techInfo.technicianName
                    });
                });
                await batch.commit();
                scheduleStatus.textContent = `Successfully approved ${jobsToUpdate.size} jobs for ${date}. Technicians have been notified.`;
            } else {
                scheduleStatus.textContent = `All jobs for ${date} were already approved.`;
                approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle_outline</span>Sheets Approved`;
                approveTripSheetsBtn.disabled = true;
            }
    
        } catch (error) {
            console.error("Error approving trip sheets:", error);
            scheduleStatus.textContent = `Error approving trip sheets: ${error.message}`;
            approveTripSheetsBtn.disabled = false;
            approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle</span>Approve Trip Sheets`;
        }
    });

    if (tripSheetDateInput) {
        tripSheetDateInput.value = new Date().toISOString().split('T')[0];
        tripSheetDateInput.addEventListener('change', (event) => {
            loadTripSheetsForDate(event.target.value);
            if(scheduleStatus) scheduleStatus.textContent = `Displaying trip sheets for ${new Date(event.target.value + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}. Press 'Generate' to create or update.`;
        });
    }

    // Login Form
    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginErrorMessage = document.getElementById('loginErrorMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            
            if (loginErrorMessage) loginErrorMessage.textContent = '';

            try {
                await auth.signInWithEmailAndPassword(email, password);
                console.log("Login successful for:", email);
                loginForm.reset();
            } catch (error) {
                console.error("Login failed:", error);
                if (loginErrorMessage) {
                    switch (error.code) {
                        case 'auth/user-not-found':
                        case 'auth/wrong-password':
                        case 'auth/invalid-credential':
                            loginErrorMessage.textContent = 'Invalid email or password. Please try again.';
                            break;
                        case 'auth/invalid-email':
                            loginErrorMessage.textContent = 'Please enter a valid email address.';
                            break;
                        default:
                            loginErrorMessage.textContent = `Error: ${error.message}`;
                    }
                }
            }
        });
    }

    if (sendAllInvoicesBtn) {
        sendAllInvoicesBtn.addEventListener('click', async () => {
            if (pendingInvoices.length === 0) {
                showMessage("No invoices to send.", "info");
                return;
            }

            sendAllInvoicesBtn.disabled = true;
            sendAllInvoicesBtn.textContent = 'Sending...';

            try {
                // --- START: BUG FIX ---
                // 1. Find the job details from the correct data source BEFORE any database writes.
                // The job could be in the admin's list (allJobsData) or the worker's list (currentWorkerAssignedJobs).
                const jobDataSource = allJobsData.length > 0 ? allJobsData : currentWorkerAssignedJobs;
                const jobDetails = jobDataSource.find(j => j.id === currentJobIdForInvoicing);
            // 2. Validate that the job details were found.
            if (!jobDetails) {
                throw new Error(`Could not find details for Job ID: ${currentJobIdForInvoicing}. Aborting.`);
            }
            // 3. Make a copy of the invoices for the warranty record before clearing the main array.
            const invoicesForWarranty = [...pendingInvoices];
            // --- END: BUG FIX ---
            for (const invoice of pendingInvoices) {
                await db.runTransaction(async (transaction) => {
                    const counterRef = db.collection('counters').doc('invoiceCounter');
                    const counterDoc = await transaction.get(counterRef);
                    let nextNumber = 1;
                    if (counterDoc.exists && counterDoc.data().lastNumber) {
                        nextNumber = counterDoc.data().lastNumber + 1;
                    }
                    const formattedInvoiceNumber = formatInvoiceNumber(nextNumber);
                    invoice.invoiceNumber = formattedInvoiceNumber;
                    
                    invoice.pdfDataURL = generatePDF(invoice);
                    if (!invoice.pdfDataURL) {
                        showMessage(`Failed to generate PDF for ${invoice.customerName}. It will be saved without a PDF.`, 'warning');
                    }
                    const newInvoiceRef = db.collection('invoices').doc();
                    transaction.set(newInvoiceRef, invoice);
                    transaction.set(counterRef, { lastNumber: nextNumber }, { merge: true });
                });
            }
            if (currentJobIdForInvoicing) {
                // Use a batch write for atomicity
                const batch = db.batch();
                // Update Job Status
                const jobRef = db.collection('jobs').doc(currentJobIdForInvoicing);
                batch.update(jobRef, { status: 'Completed' });
                // Create Warranty with the validated jobDetails
                const warrantyRef = db.collection('warranties').doc();
                const warrantyData = {
                    job: jobDetails, // Use the validated job details object
                    invoices: invoicesForWarranty, // Use the copied invoices
                    completionDate: firebase.firestore.FieldValue.serverTimestamp()
                };
                batch.set(warrantyRef, warrantyData);
                await batch.commit();
            }
            
            showMessage('All invoices sent and job finalized!', 'success');
            pendingInvoices = []; // Now it's safe to clear the array
            currentJobIdForInvoicing = null;
            showWorkerHomeScreen();
        } catch (error) {
            console.error("Error sending invoices or finalizing job:", error);
            showMessage("Error: " + error.message, "error");
        } finally {
            sendAllInvoicesBtn.disabled = false;
            sendAllInvoicesBtn.textContent = 'Send All Invoices to Office';
        }
        });
    }

    // Initialize Firebase and Auth State Change Listener
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("Firebase Initialized (Compat).");

        const loginScreen = document.getElementById('loginScreen');
        const layoutContainer = document.getElementById('layoutContainer');
        const userAvatar = document.getElementById('userAvatar');

        auth.onAuthStateChanged(async user => {
            if (user) {
                // User is signed in
                const userInitial = user.email ? user.email.charAt(0).toUpperCase() : 'U';
                if(userAvatar) userAvatar.style.backgroundImage = `url("https://placehold.co/40x40/059669/FFFFFF?text=${userInitial}")`;

                if (user.email === 'admin@safewayos2.app') {
                    // --- ADMIN ROLE ---
                    console.log("Admin user signed in:", user.email);
                    loginScreen.style.display = 'none';
                    workerPwaView.classList.add('hidden');
                    layoutContainer.style.display = 'flex';
                    invoiceFormScreen.classList.add('hidden');

                    initializeTechnicians().then(() => {
                        listenForJobs();
                        listenForTechnicians();
                        initializeInventory().then(listenForInventoryItems);
                        listenForDashboardData();
                        listenForWarranties();
                        if (tripSheetDateInput.value) {
                           loadTripSheetsForDate(tripSheetDateInput.value);
                        }
                    });
                    initializeDanielAIChat();
                    switchView('dashboard');
                } else {
                    // --- WORKER ROLE ---
                    console.log("Worker user signed in:", user.email);
                    const techName = user.email.split('@')[0];
                    const capitalizedTechName = techName.charAt(0).toUpperCase() + techName.slice(1);
                    
                    const techQuery = await firebase.firestore().collection('technicians').where('name', '==', capitalizedTechName).limit(1).get();

                    if (!techQuery.empty) {
                        const technician = { id: techQuery.docs[0].id, ...techQuery.docs[0].data() };
                        console.log(`Found technician profile: ${technician.name}`);
                        
                        loginScreen.style.display = 'none';
                        layoutContainer.style.display = 'none';
                        workerPwaView.classList.remove('hidden');
                        invoiceFormScreen.classList.add('hidden');

                        listenForWorkerJobs(technician.id, technician.name);
                    } else {
                        console.error(`No technician profile found for user ${user.email}. Defaulting to sign out.`);
                        auth.signOut();
                    }
                }
            } else {
                // --- USER IS SIGNED OUT ---
                loginScreen.style.display = 'flex';
                layoutContainer.style.display = 'none';
                workerPwaView.classList.add('hidden');
                invoiceFormScreen.classList.add('hidden');
                console.log("User signed out.");

                // Clear data and listeners
                allJobsData = [];
                allTechniciansData = [];
                inventoryItemsData = [];
                currentTripSheets = [];
                conversationHistory = [];
                if (currentTripSheetListener) currentTripSheetListener();
                if (workerJobsListener) workerJobsListener();
                
                // Clear UI
                if(jobsTableBody) renderJobs([]);
                if(technicianCardsContainer) renderTechnicians([]);
                if(inventoryTableBody) renderInventory([]);
                if (tripSheetsContainer) tripSheetsContainer.innerHTML = '';
                if (dashboardLatestJobsListEl) dashboardLatestJobsListEl.innerHTML = '';
                if (chatLog) chatLog.innerHTML = '';
            }
        });

    } catch (error) {
        console.error("Firebase initialization failed:", error);
    }
});


function loadTripSheetsForDate(dateString) {
    if (!db || !dateString) {
        if (tripSheetsContainer) tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-slate-400"><p>Please select a date to view trip sheets.</p></div>`;
        if (tripSheetApprovalContainer) tripSheetApprovalContainer.classList.add('hidden');
        return;
    }
    if (currentTripSheetListener) {
        currentTripSheetListener(); 
    }
    const tripSheetQuery = firebase.firestore().collection("tripSheets").where("date", "==", dateString);
    currentTripSheetListener = tripSheetQuery.onSnapshot((snapshot) => {
        const sheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentView === 'schedule' && tripSheetDateInput.value === dateString) {
            renderTripSheets(sheets, dateString);
        }
    }, (error) => {
        console.error(`Error listening to trip sheets for ${dateString}:`, error);
        if (tripSheetsContainer) tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-red-500"><p>Error loading trip sheets for ${dateString}.</p></div>`;
        if (tripSheetApprovalContainer) tripSheetApprovalContainer.classList.add('hidden');
    });
}


// --- Daniel AI Chat Logic ---
function appendToChatLog(message, sender = 'ai', isProcessing = false) {
    if (!chatLog) return;
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble');
    if (sender === 'user') {
        bubble.classList.add('chat-bubble-user');
        bubble.textContent = message;
    } else {
        bubble.classList.add('chat-bubble-ai');
        if (isProcessing) {
            bubble.classList.add('processing-bubble');
            bubble.innerHTML = `<span class="spinner"></span><span>${message}</span>`;
        } else {
            bubble.textContent = message;
        }
    }
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return bubble;
}

async function handleDanielAIChat(userInput) {
    conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
    appendToChatLog(userInput, 'user');
    const processingBubble = appendToChatLog("Daniel is thinking...", 'ai', true);
    
    sendChatButton.disabled = true;
    chatInput.disabled = true;

    try {
        const response = await fetch(ASK_DANIEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: userInput,
                history: conversationHistory.slice(0, -1),
                view: currentView 
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'The AI is currently unavailable.');
        
        processingBubble.classList.remove('processing-bubble');
        processingBubble.innerHTML = result.response;
        conversationHistory.push({ role: 'model', parts: [{ text: result.response }] });

    } catch (error) {
        console.error("Error calling askDaniel function:", error);
        processingBubble.classList.remove('processing-bubble');
        processingBubble.textContent = `Sorry, I encountered an error: ${error.message}`;
    } finally {
        sendChatButton.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
        chatLog.scrollTop = chatLog.scrollHeight;
    }
}

function initializeDanielAIChat() {
    if (!chatLog || !chatInput || !sendChatButton) return;
    
    // Clear previous chat history if any
    chatLog.innerHTML = '';
    conversationHistory = [];
    
    const initialMessage = "Hello! I'm Daniel, your AI assistant. I have access to all jobs, technicians, and inventory. How can I help you? Try asking 'How many jobs are unscheduled?' or 'Where is Khaled?'";
    appendToChatLog(initialMessage);
    conversationHistory.push({ role: 'model', parts: [{ text: initialMessage }] });

    const submitQuery = () => {
        const userInput = chatInput.value.trim();
        if (userInput) {
            handleDanielAIChat(userInput);
            chatInput.value = '';
        }
    };

    // Remove existing listeners to prevent duplicates, then add them
    sendChatButton.removeEventListener('click', submitQuery);
    chatInput.removeEventListener('keypress', submitQuery);
    sendChatButton.addEventListener('click', submitQuery);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitQuery();
    });
}

function showMessage(message, type = 'info') {
    const container = document.getElementById('message-container');
    if (!container) {
        const newContainer = document.createElement('div');
        newContainer.id = 'message-container';
        newContainer.style.position = 'fixed';
        newContainer.style.top = '20px';
        newContainer.style.right = '20px';
        newContainer.style.zIndex = '10000';
        document.body.appendChild(newContainer);
    }

    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.padding = '10px 20px';
    messageElement.style.marginBottom = '10px';
    messageElement.style.borderRadius = '5px';
    messageElement.style.color = 'white';
    messageElement.style.opacity = '0';
    messageElement.style.transition = 'opacity 0.5s';

    switch (type) {
        case 'success':
            messageElement.style.backgroundColor = '#059669';
            break;
        case 'error':
            messageElement.style.backgroundColor = '#dc2626';
            break;
        default:
            messageElement.style.backgroundColor = '#3b82f6';
    }

    document.getElementById('message-container').appendChild(messageElement);

    setTimeout(() => {
        messageElement.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        messageElement.style.opacity = '0';
        setTimeout(() => {
            messageElement.remove();
            const container = document.getElementById('message-container');
            if (container && container.childElementCount === 0) {
                container.remove();
            }
        }, 500);
    }, 5000);
}

function showConfirmationModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmationModal');
    if (!modal) {
        console.error("Confirmation modal not found in HTML.");
        return;
    }
    
    const titleEl = modal.querySelector('.modal-title');
    const messageEl = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('.confirm-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    // Clone and replace the confirm button to remove old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const confirmHandler = () => {
        onConfirm();
        modal.style.display = 'none';
    };

    newConfirmBtn.addEventListener('click', confirmHandler);

    const cancelHandler = () => {
        modal.style.display = 'none';
    };
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelHandler, { once: true });
    }

    // Also close on outside click
    const outsideClickHandler = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            window.removeEventListener('click', outsideClickHandler);
        }
    };
    window.addEventListener('click', outsideClickHandler);
    
    modal.style.display = 'block';
}

async function showInvoiceScreen(jobId) {
    currentJobIdForInvoicing = jobId;
    const job = allJobsData.find(j => j.id === jobId);
    if (!job) {
        console.error("Job not found for invoice creation:", jobId);
        alert("Could not find the job details to create an invoice.");
        return;
    }

    // Hide other views
    if (layoutContainer) layoutContainer.style.display = 'none';
    if (workerPwaView) workerPwaView.classList.add('hidden');

    // Find the invoice screen using the correct ID
    const invoiceScreen = document.getElementById('invoiceFormScreen');

    // Make sure the element exists before trying to modify it
    if (invoiceScreen) {
        invoiceScreen.classList.remove('hidden');
    } else {
        console.error("Fatal Error: The invoice form screen could not be found in the DOM.");
        return;
    }

    // Populate invoice form fields
    populateInvoiceForm(job);

    // Ensure the canvas is sized correctly now that it's visible
    resizeCanvas();
    
    // Automatically fill warranty and plan info
    const planTypeInput = document.getElementById('planType');
    const warrantyNameInput = document.getElementById('warrantyName');

    if (planTypeInput) {
        planTypeInput.value = job.planType || '';
    }
    if (warrantyNameInput) {
        warrantyNameInput.value = job.warrantyProvider || '';
    }

    // Fetch and display the next invoice number
    if(invoiceNumberDisplay) invoiceNumberDisplay.value = "Loading next...";
    try {
        const counterRef = db.collection('counters').doc('invoiceCounter');
        const counterDoc = await counterRef.get();
        let nextNumber = 1;
        if (counterDoc.exists && counterDoc.data().lastNumber) {
            nextNumber = counterDoc.data().lastNumber + 1;
        }
        if(invoiceNumberDisplay) invoiceNumberDisplay.value = formatInvoiceNumber(nextNumber);
    } catch (error) {
        console.error("Error fetching next invoice number:", error);
        if(invoiceNumberDisplay) invoiceNumberDisplay.value = "Error loading #";
    }
}

function generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Add content to the PDF
    doc.text(`Invoice #${data.invoiceNumber}`, 20, 20);
    doc.text(`Date: ${data.invoiceDate}`, 20, 30);
    doc.text(`Customer: ${data.customerName}`, 20, 40);
    // ... add more data to the PDF as needed

    return doc.output('datauristring');
}

async function saveInvoiceData(invoiceDataToSave, isSilent = false, invoiceId = null) {
    console.log("Attempting to save invoice data. Passed invoiceId:", invoiceId, "Data:", invoiceDataToSave);
    if (!invoiceDataToSave.invoiceNumber || !invoiceDataToSave.customerName || !invoiceDataToSave.customerEmail) {
        if (!isSilent) showMessage('Invoice #, Customer Name, and Email are required.', 'error');
        return false;
    }
    if (!invoiceDataToSave.paymentMethod) {
        if (!isSilent) showMessage('A payment method is required.', 'error');
        return false;
    }
    if (invoiceDataToSave.paymentMethod === 'Cheque' && !invoiceDataToSave.chequeNumber) {
        if (!isSilent) showMessage('Cheque # is required for cheque payments.', 'error');
        return false;
    }

    const effectiveInvoiceId = invoiceId; 
    console.log("Using effectiveInvoiceId for save/update:", effectiveInvoiceId);

    const timestamp = new Date().toISOString();
    if (effectiveInvoiceId) { 
        invoiceDataToSave.updatedAt = timestamp;
        if (!invoiceDataToSave.createdAt) { 
             console.warn("createdAt missing during update.");
             try {
                const originalDoc = await db.collection('invoices').doc(effectiveInvoiceId).get();
                if (originalDoc.exists && originalDoc.data().createdAt) {
                    invoiceDataToSave.createdAt = originalDoc.data().createdAt;
                } else {
                    invoiceDataToSave.createdAt = timestamp; 
                }
             } catch (e) {
                console.error("Error fetching original doc for createdAt:", e);
                invoiceDataToSave.createdAt = timestamp;
             }
        }
    } else { 
        invoiceDataToSave.createdAt = timestamp;
        invoiceDataToSave.updatedAt = timestamp; 
    }

    try {
        if (effectiveInvoiceId) { 
            console.log("Updating existing invoice in Firestore:", effectiveInvoiceId);
            const invoiceRef = db.collection('invoices').doc(effectiveInvoiceId);
            await invoiceRef.set(invoiceDataToSave, { merge: true }); 

            if (!isSilent) {
                showMessage('Invoice updated successfully!', 'success');
            }
        } else { 
            console.log("Adding new invoice to Firestore");
            const docRef = await db.collection('invoices').add(invoiceDataToSave);
            
            if (!isSilent) {
                showMessage('Invoice saved successfully!', 'success');
            }
        }
        return true;
    } catch (error) {
        console.error("Error saving invoice to Firestore:", error);
        if (!isSilent) showMessage('Error: Could not save to database.', 'error');
        return false;
    }
}

function formatInvoiceNumber(num) {
    return `SW${String(num).padStart(5, '0')}`;
}

function showAdminHomeScreen() {
    switchView('dashboard');
}

function showWorkerHomeScreen() {
    if (workerPwaView) workerPwaView.classList.remove('hidden');
    if (layoutContainer) layoutContainer.style.display = 'none';
    if (invoiceFormScreen) invoiceFormScreen.classList.add('hidden');
    const afterSendInvoiceScreen = document.getElementById('afterSendInvoiceScreen');
    if (afterSendInvoiceScreen) afterSendInvoiceScreen.classList.add('hidden');
}

function showInvoiceListScreen() {
    switchView('jobs');
}

function closeWorkerDetailModal() {
    if(workerDetailModal) workerDetailModal.style.display = 'none';
}

function removeWorker(worker) {
    showConfirmationModal(
        "Remove Worker",
        `Are you sure you want to remove ${worker.name}? This action cannot be undone.`,
        async () => {
            try {
                await firebase.firestore().collection('technicians').doc(worker.id).delete();
                showMessage(`${worker.name} has been removed.`, 'success');
                closeWorkerDetailModal();
            } catch (error) {
                console.error("Error removing worker: ", error);
                showMessage(`Error removing worker: ${error.message}`, 'error');
            }
        }
    );
}

function loadAdminInvoicesListData() {
    // This is a placeholder. In a real application, you would fetch and filter data here.
    console.log("Loading admin invoices list data...");
}

function closeInvoiceViewModal() {
    if(invoiceViewModal) invoiceViewModal.style.display = 'none';
}

function showAdminInvoiceWorkerSelectScreen() {
    switchView('technicians');
}

function showAdminWorkersScreen() {
    switchView('technicians');
}

function populateMonthFilter() {
    // This is a placeholder. In a real application, you would populate the month filter based on the selected year.
    console.log("Populating month filter...");
}

function handleAddWorker(event) {
    event.preventDefault();
    // This is a placeholder. In a real application, you would handle adding a new worker here.
    console.log("Handling add worker...");
}

function setInitialDate() {
    const invoiceDateInput = document.getElementById('invoiceDate');
    if(invoiceDateInput) invoiceDateInput.value = new Date().toISOString().split('T')[0];
}

let lineItemCount = 0;
function addLineItem(description = '', quantity = '', price = '') {
    lineItemCount++;
    const lineItemsContainer = document.getElementById('lineItemsContainer');
    const newItemHtml = `
        <div class="line-item p-3 border border-gray-200 rounded-md bg-gray-50" id="item-${lineItemCount}">
            <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <div class="md:col-span-6">
                    <input type="text" value="${description}" name="itemDescription-${lineItemCount}" class="form-input mt-1 text-sm" placeholder="Service or Product">
                </div>
                <div class="md:col-span-2">
                    <input type="number" value="${quantity}" name="itemQuantity-${lineItemCount}" class="form-input mt-1 text-sm text-right" min="0" step="any" placeholder="1">
                </div>
                <div class="md:col-span-2">
                    <input type="number" value="${price}" name="itemPrice-${lineItemCount}" class="form-input mt-1 text-sm text-right" min="0" step="0.01" placeholder="0.00">
                </div>
                <div class="md:col-span-1 text-right self-center">
                    <span id="itemTotal-${lineItemCount}" class="text-sm font-medium text-gray-700">$0.00</span>
                </div>
                <div class="md:col-span-1 text-right self-center">
                    <button type="button" class="removeItemBtn btn btn-danger btn-sm p-2 text-xs" data-itemid="${lineItemCount}">&times;</button>
                </div>
            </div>
        </div>`;
    if(lineItemsContainer) lineItemsContainer.insertAdjacentHTML('beforeend', newItemHtml);
    attachLineItemListeners(lineItemCount);
    updateLineItemTotal(lineItemCount);
    updateTotals();
}

function updateTotals() {
    const subtotalDisplay = document.getElementById('subtotalDisplay');
    const totalDisplay = document.getElementById('totalDisplay');
    const laborInput = document.getElementById('labor');
    const serviceCallInput = document.getElementById('serviceCall');
    const salesTaxRateInput = document.getElementById('salesTaxRate');
    const salesTaxAmountDisplay = document.getElementById('salesTaxAmountDisplay');

    let subtotal = 0;
    document.querySelectorAll('.line-item').forEach(item => {
        const id = item.id.split('-')[1];
        const quantityEl = document.querySelector(`[name=itemQuantity-${id}]`);
        const priceEl = document.querySelector(`[name=itemPrice-${id}]`);
        if (quantityEl && priceEl) {
            subtotal += (parseFloat(quantityEl.value) || 0) * (parseFloat(priceEl.value) || 0);
        }
    });
    if(subtotalDisplay) subtotalDisplay.textContent = formatCurrency(subtotal);
    const labor = laborInput ? (parseFloat(laborInput.value) || 0) : 0;
    const serviceCall = serviceCallInput ? (parseFloat(serviceCallInput.value) || 0) : 0;
    const taxRate = salesTaxRateInput ? (parseFloat(salesTaxRateInput.value) || 0) : 0;
    const salesTaxAmount = subtotal * (taxRate / 100);
    if(salesTaxAmountDisplay) salesTaxAmountDisplay.textContent = formatCurrency(salesTaxAmount);
    if(totalDisplay) totalDisplay.textContent = formatCurrency(subtotal + labor + serviceCall + salesTaxAmount);
}

function initializeSignaturePad() {
    const signatureCanvas = document.getElementById('signatureCanvas');
    if (typeof SignaturePad === 'undefined') {
        console.error("SignaturePad library is not loaded.");
        return;
    }
    if (signatureCanvas && !signaturePad) {
        signaturePad = new SignaturePad(signatureCanvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });
        window.addEventListener("resize", () => resizeCanvas());
    }
}

function setFormEditable(editable) {
    const invoiceFormEl = document.getElementById('invoiceForm');
    const addItemBtn = document.getElementById('addItemBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const editSignatureBtn = document.getElementById('editSignatureBtn');
    isFormLocked = !editable;
    const formElements = invoiceFormEl.elements;
    for (let i = 0; i < formElements.length; i++) {
        const element = formElements[i];
        if (element.id !== 'invoiceNumberDisplay' && element.id !== 'salesTaxRate') {
            element.readOnly = !editable;
            element.disabled = !editable;
            if(!editable) {
                element.classList.add('bg-gray-100', 'cursor-not-allowed');
            } else {
                element.classList.remove('bg-gray-100', 'cursor-not-allowed');
            }
        }
    }
    if (addItemBtn) addItemBtn.disabled = !editable;
    document.querySelectorAll('.removeItemBtn').forEach(btn => btn.disabled = !editable);
    if (clearFormBtn) clearFormBtn.disabled = !editable;
    if (editSignatureBtn) {
        editSignatureBtn.disabled = false;
        editSignatureBtn.classList.remove('bg-gray-100', 'cursor-not-allowed');
    }
    if (signaturePad) {
        if (editable) signaturePad.on();
        else signaturePad.off(); 
    }
}

function resizeCanvas() {
    const signatureCanvas = document.getElementById('signatureCanvas');
    const signaturePadContainer = document.querySelector('.signature-pad-container');
    if (!signatureCanvas || !signaturePad) return;
    if (signaturePadContainer && signaturePadContainer.offsetParent === null) return;
    const containerWidth = signaturePadContainer.offsetWidth;
    if (containerWidth === 0) return;
    const ratio =  Math.max(window.devicePixelRatio || 1, 1);
    signatureCanvas.width = containerWidth * ratio;
    signatureCanvas.height = 150 * ratio; 
    const ctx = signatureCanvas.getContext("2d");
    if (ctx) {
        ctx.scale(ratio, ratio);
    }
    signaturePad.clear();
}

function attachLineItemListeners(id) {
    const quantityInput = document.querySelector(`[name=itemQuantity-${id}]`);
    const priceInput = document.querySelector(`[name=itemPrice-${id}]`);
    const removeItemButton = document.querySelector(`#item-${id} .removeItemBtn`);
    if(quantityInput && priceInput) {
        [quantityInput, priceInput].forEach(input => {
            input.addEventListener('input', () => {
                updateLineItemTotal(id);
                updateTotals();
            });
        });
    }
    if (removeItemButton) {
        removeItemButton.addEventListener('click', () => {
            const itemToRemove = document.getElementById(`item-${id}`);
            if(itemToRemove) itemToRemove.remove();
            updateTotals();
        });
    }
}

function updateLineItemTotal(id) {
    const quantityEl = document.querySelector(`[name=itemQuantity-${id}]`);
    const priceEl = document.querySelector(`[name=itemPrice-${id}]`);
    if (!quantityEl || !priceEl) return;
    const quantity = parseFloat(quantityEl.value) || 0;
    const price = parseFloat(priceEl.value) || 0;
    const itemTotalEl = document.getElementById(`itemTotal-${id}`);
    if(itemTotalEl) itemTotalEl.textContent = formatCurrency(quantity * price);
}

function collectInvoiceData(autoGeneratedInvoiceNumber) {
    const invoiceFormEl = document.getElementById('invoiceForm');
    const chequeNumberInput = document.getElementById('chequeNumber');
    const formData = new FormData(invoiceFormEl);
    const selectedCountyTaxRadio = document.querySelector('input[name="countyTax"]:checked');
    const paymentMethodRadio = document.querySelector('input[name="paymentMethod"]:checked');
    let selectedCountyValue = selectedCountyTaxRadio ? selectedCountyTaxRadio.value : null;
    if (selectedCountyValue === 'Other') {
        selectedCountyValue = formData.get('customAreaName') || 'Custom';
    }
    const invoiceData = {
        invoiceNumber: autoGeneratedInvoiceNumber, 
        invoiceDate: formData.get('invoiceDate'),
        poNumber: formData.get('poNumber'),
        selectedCountyTax: selectedCountyValue, 
        planType: formData.get('planType'), 
        warrantyName: formData.get('warrantyName'), 
        customerName: document.getElementById('customerName').value.trim(),
        customerEmail: document.getElementById('customerEmail').value.trim(), 
        customerPhone: formData.get('customerPhone'),
        customerAddress: document.getElementById('customerAddress').value,
        jobAddress: document.getElementById('jobAddress').value,
        typeOfEquipment: document.getElementById('typeOfEquipment').value,
        jobDescription: document.getElementById('jobDescription').value,
        recommendations: document.getElementById('recommendations').value,
        nonCoveredItems: document.getElementById('nonCoveredItemsText').value.trim(),
        paymentMethod: paymentMethodRadio ? paymentMethodRadio.value : null,
        chequeNumber: paymentMethodRadio && paymentMethodRadio.value === 'Cheque' ? chequeNumberInput.value.trim() : null,
        items: [],
        labor: (parseFloat(document.getElementById('labor').value) || 0),
        serviceCall: (parseFloat(document.getElementById('serviceCall').value) || 0),
        salesTaxRate: parseFloat(document.getElementById('salesTaxRate').value) || 0, 
        salesTaxAmount: 0,
        subtotal: 0,
        total: 0,
        status: 'pending', 
        signatureDataURL: confirmedSignatureDataURL, 
        signedBy: confirmedSignatureDataURL ? (document.getElementById('customerName')?.value.trim() || "Customer") : null,
    };
    let currentSubtotal = 0;
    document.querySelectorAll('.line-item').forEach(item => {
        const id = item.id.split('-')[1];
        const descriptionEl = document.querySelector(`[name=itemDescription-${id}]`);
        const quantityEl = document.querySelector(`[name=itemQuantity-${id}]`);
        const priceEl = document.querySelector(`[name=itemPrice-${id}]`);
        if(descriptionEl && quantityEl && priceEl){
            const description = descriptionEl.value;
            const quantity = parseFloat(quantityEl.value) || 0;
            const price = parseFloat(priceEl.value) || 0;
            invoiceData.items.push({ description, quantity, price, total: quantity * price });
            currentSubtotal += quantity * price;
        }
    });
    invoiceData.subtotal = currentSubtotal;
    if (auth.currentUser && auth.currentUser.uid) {
        invoiceData.createdByWorkerId = auth.currentUser.uid;
        invoiceData.workerName = auth.currentUser.displayName || (auth.currentUser.email ? auth.currentUser.email.split('@')[0] : 'N/A');
    }
    invoiceData.salesTaxAmount = invoiceData.subtotal * (invoiceData.salesTaxRate / 100);
    invoiceData.total = invoiceData.subtotal + invoiceData.labor + invoiceData.serviceCall + invoiceData.salesTaxAmount;
    return invoiceData;
}

function populateInvoiceForm(job) {
    console.log("Populating invoice form with job data:", job);

    const invoiceFormEl = document.getElementById('invoiceForm');
    const lineItemsContainer = document.getElementById('lineItemsContainer');
    const salesTaxRateInput = document.getElementById('salesTaxRate');
    const customTaxArea = document.getElementById('customTaxArea');
    const chequeNumberArea = document.getElementById('chequeNumberArea');

    // Reset form to a clean state
    if(invoiceFormEl) invoiceFormEl.reset();
    if(lineItemsContainer) lineItemsContainer.innerHTML = '';
    
    // Set customer and job details
    document.getElementById('customerName').value = job.customer || '';
    document.getElementById('customerAddress').value = job.address || '';
    document.getElementById('customerPhone').value = job.phone || '';
    document.getElementById('jobAddress').value = job.address || ''; // Assuming job address is same as customer address
    
    document.getElementById('poNumber').value = job.dispatchOrPoNumber || '';
    
    // Auto-fill warranty details
    document.getElementById('planType').value = job.planType || '';
    document.getElementById('warrantyName').value = job.warrantyName || '';

    // Set other fields to default/initial states
    setInitialDate();
    if (salesTaxRateInput) salesTaxRateInput.value = "0.00";
    if (customTaxArea) customTaxArea.classList.add('hidden');
    if (chequeNumberArea) chequeNumberArea.classList.add('hidden');

    // Add a default line item
    addLineItem();
    
    // Recalculate totals
    updateTotals();

    // Initialize signature pad
    if (!signaturePad) {
        initializeSignaturePad();
    } else {
        signaturePad.clear();
    }
    
    // Ensure form is editable
    setFormEditable(true);
}

function showAfterSendInvoiceScreen() {
    invoiceFormScreen.classList.add('hidden');
    workerPwaView.classList.add('hidden');
    const afterSendInvoiceScreen = document.getElementById('afterSendInvoiceScreen');
    afterSendInvoiceScreen.classList.remove('hidden');

    const pendingInvoicesList = document.getElementById('pendingInvoicesList');
    pendingInvoicesList.innerHTML = '';

    if (pendingInvoices.length === 0) {
        pendingInvoicesList.innerHTML = '<p class="text-center text-slate-500 p-4">No pending invoices.</p>';
        return;
    }

    let customerName = '';
    pendingInvoices.forEach((invoice, index) => {
        if (invoice.customerName) {
            customerName = invoice.customerName;
        }
        const invoiceCard = `
            <div class="flex items-center gap-4 bg-white px-4 min-h-[72px] py-2">
              <div class="text-[#111518] flex items-center justify-center rounded-lg bg-[#f0f2f5] shrink-0 size-12" data-icon="File" data-size="24px" data-weight="regular">
                <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
                  <path
                    d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"
                  ></path>
                </svg>
              </div>
              <div class="flex flex-col justify-center">
                <p class="text-[#111518] text-base font-medium leading-normal line-clamp-1">Invoice for ${invoice.customerName}</p>
                <p class="text-[#60768a] text-sm font-normal leading-normal line-clamp-2">Total: ${formatCurrency(invoice.total)}</p>
              </div>
            </div>
        `;
        pendingInvoicesList.insertAdjacentHTML('beforeend', invoiceCard);
    });

    const afterSendInvoiceTitle = document.getElementById('afterSendInvoiceTitle');
    if (afterSendInvoiceTitle) {
        afterSendInvoiceTitle.textContent = `Invoices for ${customerName}`;
    }
}

function openWarrantyDetailModal(warranty) {
    const modal = document.getElementById('warrantyDetailModal');
    if (!modal) return;

    // --- Populate all Job Details (This part remains the same) ---
    const job = warranty.job || {};
    document.getElementById('modalWarrantyCustomerName').textContent = job.customer || 'N/A';
    document.getElementById('modalWarrantyAddress').textContent = job.address || 'N/A';
    document.getElementById('modalWarrantyPhone').textContent = job.phone || 'N/A';
    document.getElementById('modalWarrantyTechnician').textContent = job.assignedTechnicianName || 'N/A';
    document.getElementById('modalWarrantyDispatchOrPoNumber').textContent = job.dispatchOrPoNumber || 'N/A';
    document.getElementById('modalWarrantyPlanType').textContent = job.planType || 'N/A';
    document.getElementById('modalWarrantyProvider').textContent = job.warrantyProvider || 'N/A';
    
    let formattedDate = 'N/A';
    if (warranty.completionDate && typeof warranty.completionDate.toDate === 'function') {
        formattedDate = warranty.completionDate.toDate().toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }
    document.getElementById('modalWarrantyCompletionDate').textContent = formattedDate;

    // --- Populate Invoices with Full Financial Details ---
    const invoicesContainer = document.getElementById('modalWarrantyInvoicesContainer');
    invoicesContainer.innerHTML = '';

    if (warranty.invoices && warranty.invoices.length > 0) {
        warranty.invoices.forEach((invoice, index) => {
            const signatureHTML = invoice.signatureDataURL
                ? `<img src="${invoice.signatureDataURL}" alt="Signature" class="signature-image-modal">`
                : '<p class="text-sm text-slate-500 mt-2">No signature.</p>';

            const itemsHTML = invoice.items.map(item => `
                <tr>
                    <td class="py-1 pr-2">${item.description}</td>
                    <td class="py-1 pr-2 text-right">${item.quantity}</td>
                    <td class="py-1 pr-2 text-right">${formatCurrency(item.price)}</td>
                    <td class="py-1 text-right font-medium">${formatCurrency(item.total)}</td>
                </tr>
            `).join('');

            const nonCoveredItemsHTML = invoice.nonCoveredItems
                ? `<div class="mt-2 pt-2 border-t border-slate-200"><strong>Non-Covered Items:</strong><p class="text-sm whitespace-pre-wrap">${invoice.nonCoveredItems}</p></div>`
                : '';

            const invoiceElement = document.createElement('div');
            invoiceElement.className = 'invoice-in-modal';
            invoiceElement.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <p class="font-bold text-slate-800">Invoice #: ${invoice.invoiceNumber || 'N/A'}</p>
                        <p class="text-sm text-slate-600">Date: ${invoice.invoiceDate || 'N/A'}</p>
                    </div>
                    <div class="text-right">
                        ${signatureHTML}
                    </div>
                </div>
                <h4 class="text-sm font-semibold mt-3 mb-1 text-slate-700">Items/Services:</h4>
                <table class="w-full text-xs custom-table">
                    <thead><tr><th>Desc.</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                <div class="mt-3 flex justify-end">
                    <div class="w-full max-w-xs space-y-1 text-sm">
                        <div class="flex justify-between"><span>Subtotal:</span><span>${formatCurrency(invoice.subtotal)}</span></div>
                        <div class="flex justify-between"><span>Labor:</span><span>${formatCurrency(invoice.labor)}</span></div>
                        <div class="flex justify-between"><span>Service Call:</span><span>${formatCurrency(invoice.serviceCall)}</span></div>
                        <div class="flex justify-between"><span>Sales Tax (${invoice.salesTaxRate}%):</span><span>${formatCurrency(invoice.salesTaxAmount)}</span></div>
                        <div class="flex justify-between font-bold text-base border-t border-slate-300 mt-1 pt-1"><span>TOTAL:</span><span>${formatCurrency(invoice.total)}</span></div>
                    </div>
                </div>
                ${nonCoveredItemsHTML}
            `;
            invoicesContainer.appendChild(invoiceElement);
        });
    } else {
        invoicesContainer.innerHTML = '<p>No invoices associated with this warranty.</p>';
    }

    modal.style.display = 'block';

    const closeButtons = modal.querySelectorAll('.close-button');
    closeButtons.forEach(btn => {
        btn.onclick = () => { modal.style.display = 'none'; }
    });
    window.onclick = (event) => {
        if (event.target == modal) { modal.style.display = 'none'; }
    }
}
