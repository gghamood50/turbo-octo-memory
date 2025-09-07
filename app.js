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
const SEND_SCHEDULING_LINKS_URL = 'https://send-manual-scheduling-links-216681158749.us-central1.run.app';
const SEND_HOMEGUARD_CLAIM_URL = 'https://send-homeguard-claim-216681158749.us-central1.run.app';
const UPLOAD_INVOICE_IMAGE_URL = 'https://upload-invoice-image-216681158749.us-central1.run.app/upload';

// --- Global State ---
let allJobsData = [];
let allTechniciansData = [];
let inventoryItemsData = [];
let currentTripSheets = [];
let currentView = 'dashboard';
let conversationHistory = [];
let currentChatMode = 'tour_guide';
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
let allInvoicesData = [];
let currentProvider = null;
let currentFilteredData = [];
let currentJobToReschedule = null;
let currentWorkerTechnicianId = null;
let invoiceImageFiles = [];


// --- DOM Elements ---
const tabVisibilityContainer = document.getElementById('tab-visibility-container');
const invoiceSearchInput = document.getElementById('invoiceSearchInput');
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
const sendSchedulingLinksBtn = document.getElementById('sendSchedulingLinksBtn');
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
const activateEmailBtn = document.getElementById('activate-email-btn');
const emailWritingPopup = document.getElementById('email-writing-popup');
    const sendAllInvoicesBtn = document.getElementById('sendAllInvoicesBtn');

// --- Worker PWA DOM Elements ---
const workerPwaView = document.getElementById('workerPwaView');
const workerNameEl = document.getElementById('workerName');
const workerCurrentDateEl = document.getElementById('workerCurrentDate');
const workerTodaysRouteEl = document.getElementById('workerTodaysRoute');
const workerLogoutBtn = document.getElementById('workerLogoutBtn');

// --- Invoice Form Elements ---
const invoiceFormScreen = document.getElementById('invoiceFormScreen');
const afterSendInvoiceScreen = document.getElementById('afterSendInvoiceScreen');
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
const imageUploadInput = document.getElementById('imageUpload');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');


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
        let actionsHtml = '';

        if (statusText === 'Needs Scheduling' || statusText.startsWith('Rescheduled by')) {
            statusClass = 'status-needs-scheduling';
            actionsHtml = `
                <button class="btn-secondary-stitch schedule-job-btn" data-id="${job.id}">Schedule Manually</button>
            `;
        } else if (statusText === 'Scheduled') {
            statusClass = 'status-scheduled';
            if (job.scheduledDate && job.timeSlot) {
                statusText = `Scheduled: ${job.scheduledDate} (${job.timeSlot})`;
            }
            actionsHtml = `<button class="btn-secondary-stitch schedule-job-btn" data-id="${job.id}">View/Reschedule</button>`;
        } else if (statusText === 'Link Sent!') {
            statusClass = 'status-link-sent';
            actionsHtml = `<button class="btn-secondary-stitch schedule-job-btn" data-id="${job.id}">Schedule Manually</button>`;
        } else if (statusText === 'Dispatcher call back') {
            statusClass = 'status-dispatcher-call-back';
            actionsHtml = `<button class="btn-secondary-stitch schedule-job-btn" data-id="${job.id}">View Details</button>`;
        } else { // Covers 'Awaiting completion' and 'Completed'
             if (statusText === 'Awaiting completion') statusClass = 'status-awaiting-completion';
             if (statusText === 'Completed') statusClass = 'status-completed';
             // Use the 'schedule-job-btn' class so the existing event handler catches it.
             // The modal it opens is for viewing/rescheduling, which is appropriate.
             actionsHtml = `<button class="btn-secondary-stitch schedule-job-btn" data-id="${job.id}">View Details</button>`;
        }

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

async function openInvoiceViewModal(invoiceId) {
    let invoice = allInvoicesData.find(inv => inv.id === invoiceId);

    // If not in cache, fetch fresh from DB
    if (!invoice) {
        try {
            const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
            if (invoiceDoc.exists) {
                invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };
            }
        } catch (e) {
            console.error("Failed to fetch invoice from DB:", e);
            showMessage('Error fetching invoice details.', 'error');
            return;
        }
    }

    if (!invoice) {
        showMessage('Could not find invoice details.', 'error');
        return;
    }
    currentlyViewedInvoiceData = invoice;

    const invoiceModalBody = document.getElementById('invoiceModalBody');
    const modalTitle = document.getElementById('modalInvoiceTitle');
    const modalMarkPaidBtn = document.getElementById('modalMarkPaidBtn');

    modalTitle.textContent = `Invoice #${invoice.invoiceNumber || 'N/A'}`;

    let itemsHtml = invoice.items.map(item => `
        <tr>
            <td>${item.description}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.price)}</td>
            <td class="text-right">${formatCurrency(item.total)}</td>
        </tr>
    `).join('');

    const signatureHtml = invoice.signatureDataURL
        ? `<img src="${invoice.signatureDataURL}" alt="Customer Signature" class="mx-auto my-2" style="max-width: 200px; border: 1px solid #ccc;"/>`
        : '<p>No signature on file.</p>';

    invoiceModalBody.innerHTML = `
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Customer:</strong> ${invoice.customerName}</div>
            <div><strong>Date:</strong> ${invoice.createdAt?.toDate().toLocaleDateString() || 'N/A'}</div>
            <div><strong>Address:</strong> ${invoice.customerAddress || 'N/A'}</div>
            <div><strong>Phone:</strong> ${invoice.customerPhone || 'N/A'}</div>
            <div><strong>Type:</strong> <span class="status-pill ${invoice.invoiceType.toLowerCase() === 'warranty' ? 'status-awaiting-completion' : 'status-link-sent'}">${invoice.invoiceType || 'N/A'}</span></div>
            <div><strong>Status:</strong> <span class="status-pill ${invoice.status === 'paid' ? 'status-completed' : 'status-needs-scheduling'}">${invoice.status || 'N/A'}</span></div>
        </div>
        <hr class="my-4">
        <h4 class="font-semibold mb-2">Items</h4>
        <table class="custom-table w-full text-sm">
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
        </table>
        <div class="flex justify-end mt-4">
            <div class="w-1/2 space-y-2 text-sm">
                <div class="flex justify-between"><span>Subtotal:</span> <span>${formatCurrency(invoice.subtotal)}</span></div>
                <div class="flex justify-between"><span>Tax:</span> <span>${formatCurrency(invoice.salesTaxAmount)}</span></div>
                <div class="flex justify-between font-bold text-base border-t pt-2"><span>Total:</span> <span>${formatCurrency(invoice.total)}</span></div>
            </div>
        </div>
        <div class="text-center mt-4">
            <button id="viewMoreBtn" class="text-sm text-green-600 hover:underline">View More</button>
        </div>
        <div id="invoiceModalMoreDetails" style="display: none;" class="mt-4 text-sm space-y-2">
            <hr class="my-4">
            <h4 class="font-semibold mb-2">Additional Details</h4>
            <div><strong>Dispatch #:</strong> ${invoice.poNumber || 'N/A'}</div>
            <div><strong>Warranty Provider:</strong> ${invoice.warrantyName || 'N/A'}</div>
            <div><strong>Plan Type:</strong> ${invoice.planType || 'N/A'}</div>
            <div><strong>Technician:</strong> ${invoice.workerName || 'N/A'}</div>
            <div><strong>Type of Equipment:</strong> ${invoice.typeOfEquipment || 'N/A'}</div>
            <div class="mt-2">
                <strong class="block">Job Description:</strong>
                <p class="whitespace-pre-wrap p-2 bg-slate-50 rounded">${invoice.jobDescription || 'N/A'}</p>
            </div>
            <div class="mt-2">
                <strong class="block">Recommendations:</strong>
                <p class="whitespace-pre-wrap p-2 bg-slate-50 rounded">${invoice.recommendations || 'N/A'}</p>
            </div>
            <div class="mt-2">
                <strong class="block">Customer Signature:</strong>
                <div class="p-2 bg-slate-50 rounded text-center">
                    ${signatureHtml}
                </div>
            </div>
        </div>
    `;

    modalMarkPaidBtn.textContent = invoice.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid';
    invoiceViewModal.style.display = 'block';

    const viewMoreBtn = document.getElementById('viewMoreBtn');
    const moreDetails = document.getElementById('invoiceModalMoreDetails');

    if (viewMoreBtn && moreDetails) {
        viewMoreBtn.addEventListener('click', () => {
            const isHidden = moreDetails.style.display === 'none';
            moreDetails.style.display = isHidden ? 'block' : 'none';
            viewMoreBtn.textContent = isHidden ? 'View Less' : 'View More';
        });
    }
}

function filterInvoices() {
    const searchInput = invoiceSearchInput.value.toLowerCase();
    const searchTerms = searchInput.split(',').map(term => term.trim()).filter(term => term);

    if (searchTerms.length === 0) {
        renderInvoices(allInvoicesData);
        return;
    }

    const filteredInvoices = allInvoicesData.filter(invoice => {
        // For each invoice, check if all search terms are found
        return searchTerms.every(term => {
            const invoiceDate = invoice.createdAt?.toDate().toLocaleDateString().toLowerCase() || '';
            // Check if the current term is found in any of the fields
            return (
                (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(term)) ||
                (invoice.customerName && invoice.customerName.toLowerCase().includes(term)) ||
                (invoiceDate.includes(term)) ||
                (invoice.poNumber && invoice.poNumber.toLowerCase().includes(term)) ||
                (invoice.customerAddress && invoice.customerAddress.toLowerCase().includes(term)) ||
                (invoice.customerPhone && invoice.customerPhone.toLowerCase().includes(term))
            );
        });
    });

    renderInvoices(filteredInvoices);
}

function renderInvoices(invoices) {
    const invoicesTableBody = document.getElementById('invoicesTableBody');
    if (!invoicesTableBody) return;

    invoicesTableBody.innerHTML = '';

    if (invoices.length === 0) {
        invoicesTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-500 py-4">No invoices found.</td></tr>`;
        return;
    }

    const sortedInvoices = [...invoices].sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    invoicesTableBody.innerHTML = sortedInvoices.map(invoice => {
        const invoiceDate = invoice.createdAt?.toDate().toLocaleDateString() || 'N/A';
        const statusClass = invoice.status === 'paid' ? 'status-completed' : 'status-needs-scheduling';
        return `
            <tr>
                <td class="font-medium text-slate-800">${invoice.invoiceNumber || 'N/A'}</td>
                <td>${invoice.customerName || 'N/A'}</td>
                <td>${invoiceDate}</td>
                <td><span class="status-pill ${(invoice.invoiceType || '').toLowerCase() === 'warranty' ? 'status-awaiting-completion' : 'status-link-sent'}">${invoice.invoiceType || 'N/A'}</span></td>
                <td>${formatCurrency(invoice.total)}</td>
                <td><span class="status-pill ${statusClass}">${invoice.status || 'N/A'}</span></td>
                <td><button class="btn-secondary-stitch view-invoice-btn" data-id="${invoice.id}">View Details</button></td>
            </tr>
        `;
    }).join('');
}

function renderWarrantyInvoices(invoices) {
    const warrantyTableBody = document.getElementById('warrantyTableBody');
    if (!warrantyTableBody) return;

    warrantyTableBody.innerHTML = '';

    if (invoices.length === 0) {
        warrantyTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-500 py-4">No warranty invoices found.</td></tr>`;
        return;
    }

    const sortedInvoices = [...invoices].sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    warrantyTableBody.innerHTML = sortedInvoices.map(invoice => {
        const invoiceDate = invoice.createdAt?.toDate().toLocaleDateString() || 'N/A';
        const statusClass = invoice.status === 'paid' ? 'status-completed' : 'status-needs-scheduling';
        return `
            <tr>
                <td class="font-medium text-slate-800">${invoice.invoiceNumber || 'N/A'}</td>
                <td>${invoice.customerName || 'N/A'}</td>
                <td>${invoiceDate}</td>
                <td><span class="status-pill ${(invoice.invoiceType || '').toLowerCase() === 'warranty' ? 'status-awaiting-completion' : 'status-link-sent'}">${invoice.invoiceType || 'N/A'}</span></td>
                <td>${formatCurrency(invoice.total)}</td>
                <td><span class="status-pill ${statusClass}">${invoice.status || 'N/A'}</span></td>
                <td><button class="btn-secondary-stitch view-invoice-btn" data-id="${invoice.id}">View Details</button></td>
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
            <p class="text-sm text-slate-600 truncate"><span class="material-icons-outlined text-sm text-green-600 vm">location_on</span> <strong>Start:</strong> ${tech.startLocation || tech.currentLocation || 'Not set'}</p>
            <p class="text-sm text-slate-600 truncate"><span class="material-icons-outlined text-sm text-red-600 vm">location_on</span> <strong>End:</strong> ${tech.endLocation || 'Not set'}</p>
            <p class="text-sm text-slate-600"><span class="material-icons-outlined text-sm text-blue-600 vm">speed</span> Capacity: ${tech.maxJobs} jobs/day</p>
            <div class="mt-2 flex items-center justify-between">
                <span class="status-pill ${statusClass}">${tech.status}</span>
                <button class="btn-secondary-stitch manage-tech-btn" data-id="${tech.id}">Manage</button>
            </div>
        </div>
        `;
    }).join('');
}

function updateTechnicianCardUI(technicianId) {
    const sheet = currentTripSheets.find(s => s.technicianId === technicianId);
    const tech = allTechniciansData.find(t => t.id === technicianId);
    if (!sheet || !tech) return;

    const jobCount = sheet.route.length;
    const maxJobs = tech.maxJobs || 0;

    const card = document.getElementById(`trip-sheet-${technicianId}`);
    if (!card) return;

    const countEl = card.querySelector('.text-sm.font-medium.text-slate-500');
    if (countEl) {
        countEl.textContent = `${jobCount} / ${maxJobs} Jobs`;
    }

    const warningContainer = document.getElementById(`capacity-warning-${technicianId}`);
    const warningMessageEl = warningContainer.querySelector('.warning-message');

    if (jobCount > maxJobs) {
        warningMessageEl.textContent = 'Capacity Exceeded!';
        warningContainer.classList.remove('hidden');
    } else {
        warningContainer.classList.add('hidden');
    }
}

function renderTripSheets(tripSheets, date, isApproved = false) {
    currentTripSheets = tripSheets;
    if (!tripSheetsContainer) return;

    const displayDate = date ? new Date(date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "the selected date";

    if (!tripSheets || tripSheets.length === 0) {
        tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-slate-400"><span class="material-icons-outlined text-4xl">calendar_today</span><p>No trip sheets have been generated for ${displayDate}.</p></div>`;
        tripSheetApprovalContainer.classList.add('hidden');
        return;
    }

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
    
    tripSheets.forEach(sheet => {
        const avatarChar = sheet.technicianName ? sheet.technicianName.charAt(0).toUpperCase() : 'T';
        const tech = allTechniciansData.find(t => t.id === sheet.technicianId);
        const jobCount = sheet.route.length;
        const maxJobs = tech ? tech.maxJobs : 'N/A';

        html += `
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-lg trip-sheet-card" id="trip-sheet-${sheet.technicianId}" data-technician-id="${sheet.technicianId}">
            <h4 class="font-semibold text-slate-800 text-lg mb-3 flex items-center justify-between">
                <div class="flex items-center">
                    <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-white shadow-sm mr-3" style='background-image: url("https://placehold.co/40x40/059669/FFFFFF?text=${avatarChar}");'></div>
                    <span>${sheet.technicianName}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-md">${jobCount} / ${maxJobs} Jobs</span>
                    <div id="capacity-warning-${sheet.technicianId}" class="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-md flex items-center hidden">
                        <span class="material-icons-outlined text-sm mr-1">warning</span>
                        <span class="warning-message"></span>
                    </div>
                </div>
            </h4>
            <div class="tech-route-container space-y-2 min-h-[100px]" data-technician-id="${sheet.technicianId}">
                ${sheet.route.map(job => `
                    <div class="job-card p-3 border bg-white rounded-lg shadow-sm ${isApproved ? 'cursor-default' : 'cursor-grab'}" data-job-id="${job.id}">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-semibold text-sm text-slate-800">${job.address}</p>
                                <p class="text-xs text-slate-600">${job.customer} - ${job.issue}</p>
                            </div>
                            ${isApproved ? '' : `
                            <button class="unschedule-btn text-slate-400 hover:text-red-500 transition-colors" data-job-id="${job.id}" data-technician-id="${sheet.technicianId}" title="Unschedule Job">
                                <span class="material-icons-outlined text-base">event_busy</span>
                            </button>
                            `}
                        </div>
                        <div class="mt-2 pt-2 border-t border-slate-100">
                            <span class="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">${job.timeSlot}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    });
    html += '</div>'; // Close the grid
    tripSheetsContainer.innerHTML = html;

    if (isApproved) {
        tripSheetApprovalContainer.classList.remove('hidden');
        approveTripSheetsBtn.disabled = true;
        approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle_outline</span>Sheets Approved`;
    } else {
        tripSheetApprovalContainer.classList.remove('hidden');
        approveTripSheetsBtn.disabled = false;
        approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle</span>Approve Trip Sheets`;
    }

    // Initialize SortableJS only if the sheets are not approved
    if (!isApproved) {
        const containers = document.querySelectorAll('.tech-route-container');
        containers.forEach(container => {
            new Sortable(container, {
                group: 'trip-sheets',
                animation: 150,
                handle: '.job-card',
                onEnd: async (evt) => {
                    const jobId = evt.item.dataset.jobId;
                    const fromTechnicianId = evt.from.dataset.technicianId;
                    const toTechnicianId = evt.to.dataset.technicianId;
                    const newIndex = evt.newIndex;
                    const oldIndex = evt.oldIndex;

                    const sourceSheet = currentTripSheets.find(s => s.technicianId === fromTechnicianId);
                    const destinationSheet = currentTripSheets.find(s => s.technicianId === toTechnicianId);
                    
                    if (!sourceSheet || !destinationSheet) {
                        console.error("Could not find trip sheets for drag operation.");
                        return;
                    }

                    const jobToMove = sourceSheet.route.find(j => j.id === jobId);
                    if (!jobToMove) {
                         console.error("Could not find job to move in local state.");
                         evt.from.insertBefore(evt.item, evt.from.children[oldIndex]);
                         return;
                    }
                    
                    const jobIndexInSource = sourceSheet.route.findIndex(j => j.id === jobId);
                    sourceSheet.route.splice(jobIndexInSource, 1);
                    destinationSheet.route.splice(newIndex, 0, jobToMove);

                    try {
                        const batch = db.batch();
                        const date = tripSheetDateInput.value;
                        
                        const sourceSheetRef = db.collection('previewTripSheets').doc(`${date}_${fromTechnicianId}`);
                        batch.update(sourceSheetRef, { route: sourceSheet.route });

                        if (fromTechnicianId !== toTechnicianId) {
                            const destinationSheetRef = db.collection('previewTripSheets').doc(`${date}_${toTechnicianId}`);
                            batch.update(destinationSheetRef, { route: destinationSheet.route });
                        }

                        await batch.commit();
                        
                        updateTechnicianCardUI(fromTechnicianId);
                        if (fromTechnicianId !== toTechnicianId) {
                            updateTechnicianCardUI(toTechnicianId);
                        }

                    } catch (error) {
                        console.error("Error updating trip sheets after drag:", error);
                        showMessage("Error saving changes. Reverting.", "error");

                        const [revertedJob] = destinationSheet.route.splice(newIndex, 1);
                        sourceSheet.route.splice(jobIndexInSource, 0, revertedJob);
                        evt.from.insertBefore(evt.item, evt.from.children[oldIndex]);
                    }
                }
            });
        });
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

function renderInvoiceStats(invoices) {
    const statsTotalInvoices = document.getElementById('statsTotalInvoices');
    const statsUnclaimedInvoices = document.getElementById('statsUnclaimedInvoices');
    const statsClaimedInvoices = document.getElementById('statsClaimedInvoices');
    const statsClaimedValue = document.getElementById('statsClaimedValue');

    let totalCount = invoices.length;
    let unclaimedCount = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'Claimed').length;
    let claimedCount = invoices.filter(inv => inv.status === 'paid' || inv.status === 'Claimed').length;
    let claimedValue = invoices.filter(inv => inv.status === 'paid' || inv.status === 'Claimed').reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    if (statsTotalInvoices) statsTotalInvoices.textContent = totalCount;
    if (statsUnclaimedInvoices) statsUnclaimedInvoices.textContent = unclaimedCount;
    if (statsClaimedInvoices) statsClaimedInvoices.textContent = claimedCount;
    if (statsClaimedValue) statsClaimedValue.textContent = formatCurrency(claimedValue);
}

function updateDashboard(data) {
    currentFilteredData = data; // Store current filtered data
    renderInvoiceStats(data);
    renderProviderCardCounts(data);
    renderWarrantyInvoices(data.slice(0, 5));
}

function renderInvoiceDashboard(invoices) {
    const statsTotalInvoices = document.getElementById('inv_statsTotalInvoices');
    const statsWarrantyInvoices = document.getElementById('inv_statsWarrantyInvoices');
    const statsCustomerInvoices = document.getElementById('inv_statsCustomerInvoices');
    const statsTotalValue = document.getElementById('inv_statsTotalValue');

    let totalCount = 0;
    let warrantyCount = 0;
    let customerCount = 0;
    let totalValue = 0;

    if (invoices) {
        totalCount = invoices.length;
        invoices.forEach(inv => {
            const type = inv.invoiceType ? inv.invoiceType.toLowerCase() : '';
            if (type === 'warranty') {
                warrantyCount++;
            } else if (type === 'customer') {
                customerCount++;
            }
            totalValue += inv.total || 0;
        });
    }

    if (statsTotalInvoices) statsTotalInvoices.textContent = totalCount;
    if (statsWarrantyInvoices) statsWarrantyInvoices.textContent = warrantyCount;
    if (statsCustomerInvoices) statsCustomerInvoices.textContent = customerCount;
    if (statsTotalValue) statsTotalValue.textContent = formatCurrency(totalValue);
}

function renderProviderCardCounts(invoices) {
    const providers = { firstAmerican: { count: 0, value: 0 }, homeGuard: { count: 0, value: 0 }, others: { count: 0, value: 0 } };
    invoices.forEach(inv => {
        const pName = inv.warrantyName?.toLowerCase() || 'other';
        const total = inv.total || 0;
        if (pName.includes('first american')) { 
            providers.firstAmerican.count++; 
            providers.firstAmerican.value += total; 
        }
        else if (pName.includes('home guard')) { 
            providers.homeGuard.count++; 
            providers.homeGuard.value += total; 
        }
        else { 
            providers.others.count++; 
            providers.others.value += total; 
        }
    });
    document.getElementById('firstAmericanStats').innerHTML = `${providers.firstAmerican.count} <span class="provider-card-subtext">${formatCurrency(providers.firstAmerican.value)}</span>`;
    document.getElementById('homeGuardStats').innerHTML = `${providers.homeGuard.count} <span class="provider-card-subtext">${formatCurrency(providers.homeGuard.value)}</span>`;
    document.getElementById('othersStats').innerHTML = `${providers.others.count} <span class="provider-card-subtext">${formatCurrency(providers.others.value)}</span>`;
}

function openProviderClaimsWorkspace(providerName, invoices) { // Changed parameter name
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

    // Filter the flat invoice list directly
    const filteredInvoices = invoices.filter(inv => {
        const pName = inv.warrantyName?.toLowerCase() || 'other';
        if (providerKey === 'first american') return pName.includes('first american');
        if (providerKey === 'home guard') return pName.includes('home guard');
        if (providerKey === 'others') return !pName.includes('first american') && !pName.includes('home guard');
        return false;
    });

    let unclaimedCount = 0;
    let claimedCount = 0;

    // Iterate over the filtered invoices
    filteredInvoices.forEach(inv => {
        const card = document.createElement('div');
        card.className = 'invoice-card';
        card.dataset.invoiceNumber = inv.invoiceNumber;
        card.dataset.invoiceId = inv.id; // Use invoice ID
        const isClaimed = inv.status === 'paid' || inv.status === 'Claimed';

        card.innerHTML = `<div class="flex justify-between items-start"><div><p class="font-semibold text-slate-800">${inv.customerName || 'N/A'}</p><p class="text-xs text-slate-500">#${inv.invoiceNumber || 'N/A'} &bull; ${inv.createdAt?.toDate().toLocaleDateString() || 'N/A'}</p></div><p class="font-bold text-lg text-green-600">${formatCurrency(inv.total)}</p></div><div class="mt-3 flex justify-end items-center gap-2"><button class="btn-secondary-stitch text-xs view-invoice-btn" data-id="${inv.id}">View Invoice</button>${!isClaimed ? `<button class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-md process-claim-btn">Process Claim</button>` : ''}</div>`;

        if(isClaimed) { 
            card.classList.add('claimed'); 
            claimedList.appendChild(card); 
            claimedCount++; 
        } else { 
            unclaimedList.appendChild(card); 
            unclaimedCount++; 
        }
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

function openAllJobsOverlay(invoices, technicianName = 'All Technicians') {
    const tableBody = document.getElementById('allJobsTableBody');
    const title = document.getElementById('allJobsTitle');
    const allJobsOverlay = document.getElementById('allJobsOverlay');
    const searchInput = document.getElementById('jobsSearchInput');
    if (!tableBody || !allJobsOverlay || !searchInput) return;

    const baseFilteredInvoices = technicianName === 'All Technicians'
        ? invoices
        : invoices.filter(invoice => invoice.workerName && invoice.workerName.toLowerCase() === technicianName.toLowerCase());

    const renderJobs = (invoicesToRender) => {
        const sortedInvoices = [...invoicesToRender].sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
        title.textContent = `${technicianName} - Completed Jobs (${sortedInvoices.length})`;
        tableBody.innerHTML = sortedInvoices.map(invoice => {
            const completionDate = invoice.createdAt?.toDate().toLocaleDateString() || 'N/A';
            return `<tr><td class="font-medium text-slate-800">${invoice.customerName||'N/A'}</td><td>${invoice.customerAddress||'N/A'}</td><td>${completionDate}</td><td>${invoice.workerName||'N/A'}</td><td><button class="btn-secondary-stitch view-invoice-btn" data-id="${invoice.id}">View Details</button></td></tr>`;
        }).join('');
    };

    renderJobs(baseFilteredInvoices);
    
    searchInput.value = '';
    searchInput.oninput = () => {
        const searchTerms = searchInput.value.toLowerCase().split(' ').filter(term => term.trim() !== '');
        
        const searchFilteredInvoices = baseFilteredInvoices.filter(invoice => {
            if (searchTerms.length === 0) return true;

            return searchTerms.every(term => {
                const invoiceDate = invoice.createdAt?.toDate().toLocaleDateString().toLowerCase() || '';
                
                return (
                    (invoice.customerName && invoice.customerName.toLowerCase().includes(term)) ||
                    (invoice.customerAddress && invoice.customerAddress.toLowerCase().includes(term)) ||
                    (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(term)) ||
                    (invoice.customerPhone && invoice.customerPhone.toLowerCase().includes(term)) ||
                    (invoice.poNumber && invoice.poNumber.toLowerCase().includes(term)) ||
                    (invoiceDate.includes(term)) ||
                    (invoice.warrantyName && invoice.warrantyName.toLowerCase().includes(term))
                );
            });
        });
        renderJobs(searchFilteredInvoices);
    };

    allJobsOverlay.classList.add('is-visible');
}

function openTechnicianInvoicesOverlay(technicianName) {
    const overlay = document.getElementById('technicianInvoicesOverlay');
    const title = document.getElementById('technicianInvoicesTitle');
    const tableBody = document.getElementById('technicianInvoicesTableBody');
    const searchInput = document.getElementById('technicianInvoicesSearchInput');

    if (!overlay || !title || !tableBody || !searchInput) return;

    title.textContent = `Invoices for ${technicianName}`;
    const filteredInvoices = allInvoicesData.filter(inv => inv.workerName && inv.workerName.toLowerCase() === technicianName.toLowerCase());
    
    renderTechnicianInvoices(filteredInvoices, tableBody);

    searchInput.value = '';
    searchInput.oninput = () => {
        const searchTerms = searchInput.value.toLowerCase().split(' ').filter(term => term.trim() !== '');
        
        const searchFilteredInvoices = filteredInvoices.filter(invoice => {
            if (searchTerms.length === 0) return true;

            return searchTerms.every(term => {
                const invoiceDate = invoice.createdAt?.toDate().toLocaleDateString().toLowerCase() || '';
                
                return (
                    (invoice.customerName && invoice.customerName.toLowerCase().includes(term)) ||
                    (invoice.customerAddress && invoice.customerAddress.toLowerCase().includes(term)) ||
                    (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(term)) ||
                    (invoice.customerPhone && invoice.customerPhone.toLowerCase().includes(term)) ||
                    (invoice.poNumber && invoice.poNumber.toLowerCase().includes(term)) ||
                    (invoiceDate.includes(term)) ||
                    (invoice.warrantyName && invoice.warrantyName.toLowerCase().includes(term))
                );
            });
        });
        renderTechnicianInvoices(searchFilteredInvoices, tableBody);
    };

    overlay.classList.add('is-visible');
}

function renderTechnicianInvoices(invoices, tableBody) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (invoices.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-500 py-4">No invoices found for this technician.</td></tr>`;
        return;
    }

    const sortedInvoices = [...invoices].sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    tableBody.innerHTML = sortedInvoices.map(invoice => {
        const invoiceDate = invoice.createdAt?.toDate().toLocaleDateString() || 'N/A';
        const statusClass = invoice.status === 'paid' ? 'status-completed' : 'status-needs-scheduling';
        return `
            <tr>
                <td class="font-medium text-slate-800">${invoice.invoiceNumber || 'N/A'}</td>
                <td>${invoice.customerName || 'N/A'}</td>
                <td>${invoiceDate}</td>
                <td><span class="status-pill ${invoice.invoiceType.toLowerCase() === 'warranty' ? 'status-awaiting-completion' : 'status-link-sent'}">${invoice.invoiceType || 'N/A'}</span></td>
                <td>${formatCurrency(invoice.total)}</td>
                <td><span class="status-pill ${statusClass}">${invoice.status || 'N/A'}</span></td>
                <td><button class="btn-secondary-stitch view-invoice-btn" data-id="${invoice.id}">View Details</button></td>
            </tr>
        `;
    }).join('');
}

function openAllInvoicesOverlay() {
    const overlay = document.getElementById('allInvoicesListOverlay');
    const title = document.getElementById('allInvoicesListTitle');
    const tableBody = document.getElementById('allInvoicesListTableBody');
    const searchInput = document.getElementById('allInvoicesListSearchInput');

    if (!overlay || !title || !tableBody || !searchInput) return;

    title.textContent = `All Invoices (${allInvoicesData.length})`;
    
    renderTechnicianInvoices(allInvoicesData, tableBody);

    searchInput.value = '';
    searchInput.oninput = () => {
        const searchTerms = searchInput.value.toLowerCase().split(' ').filter(term => term.trim() !== '');
        
        const searchFilteredInvoices = allInvoicesData.filter(invoice => {
            if (searchTerms.length === 0) return true;

            return searchTerms.every(term => {
                const invoiceDate = invoice.createdAt?.toDate().toLocaleDateString().toLowerCase() || '';
                
                return (
                    (invoice.customerName && invoice.customerName.toLowerCase().includes(term)) ||
                    (invoice.customerAddress && invoice.customerAddress.toLowerCase().includes(term)) ||
                    (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(term)) ||
                    (invoice.customerPhone && invoice.customerPhone.toLowerCase().includes(term)) ||
                    (invoice.poNumber && invoice.poNumber.toLowerCase().includes(term)) ||
                    (invoiceDate.includes(term)) ||
                    (invoice.warrantyName && invoice.warrantyName.toLowerCase().includes(term))
                );
            });
        });
        renderTechnicianInvoices(searchFilteredInvoices, tableBody);
    };

    overlay.classList.add('is-visible');
}

function openInvoiceTechnicianSelectionOverlay() {
    const overlay = document.getElementById('invoiceTechnicianSelectionOverlay');
    const cardsContainer = document.getElementById('invoiceTechnicianSelectionCards');
    if (!overlay || !cardsContainer) return;

    cardsContainer.innerHTML = `
        <div class="tech-selection-card" data-technician="All Invoices">
            <span class="material-icons-outlined text-5xl text-green-600 mb-2">receipt_long</span>
            <h3 class="text-xl font-bold text-slate-800">View All Invoices</h3>
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
        cardsContainer.appendChild(card);
    });

    overlay.classList.add('is-visible');
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
    const warrantiesQuery = firebase.firestore().collection("invoices").where("invoiceType", "in", ["warranty", "Warranty", "WARRANTY"]);
    warrantiesQuery.onSnapshot((snapshot) => {
        let warranties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort the array on the client-side to avoid needing a composite index
        warranties.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
        allWarrantiesData = warranties; // Store the sorted data
        updateDashboard(allWarrantiesData);
    }, (error) => {
        console.error("Error listening for warranties:", error);
    });
}

function listenForAllInvoices() {
    const invoicesQuery = firebase.firestore().collection("invoices").orderBy("createdAt", "desc");
    invoicesQuery.onSnapshot((snapshot) => {
        allInvoicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderInvoiceDashboard(allInvoicesData);
        renderInvoices(allInvoicesData.slice(0, 5)); // Initially show only the first 5
    }, (error) => {
        console.error("Error listening for all invoices:", error);
    });
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
        const todaysRouteHeading = document.getElementById('todaysRouteHeading');
        const headingText = todaysRouteHeading ? todaysRouteHeading.textContent.toLowerCase() : "the selected day";
        let dayText = "today";
        if (headingText.includes('yesterday')) {
            dayText = "yesterday";
        } else if (headingText.includes('tomorrow')) {
            dayText = "tomorrow";
        }

        workerTodaysRouteEl.innerHTML = `
            <div class="text-center p-8 text-slate-500">
                <span class="material-icons-outlined text-6xl">task_alt</span>
                <h3 class="text-xl font-bold mt-4">All Clear!</h3>
                <p>You have no jobs assigned for ${dayText}.</p>
            </div>
        `;
        return;
    }

    workerTodaysRouteEl.innerHTML = jobs.map(job => {
        if (job.status && job.status.startsWith('Rescheduled by')) {
            return `
        <div class="flex items-center gap-4 bg-slate-50 px-4 min-h-[72px] py-3 justify-between border-b border-slate-100 opacity-60">
            <div class="flex items-center gap-4 overflow-hidden">
                <div class="text-slate-400 flex items-center justify-center rounded-lg bg-slate-200 shrink-0 size-12">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"></path></svg>
                </div>
                <div class="flex flex-col justify-center overflow-hidden">
                    <p class="text-slate-500 text-base font-medium leading-normal truncate" style="text-decoration: line-through;">${job.timeSlot || 'Anytime'}</p>
                    <p class="text-slate-400 text-sm font-normal leading-normal truncate">${job.address}</p>
                </div>
            </div>
            <div class="shrink-0">
                <span class="status-pill status-offline">Rescheduled</span>
            </div>
        </div>
            `;
        } else if (job.status === 'Completed') {
            return `
        <div class="flex items-center gap-4 bg-slate-50 px-4 min-h-[72px] py-3 justify-between border-b border-slate-100 opacity-60">
            <div class="flex items-center gap-4 overflow-hidden">
                <div class="text-slate-400 flex items-center justify-center rounded-lg bg-slate-200 shrink-0 size-12">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="m229.66,77.66-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg>
                </div>
                <div class="flex flex-col justify-center overflow-hidden">
                    <p class="text-slate-500 text-base font-medium leading-normal truncate" style="text-decoration: line-through;">${job.timeSlot || 'Anytime'}</p>
                    <p class="text-slate-400 text-sm font-normal leading-normal truncate">${job.address}</p>
                </div>
            </div>
            <div class="shrink-0">
                <span class="status-pill status-completed">Completed</span>
            </div>
        </div>
            `;
        } else {
            return `
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
    `;
        }
    }).join('');
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
              id="rescheduleBtn"
              data-id="${job.id}"
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

    const rescheduleBtn = document.getElementById('rescheduleBtn');
    if (rescheduleBtn) {
        rescheduleBtn.addEventListener('click', () => {
            const jobId = rescheduleBtn.dataset.id;
            const jobData = currentWorkerAssignedJobs.find(j => j.id === jobId);
            if (jobData) {
                openRescheduleModal(jobData);
            }
        });
    }
}


// --- UI Navigation ---
function switchView(targetId) {
    const settings = loadTabSettings();
    if (settings[targetId] === false) {
        console.warn(`Attempted to switch to a hidden tab: ${targetId}. Action prevented.`);
        return;
    }

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
function openRescheduleModal(job) {
    currentJobToReschedule = job;
    const rescheduleModal = document.getElementById('rescheduleModal');
    const reasonInput = document.getElementById('rescheduleReason');
    reasonInput.value = '';
    rescheduleModal.style.display = 'block';
}

function closeRescheduleModal() {
    const rescheduleModal = document.getElementById('rescheduleModal');
    rescheduleModal.style.display = 'none';
    currentJobToReschedule = null;
}

async function handleRescheduleConfirm() {
    if (!currentJobToReschedule) return;

    const reason = document.getElementById('rescheduleReason').value.trim();
    if (!reason) {
        showMessage('A reason for rescheduling is required.', 'error');
        return;
    }

    const jobRef = firebase.firestore().doc(`jobs/${currentJobToReschedule.id}`);
    const newStatus = `Rescheduled by ${currentWorkerTechnicianName || 'Worker'}`;

    try {
        await jobRef.update({
            status: newStatus,
            rescheduleReason: reason,
            assignedTechnicianId: firebase.firestore.FieldValue.delete(),
            assignedTechnicianName: firebase.firestore.FieldValue.delete()
        });
        showMessage('Job has been rescheduled.', 'success');
        closeRescheduleModal();
        // The listener will automatically refresh the view, but we need to go back to the list
        if (workerNameEl) workerNameEl.textContent = `Hello, ${currentWorkerTechnicianName}`;
        if (workerCurrentDateEl) workerCurrentDateEl.style.display = 'block';
        const todaysRouteHeading = document.getElementById('todaysRouteHeading');
        if (todaysRouteHeading) todaysRouteHeading.style.display = 'block';
        renderWorkerPwaView(currentWorkerAssignedJobs, currentWorkerTechnicianName);

    } catch (error) {
        console.error("Error rescheduling job:", error);
        showMessage('Failed to reschedule job. Please try again.', 'error');
    }
}

function openEditTechModal(tech = null) {
    const modalTitle = document.getElementById('modalTechTitle');
    const techIdInput = document.getElementById('modalTechId');
    const techNameInput = document.getElementById('modalTechName');
    const techStatusInput = document.getElementById('modalTechStatus');
    const techStartLocationInput = document.getElementById('modalTechStartLocation');
    const techEndLocationInput = document.getElementById('modalTechEndLocation');
    const techMaxJobsInput = document.getElementById('modalTechMaxJobs');
    const saveBtn = document.getElementById('saveTechBtn');
    const deleteBtn = document.getElementById('deleteTechBtn');

    if (tech) { // Edit mode
        modalTitle.textContent = `Edit ${tech.name}`;
        techIdInput.value = tech.id;
        techNameInput.value = tech.name;
        techStatusInput.value = tech.status;
        techStartLocationInput.value = tech.startLocation || tech.currentLocation || '';
        techEndLocationInput.value = tech.endLocation || '';
        techMaxJobsInput.value = tech.maxJobs || 5;
        saveBtn.textContent = 'Save Changes';
        deleteBtn.style.display = 'block';
        deleteBtn.dataset.id = tech.id; // Store id for the delete handler
    } else { // Add mode
        modalTitle.textContent = 'Add New Technician';
        editTechForm.reset(); // Clear all form fields
        techIdInput.value = '';
        saveBtn.textContent = 'Add Technician';
        deleteBtn.style.display = 'none';
    }
    editTechModal.style.display = 'block';
}

function closeEditTechModal() {
    editTechModal.style.display = 'none';
    editTechForm.reset();
}

async function openScheduleJobModal(job) {
    if (!job) return;

    const schedulingControlsContainer = document.getElementById('schedulingControlsContainer');
    const associatedInvoicesSection = document.getElementById('associatedInvoicesSection');
    const associatedInvoicesList = document.getElementById('associatedInvoicesList');

    // Reset and hide the invoices section by default
    associatedInvoicesSection.classList.add('hidden');
    associatedInvoicesList.innerHTML = '';

    if (job.status === 'Completed') {
        if(schedulingControlsContainer) schedulingControlsContainer.classList.add('hidden');
        
        // --- NEW LOGIC FOR ASSOCIATED INVOICES ---
        const relatedInvoices = allInvoicesData.filter(invoice => invoice.jobId === job.id);

        if (relatedInvoices.length > 0) {
            const buttonsHtml = relatedInvoices.map(invoice => {
                return `<a href="#" class="btn-invoice-link view-invoice-btn" data-id="${invoice.id}" role="button">
                            <span class="material-icons-outlined">receipt_long</span>
                            <span>Invoice ${invoice.invoiceNumber || 'N/A'} [${invoice.invoiceType || 'N/A'}]</span>
                        </a>`;
            }).join('');
            associatedInvoicesList.innerHTML = `<div class="invoice-button-container">${buttonsHtml}</div>`;
        } else {
            associatedInvoicesList.innerHTML = `<p class="text-slate-500">No associated invoices found.</p>`;
        }
        associatedInvoicesSection.classList.remove('hidden');

    } else {
        if(schedulingControlsContainer) schedulingControlsContainer.classList.remove('hidden');
        associatedInvoicesSection.classList.add('hidden');
    }

    currentJobToReschedule = job; // Store the job globally for this modal
    document.getElementById('modalScheduleJobId').value = job.id;
    document.getElementById('modalScheduleCustomer').textContent = job.customer || 'N/A';
    document.getElementById('modalScheduleAddress').textContent = job.address || 'N/A';
    document.getElementById('modalScheduleIssue').textContent = job.issue || 'N/A';
    document.getElementById('modalScheduleWarrantyProvider').textContent = job.warrantyProvider || 'N/A';
    document.getElementById('modalSchedulePlanType').textContent = job.planType || 'N/A';
    document.getElementById('modalScheduleDispatchOrPoNumber').textContent = job.dispatchOrPoNumber || 'N/A';

    const summaryContainer = document.getElementById('modalScheduleSummaryContainer');
    const summaryEl = document.getElementById('modalScheduleSummary');
    if (summaryEl && summaryContainer) {
        if (job.summary && job.summary.trim() !== '') {
            summaryEl.textContent = job.summary;
            summaryContainer.classList.remove('hidden');
        } else {
            summaryContainer.classList.add('hidden');
        }
    }

    const reasonContainer = document.getElementById('rescheduleReasonContainer');
    const reasonEl = document.getElementById('modalScheduleRescheduleReason');

    if (job.rescheduleReason) {
        reasonEl.textContent = job.rescheduleReason;
        reasonContainer.classList.remove('hidden');
    } else {
        reasonContainer.classList.add('hidden');
    }

    const dateInput = document.getElementById('modalJobDate');
    dateInput.value = job.scheduledDate || new Date().toISOString().split('T')[0];

    const timeSlotSelect = document.getElementById('modalJobTimeSlot');
    timeSlotSelect.value = job.timeSlot || "";

    const technicianContainer = document.getElementById('modalTechnicianContainer');
    const technicianSelect = document.getElementById('modalJobTechnician');
    const assignedToContainer = document.getElementById('modalScheduleAssignedToContainer');
    const assignedToEl = document.getElementById('modalScheduleAssignedTo');
    const confirmBtn = document.getElementById('confirmScheduleBtn');
    const confirmBtnWrapper = document.getElementById('confirmScheduleBtnWrapper');
    const scheduleWarningMessage = document.getElementById('scheduleWarningMessage');

    // Populate technician dropdown once on modal open
    technicianSelect.innerHTML = '<option value="">Select a technician...</option>';
    allTechniciansData.forEach(tech => {
        const option = document.createElement('option');
        option.value = tech.id;
        option.textContent = tech.name;
        technicianSelect.appendChild(option);
    });

    const updateModalState = async () => {
        const selectedDate = dateInput.value;
        const selectedTimeSlot = timeSlotSelect.value;
        const status = job.status || 'Needs Scheduling';

        // 1. Reset state at the beginning of every update
        confirmBtn.disabled = false;
        if (confirmBtnWrapper) confirmBtnWrapper.removeAttribute('title');
        scheduleWarningMessage.textContent = '';
        scheduleWarningMessage.classList.add('hidden');
        technicianContainer.classList.add('hidden');
        assignedToContainer.classList.add('hidden');
        assignedToEl.textContent = ''; // Explicitly clear previous technician name

        // 2. Handle non-interactive states
        if (status === 'Completed') {
            confirmBtn.textContent = 'View Only';
            confirmBtn.disabled = true;
            if (job.assignedTechnicianId && job.assignedTechnicianName) { // Check for ID as well
                assignedToEl.textContent = job.assignedTechnicianName;
                assignedToContainer.classList.remove('hidden');
            }
            return;
        }

        // 3. Perform the main check for trip sheets
        try {
            const tripSheetSnapshot = await db.collection("tripSheets").where("date", "==", selectedDate).get();
            const tripSheetsExistForDate = !tripSheetSnapshot.empty;

            // 4. Determine UI visibility and the technician to check against
            let technicianIdForCheck = job.assignedTechnicianId;
            if (job.assignedTechnicianId && job.assignedTechnicianName) { // Check for name as well
                assignedToEl.textContent = job.assignedTechnicianName;
                assignedToContainer.classList.remove('hidden');
            } else if (tripSheetsExistForDate) {
                technicianContainer.classList.remove('hidden');
                technicianIdForCheck = technicianSelect.value;
            }

            // 5. Set button text and state based on all information
            if (technicianIdForCheck) {
                const techTripSheetDoc = tripSheetsExistForDate ? tripSheetSnapshot.docs.find(doc => doc.data().technicianId === technicianIdForCheck) : null;

                if (techTripSheetDoc) {
                    confirmBtn.textContent = 'Fit into trip sheet';
                    const techTripSheet = techTripSheetDoc.data();
                    const jobInRoute = techTripSheet.route.find(routeJob => routeJob.id === job.id);

                    // Defensively check if the button should be disabled.
                    confirmBtn.disabled = false; // Default to enabled
                    if (jobInRoute) {
                        const existingSlotInRoute = String(jobInRoute.timeSlot || '').trim();
                        const newlySelectedSlot = String(selectedTimeSlot || '').trim();

                        if (existingSlotInRoute === newlySelectedSlot) {
                            confirmBtn.disabled = true;
                            if (confirmBtnWrapper) {
                                confirmBtnWrapper.setAttribute('title', "Job is already in this trip sheet for this time slot.");
                            }
                        }
                    }
                } else {
                    confirmBtn.textContent = 'Confirm Reschedule';
                }
            } else {
                confirmBtn.textContent = 'Confirm Schedule';
            }
        } catch (error) {
            console.error("Error updating schedule button state:", error);
            confirmBtn.textContent = 'Error';
            confirmBtn.disabled = true;
        }
    };

    // Add event listeners
    dateInput.addEventListener('change', updateModalState);
    timeSlotSelect.addEventListener('change', updateModalState);
    technicianSelect.addEventListener('change', updateModalState);

    // Link handling logic (remains the same)
    const linkContainer = document.getElementById('scheduleModalLinkContainer');
    const linkInput = document.getElementById('scheduleModalLinkInput');
    const copyBtn = document.getElementById('scheduleModalCopyBtn');
    if (linkContainer && linkInput && copyBtn) {
        const schedulingUrl = `${window.location.origin}/scheduling.html?jobId=${job.id}`;
        linkInput.value = schedulingUrl;
        if (job.status && (job.status.startsWith('Scheduled') || job.status === 'Awaiting completion' || job.status === 'Completed')) {
            linkContainer.classList.add('hidden');
        } else {
            linkContainer.classList.remove('hidden');
        }
        copyBtn.onclick = () => {
            linkInput.select();
            document.execCommand('copy');
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = `<span class="material-icons-outlined text-lg">check</span>`;
            setTimeout(() => { copyBtn.innerHTML = originalIcon; }, 2000);
        };
    }
    const sendManualLinkBtn = document.getElementById('sendManualLinkBtn');
    if (sendManualLinkBtn) {
        const status = job.status || 'Needs Scheduling';
        if (status === 'Needs Scheduling' || status.startsWith('Rescheduled by')) {
            sendManualLinkBtn.style.visibility = 'visible';
        } else {
            sendManualLinkBtn.style.visibility = 'hidden';
        }
    }
    
    await updateModalState();
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
let storage;

async function initializeTechnicians() {
    const techCollection = firebase.firestore().collection('technicians');
    const snapshot = await techCollection.get();
    if (snapshot.empty) {
        const defaultTechnicians = [
            { name: 'Ibaidallah', status: 'Online', startLocation: '1100 S Flower St, Los Angeles, CA 90015', endLocation: '1100 S Flower St, Los Angeles, CA 90015', maxJobs: 8 },
            { name: 'Khaled', status: 'Online', startLocation: '4059 Van Nuys Blvd, Sherman Oaks, CA 91403', endLocation: '4059 Van Nuys Blvd, Sherman Oaks, CA 91403', maxJobs: 5 },
            { name: 'Ahmed', status: 'Online', startLocation: '189 The Grove Dr, Los Angeles, CA 90036', endLocation: '189 The Grove Dr, Los Angeles, CA 90036', maxJobs: 5 },
            { name: 'Omar', status: 'Offline', startLocation: 'Home Base', endLocation: 'Home Base', maxJobs: 5 }
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

let bookedJobsListener = null;

function renderCapacityAndUsage(technicians, bookedJobs) {
    const onlineTechs = technicians.filter(tech => tech.status === 'Online');
    const totalCapacity = onlineTechs.reduce((sum, tech) => sum + (tech.maxJobs || 0), 0);

    const base = Math.floor(totalCapacity / 3);
    const remainder = totalCapacity % 3;

    let slot1_capacity = base; // 8am-2pm
    let slot2_capacity = base; // 9am-4pm
    let slot3_capacity = base; // 12pm-6pm

    if (remainder === 1) {
        slot2_capacity += 1;
    } else if (remainder === 2) {
        slot1_capacity += 1;
        slot2_capacity += 1;
    }

    const slot1_booked = bookedJobs.filter(j => j.timeSlot === '8am to 2pm').length;
    const slot2_booked = bookedJobs.filter(j => j.timeSlot === '9am to 4pm').length;
    const slot3_booked = bookedJobs.filter(j => j.timeSlot === '12pm to 6pm').length;
    const total_booked = slot1_booked + slot2_booked + slot3_booked;

    document.getElementById('capacity-total-used').textContent = total_booked;
    document.getElementById('capacity-total-total').textContent = totalCapacity;
    document.getElementById('capacity-slot1-used').textContent = slot1_booked;
    document.getElementById('capacity-slot1-total').textContent = slot1_capacity;
    document.getElementById('capacity-slot2-used').textContent = slot2_booked;
    document.getElementById('capacity-slot2-total').textContent = slot2_capacity;
    document.getElementById('capacity-slot3-used').textContent = slot3_booked;
    document.getElementById('capacity-slot3-total').textContent = slot3_capacity;
}

function listenForBookedCounts(dateString) {
    if (bookedJobsListener) {
        bookedJobsListener(); // Detach previous listener
    }
    const jobsQuery = db.collection('jobs')
                        .where('scheduledDate', '==', dateString)
                        .where('status', 'in', ['Scheduled', 'Awaiting completion']);

    bookedJobsListener = jobsQuery.onSnapshot(snapshot => {
        const bookedJobs = snapshot.docs.map(doc => doc.data());
        renderCapacityAndUsage(allTechniciansData, bookedJobs);
    }, (error) => {
        console.error(`Error listening for booked jobs on ${dateString}:`, error);
        // Display zeros if there's an error
        renderCapacityAndUsage(allTechniciansData, []);
    });
}

function listenForTechnicians() {
    const techQuery = firebase.firestore().collection("technicians");
    techQuery.onSnapshot((snapshot) => {
        const technicians = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTechniciansData = technicians;
        renderTechnicians(technicians); 
        populateTechnicianDropdowns();
        
        const capacityDatePicker = document.getElementById('capacity-date-picker');
        if (capacityDatePicker && capacityDatePicker.value) {
            // This will re-run the renderCapacityAndUsage with the new technician data
            // and the existing booking data from its own listener.
            listenForBookedCounts(capacityDatePicker.value);
        }
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

async function fetchAndRenderJobsForDate(date, technicianId, technicianName) {
    const todaysRouteHeading = document.getElementById('todaysRouteHeading');
    if (workerJobsListener) {
        workerJobsListener(); // Detach any previous real-time listener
        workerJobsListener = null;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Update heading text
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateCopy = new Date(date);
    dateCopy.setHours(0,0,0,0);

    if (dateCopy.getTime() === today.getTime()) {
        todaysRouteHeading.textContent = "Today's Route";
    } else {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        if (dateCopy.getTime() === yesterday.getTime()) {
            todaysRouteHeading.textContent = "Yesterday's Route";
        } else if (dateCopy.getTime() === tomorrow.getTime()) {
            todaysRouteHeading.textContent = "Tomorrow's Route";
        } else {
            todaysRouteHeading.textContent = `Route for ${date.toLocaleDateString()}`;
        }
    }

    try {
        const jobsQuery = firebase.firestore().collection("jobs")
            .where("assignedTechnicianId", "==", technicianId)
            .where("scheduledDate", "==", dateString);
        
        const snapshot = await jobsQuery.get();
        const assignedJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Step 2: Fetch the trip sheet to get the correct order
        const tripSheetId = `${dateString}_${technicianId}`;
        const tripSheetRef = db.collection("tripSheets").doc(tripSheetId);
        const sheetDoc = await tripSheetRef.get();

        if (sheetDoc.exists) {
            const sheetData = sheetDoc.data();
            const orderedJobIds = sheetData.route.map(j => j.id);

            const jobsById = new Map(assignedJobs.map(job => [job.id, job]));
            const correctlyOrderedJobs = orderedJobIds.map(id => jobsById.get(id)).filter(Boolean);
            
            renderWorkerPwaView(correctlyOrderedJobs, technicianName);
        } else {
            // No trip sheet, render in default order
            renderWorkerPwaView(assignedJobs, technicianName);
        }

    } catch (error) {
        console.error(`Error fetching jobs for date ${dateString}:`, error);
        if (workerTodaysRouteEl) {
            workerTodaysRouteEl.innerHTML = `<div class="text-center p-8 text-red-500"><p>Error loading jobs for the selected date.</p></div>`;
        }
    }
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

    const todaysRouteHeading = document.getElementById('todaysRouteHeading');
    if(todaysRouteHeading) todaysRouteHeading.textContent = "Today's Route";

    const jobsQuery = firebase.firestore().collection("jobs")
        .where("participatingTechnicians", "array-contains", technicianId)
        .where("scheduledDate", "==", todayDateString);

    workerJobsListener = jobsQuery.onSnapshot(async (snapshot) => {
        const assignedJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Step 2: Fetch the trip sheet to get the correct order
        const tripSheetId = `${todayDateString}_${technicianId}`;
        const tripSheetRef = db.collection("tripSheets").doc(tripSheetId);
        const sheetDoc = await tripSheetRef.get();

        if (sheetDoc.exists) {
            const sheetData = sheetDoc.data();
            const orderedJobIds = sheetData.route.map(j => j.id);

            const jobsById = new Map(assignedJobs.map(job => [job.id, job]));
            const correctlyOrderedJobs = orderedJobIds.map(id => jobsById.get(id)).filter(Boolean);
            
            currentWorkerAssignedJobs = correctlyOrderedJobs;
            renderWorkerPwaView(correctlyOrderedJobs, technicianName);
        } else {
            // No trip sheet, render in default order
            currentWorkerAssignedJobs = assignedJobs;
            renderWorkerPwaView(assignedJobs, technicianName);
        }
    }, (error) => {
        console.error(`Error listening for jobs for technician ${technicianId}:`, error);
        if (workerTodaysRouteEl) {
            workerTodaysRouteEl.innerHTML = `<div class="text-center p-8 text-red-500"><p>Error loading your jobs. Please try again later.</p></div>`;
        }
    });
}

    const tourGuidePopup = document.getElementById('tour-guide-popup');

    if (activateEmailBtn && emailWritingPopup && tourGuidePopup) {
        activateEmailBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentChatMode === 'tour_guide') {
                emailWritingPopup.style.display = 'flex';
                tourGuidePopup.style.display = 'none';
                emailWritingPopup.classList.toggle('is-visible');
            } else {
                tourGuidePopup.style.display = 'flex';
                emailWritingPopup.style.display = 'none';
                tourGuidePopup.classList.toggle('is-visible');
            }
        });

        emailWritingPopup.addEventListener('click', () => {
            activateEmailWritingMode();
        });

        tourGuidePopup.addEventListener('click', () => {
            clearBackendChatMemory();
            initializeDanielAIChat();
            activateEmailBtn.innerHTML = `<i class="fas fa-plus"></i>`;
            tourGuidePopup.classList.remove('is-visible');
        });
    }

    window.addEventListener('click', (e) => {
        if (emailWritingPopup && emailWritingPopup.classList.contains('is-visible')) {
            if (!emailWritingPopup.contains(e.target) && !activateEmailBtn.contains(e.target)) {
                emailWritingPopup.classList.remove('is-visible');
            }
        }
        if (tourGuidePopup && tourGuidePopup.classList.contains('is-visible')) {
            if (!tourGuidePopup.contains(e.target) && !activateEmailBtn.contains(e.target)) {
                tourGuidePopup.classList.remove('is-visible');
            }
        }
    });


// --- Form Submit Handlers & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Consolidated DOM element declarations
    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginErrorMessage = document.getElementById('loginErrorMessage');
    const backToInvoiceFormBtn = document.getElementById('backToInvoiceFormBtn');
    if (backToInvoiceFormBtn) {
        backToInvoiceFormBtn.addEventListener('click', () => {
            if (afterSendInvoiceScreen) {
                afterSendInvoiceScreen.classList.add('hidden');
            }
            if (invoiceFormScreen) {
                invoiceFormScreen.classList.remove('hidden');
            }
        });
    }
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
if(showAllInvoicesBtn) {
    showAllInvoicesBtn.addEventListener('click', () => {
        openInvoiceTechnicianSelectionOverlay();
    });
}
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
            signatureCanvas.height = container.offsetHeight * ratio;
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

    const warrantyLaborInput = document.getElementById('warrantyLabor');
    const customerLaborInput = document.getElementById('customerLabor');
    const warrantyServiceCallInput = document.getElementById('warrantyServiceCall');
    const customerServiceCallInput = document.getElementById('customerServiceCall');

    if(warrantyLaborInput) warrantyLaborInput.addEventListener('input', updateTotals);
    if(customerLaborInput) customerLaborInput.addEventListener('input', updateTotals);
    if(warrantyServiceCallInput) warrantyServiceCallInput.addEventListener('input', updateTotals);
    if(customerServiceCallInput) customerServiceCallInput.addEventListener('input', updateTotals);

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

if(saveInvoiceBtn) {
    saveInvoiceBtn.addEventListener('click', async function() {
        // Run all the form validation checks first
        const paymentMethodRadio = document.querySelector('input[name="paymentMethod"]:checked');
        if (!paymentMethodRadio) {
            showMessage("A payment method is required.", "error");
            return;
        }
        if (!invoiceFormEl.checkValidity()) {
             showMessage("Please fill out all required fields.", "error");
             invoiceFormEl.reportValidity();
             return;
        }

        let imageUrls = [];
        try {
            const uploadButton = this;
            uploadButton.disabled = true;
            uploadButton.textContent = 'Uploading Images...';
            
            imageUrls = await uploadInvoiceImages(currentJobIdForInvoicing);
            
            uploadButton.textContent = 'Saving Invoice...';
        } catch (error) {
            this.disabled = false;
            this.textContent = 'Save Invoice';
            // The upload function already shows an error message.
            return;
        }

        // --- NEW LOGIC ---
        // 1. Clear any old invoices from the queue.
        pendingInvoices = [];

        // 2. Create the invoice objects.
        collectInvoiceData(imageUrls); 
        
        // 3. Generate a Base64 PDF for each invoice in the queue.
        for (const invoice of pendingInvoices) {
            try {
                // The generatePDF function returns the Base64 string
                invoice.pdfDataURL = await generatePDF(invoice, true); // Generate with preview watermark
                if (!invoice.pdfDataURL) {
                     showMessage(`Warning: Could not generate PDF for the ${invoice.invoiceType} invoice.`, 'info');
                }
            } catch (pdfError) {
                console.error(`Error during PDF generation for ${invoice.invoiceType} invoice:`, pdfError);
                showMessage(`Error generating PDF for the ${invoice.invoiceType} invoice. It will be queued without it.`, 'error');
            }
        }
        
        // 4. Show a success message and switch to the review screen.
        showMessage('Invoice(s) generated and ready for review.', 'success');
        showAfterSendInvoiceScreen();
    });
}
    

    if(clearFormBtn) clearFormBtn.addEventListener('click', () => {
        showConfirmationModal(
            "Clear Form",
            "Are you sure you want to clear the form? Unsaved data will be lost.",
            () => {
                if(invoiceFormEl) invoiceFormEl.reset();
            if (imagePreviewContainer) imagePreviewContainer.innerHTML = '';
            invoiceImageFiles = [];
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
            
            const updatedPdfData = await generatePDF(invoiceToUpdate);

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
        if (!currentlyViewedInvoiceData) {
            showMessage('No invoice data to preview.', 'error');
            return;
        }

        // Always generate a fresh PDF to ensure it's up-to-date
        const pdfData = await generatePDF(currentlyViewedInvoiceData, false); // isPreview = false for final look

        if (pdfData) {
            const pdfPreviewModal = document.getElementById('pdfPreviewModal');
            const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');
            const closePdfPreviewBtn = document.getElementById('closePdfPreview');

            if (pdfPreviewModal && pdfPreviewFrame && closePdfPreviewBtn) {
                try {
                    const response = await fetch(pdfData);
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    
                    pdfPreviewFrame.src = objectUrl;

                    const closePreview = () => {
                        URL.revokeObjectURL(objectUrl);
                        pdfPreviewModal.classList.add('hidden');
                        pdfPreviewModal.classList.remove('flex');
                        pdfPreviewFrame.src = 'about:blank';
                    };

                    closePdfPreviewBtn.onclick = closePreview;
                    pdfPreviewModal.onclick = (e) => {
                        if (e.target === pdfPreviewModal) {
                            closePreview();
                        }
                    };

                    pdfPreviewModal.classList.remove('hidden');
                    pdfPreviewModal.classList.add('flex');
                } catch (error) {
                    console.error("Error creating PDF preview:", error);
                    showMessage('Could not generate PDF preview.', 'error');
                }
            }
        } else {
            showMessage('Failed to generate PDF for preview.', 'error');
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
    // if(showAllInvoicesBtn) showAllInvoicesBtn.addEventListener('click', () => showInvoiceListScreen()); // This was causing the redirect to the Jobs tab. The correct listener is defined earlier.
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

    if (invoiceSearchInput) {
        invoiceSearchInput.addEventListener('input', filterInvoices);
    }

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
    
    const rescheduleModal = document.getElementById('rescheduleModal');
    if (rescheduleModal) {
        const confirmBtn = rescheduleModal.querySelector('.confirm-btn');
        const cancelBtn = rescheduleModal.querySelector('.cancel-btn');
        const closeBtn = rescheduleModal.querySelector('.close-button');

        confirmBtn.addEventListener('click', handleRescheduleConfirm);
        cancelBtn.addEventListener('click', closeRescheduleModal);
        closeBtn.addEventListener('click', closeRescheduleModal);
    }

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

    if(sendSchedulingLinksBtn) sendSchedulingLinksBtn.addEventListener('click', async () => {
        sendSchedulingLinksBtn.disabled = true;
        sendSchedulingLinksBtn.innerHTML = `<span class="material-icons-outlined text-lg animate-spin">sync</span> Sending...`;
        
        try {
            const response = await fetch(SEND_SCHEDULING_LINKS_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({}) });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            showMessage(result.message || 'Links sent successfully!', 'success');
        } catch (error) {
            console.error('Error sending scheduling links:', error);
            showMessage(`Error: ${error.message}`, 'error');
        } finally {
            sendSchedulingLinksBtn.disabled = false;
            sendSchedulingLinksBtn.innerHTML = `<span class="material-icons-outlined text-lg">send</span>Send Scheduling Links`;
        }
    });

    const sendManualLinkBtn = document.getElementById('sendManualLinkBtn');
    if (sendManualLinkBtn) {
        sendManualLinkBtn.addEventListener('click', async () => {
            const jobId = document.getElementById('modalScheduleJobId').value;
            const statusSpan = document.getElementById('manualLinkStatus');

            if (!jobId) {
                showMessage('Cannot send link: Job ID is missing.', 'error');
                return;
            }

            const originalBtnHtml = sendManualLinkBtn.innerHTML;
            sendManualLinkBtn.disabled = true;
            sendManualLinkBtn.innerHTML = `<span class="material-icons-outlined text-lg animate-spin">sync</span> Sending...`;
            if (statusSpan) statusSpan.textContent = '';

            try {
                const response = await fetch(SEND_SCHEDULING_LINKS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jobId: jobId })
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || `Server responded with status ${response.status}`);
                }

                // Definite success
                showMessage(result.message, 'success');
                if (statusSpan) {
                    statusSpan.textContent = 'Link sent successfully!';
                    statusSpan.classList.remove('text-red-600');
                    statusSpan.classList.add('text-green-600');
                    setTimeout(() => { statusSpan.textContent = ''; }, 5000);
                }

            } catch (error) {
                console.error('Error sending manual scheduling link:', error);
                showMessage(error.message, 'error');
                if (statusSpan) {
                    statusSpan.textContent = 'Failed to send!';
                    statusSpan.classList.remove('text-green-600');
                    statusSpan.classList.add('text-red-600');
                    setTimeout(() => { statusSpan.textContent = ''; }, 5000);
                }
            } finally {
                sendManualLinkBtn.disabled = false;
                sendManualLinkBtn.innerHTML = originalBtnHtml;
            }
        });
    }
    if(openAddPartModalButton) openAddPartModalButton.addEventListener('click', () => openAddPartModal());
    if(openLogPartUsageButton) openLogPartUsageButton.addEventListener('click', openLogPartUsageModal);

    // Form Submissions
    if(editTechForm) editTechForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const techId = document.getElementById('modalTechId').value;
        const techData = {
            name: document.getElementById('modalTechName').value,
            status: document.getElementById('modalTechStatus').value,
            startLocation: document.getElementById('modalTechStartLocation').value,
            endLocation: document.getElementById('modalTechEndLocation').value,
            maxJobs: parseInt(document.getElementById('modalTechMaxJobs').value, 10) || 0,
        };

        try {
            if (techId) { // Update existing technician
                const techRef = firebase.firestore().doc(`technicians/${techId}`);
                await techRef.update({
                    ...techData,
                    currentLocation: firebase.firestore.FieldValue.delete()
                });
            } else { // Add new technician
                await firebase.firestore().collection('technicians').add(techData);
            }
            closeEditTechModal();
        } catch (error) {
            console.error("Error saving technician:", error);
            alert(`Error saving technician: ${error.message}`);
        }
    });

    const confirmScheduleBtn = document.getElementById('confirmScheduleBtn');
    if(confirmScheduleBtn) confirmScheduleBtn.addEventListener('click', async () => {
        const confirmBtn = document.getElementById('confirmScheduleBtn');
        
        if (confirmBtn.textContent === 'Fit into trip sheet') {
            const technicianSelect = document.getElementById('modalJobTechnician');
            const selectedTechId = technicianSelect.value;
            
            // If the job doesn't have a tech yet, assign the one from the dropdown to the temp job object
            if (!currentJobToReschedule.assignedTechnicianId && selectedTechId) {
                const selectedTech = allTechniciansData.find(t => t.id === selectedTechId);
                if (selectedTech) {
                    currentJobToReschedule.assignedTechnicianId = selectedTechId;
                    currentJobToReschedule.assignedTechnicianName = selectedTech.name;
                } else {
                    showMessage('Selected technician not found. Please try again.', 'error');
                    return;
                }
            }
            await openFitInSheetModal();
        } else {
            // Logic to schedule/reschedule
            const jobId = document.getElementById('modalScheduleJobId').value;
            const dateValue = document.getElementById('modalJobDate').value;
            const timeSlotValue = document.getElementById('modalJobTimeSlot').value;
            if (!dateValue || !timeSlotValue) {
                showMessage('Please select a date and time slot.', 'error');
                return;
            }

            const jobRef = firebase.firestore().doc(`jobs/${jobId}`);
            const originalJob = currentJobToReschedule; // Get the state of the job when the modal was opened
            const isReschedule = originalJob.status === 'Scheduled' || originalJob.status === 'Awaiting completion';

            const updatedData = {
                status: 'Scheduled',
                scheduledDate: dateValue,
                timeSlot: timeSlotValue,
                rescheduleReason: firebase.firestore.FieldValue.delete()
            };

            if (isReschedule) {
                // It's a reschedule, so unassign the technician as per the requirement.
                updatedData.assignedTechnicianId = firebase.firestore.FieldValue.delete();
                updatedData.assignedTechnicianName = firebase.firestore.FieldValue.delete();
            } else {
                // It's a new schedule, so check for a technician assignment.
                const technicianSelect = document.getElementById('modalJobTechnician');
                const selectedTechId = technicianSelect.value;

                if (technicianSelect.offsetParent !== null && selectedTechId) {
                    const selectedTech = allTechniciansData.find(t => t.id === selectedTechId);
                    if (selectedTech) {
                        updatedData.assignedTechnicianId = selectedTechId;
                        updatedData.assignedTechnicianName = selectedTech.name;
                        updatedData.participatingTechnicians = firebase.firestore.FieldValue.arrayUnion(selectedTechId);
                    } else {
                        showMessage('Selected technician not found. Please try again.', 'error');
                        return;
                    }
                }
            }

            try {
                await jobRef.update(updatedData);
                closeScheduleJobModal();
                const successMessage = isReschedule ? 'Job successfully rescheduled.' : 'Job successfully scheduled.';
                showMessage(successMessage, 'success');
            } catch (error) {
                console.error("Error updating job:", error);
                showMessage('Error saving job details.', 'error');
            }
        }
    });
    
    if(newJobForm) newJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveJobButton = document.getElementById('saveJobButton');
        if (saveJobButton.disabled) return;
        saveJobButton.disabled = true;
        saveJobButton.textContent = 'Saving...';
        const form = e.currentTarget;
        const jobData = {
            customer: form.querySelector('#jobCustomer').value,
            address: form.querySelector('#jobAddress').value,
            issue: form.querySelector('#jobIssue').value,
            phone: form.querySelector('#jobPhone').value,
            warrantyProvider: form.querySelector('#jobWarrantyProvider').value,
            planType: form.querySelector('#jobPlanType').value,
            dispatchOrPoNumber: form.querySelector('#jobDispatchOrPoNumber').value,
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
    document.body.addEventListener('click', async function(event) {
        if (event.target.id === 'addTechnicianBtn') {
            openEditTechModal(null);
        }
        if (event.target.classList.contains('manage-tech-btn')) {
            const techId = event.target.dataset.id;
            const techData = allTechniciansData.find(t => t.id === techId);
            if(techData) openEditTechModal(techData);
        }
        if (event.target.id === 'deleteTechBtn') {
            const techId = event.target.dataset.id;
            if (techId) {
                handleDeleteTechnician(techId);
            }
        }
        const scheduleBtn = event.target.closest('.schedule-job-btn');
        if (scheduleBtn) {
            const button = scheduleBtn;
            const originalHtml = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<span class="material-icons-outlined text-lg animate-spin">sync</span>`;

            try {
                const jobId = button.dataset.id;
                const jobDoc = await db.collection('jobs').doc(jobId).get();
                if (jobDoc.exists) {
                    const jobData = { id: jobDoc.id, ...jobDoc.data() };
                    await openScheduleJobModal(jobData);
                } else {
                    showMessage("Job data could not be found.", "error");
                }
            } catch (error) {
                console.error("Error opening schedule modal:", error);
                showMessage("Could not open modal.", "error");
            } finally {
                button.disabled = false;
                button.innerHTML = originalHtml;
            }
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
        const viewInvoiceBtn = event.target.closest('.view-invoice-btn');
        if (viewInvoiceBtn) {
            const button = viewInvoiceBtn;
            const originalHtml = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<span class="material-icons-outlined text-lg animate-spin">sync</span>`;
            try {
                const invoiceId = button.dataset.id;
                await openInvoiceViewModal(invoiceId);
            } catch (error) {
                console.error("Error opening invoice modal:", error);
                showMessage("Could not open invoice details.", "error");
            } finally {
                button.disabled = false;
                button.innerHTML = originalHtml;
            }
        }

        // Unschedule button on trip sheets
        const unscheduleBtn = event.target.closest('.unschedule-btn');
        if (unscheduleBtn) {
            const jobId = unscheduleBtn.dataset.jobId;
            const technicianId = unscheduleBtn.dataset.technicianId;
            const jobCard = unscheduleBtn.closest('.job-card');
            const jobAddress = jobCard.querySelector('.font-semibold').textContent;

            showConfirmationModal(
                'Confirm Unschedule',
                `Are you sure you want to remove the job at "${jobAddress}" from this trip sheet? It will be moved back to "Needs Scheduling".`,
                async () => {
                    try {
                        const batch = db.batch();
                        const date = tripSheetDateInput.value;

                        // 1. Update previewTripSheet: remove the job from the route
                        const sheet = currentTripSheets.find(s => s.technicianId === technicianId);
                        if (!sheet) throw new Error("Could not find the trip sheet data.");
                        
                        const newRoute = sheet.route.filter(j => j.id !== jobId);
                        const sheetRef = db.collection('previewTripSheets').doc(`${date}_${technicianId}`);
                        batch.update(sheetRef, { route: newRoute });

                        // 2. Update the job's status
                        const jobRef = db.collection('jobs').doc(jobId);
                        batch.update(jobRef, {
                            status: 'Needs Scheduling',
                            assignedTechnicianId: firebase.firestore.FieldValue.delete(),
                            assignedTechnicianName: firebase.firestore.FieldValue.delete()
                        });

                        await batch.commit();

                        // Update local state to match
                        sheet.route = newRoute;

                        // Update UI
                        jobCard.remove();
                        updateTechnicianCardUI(technicianId);
                        
                        showMessage('Job has been unscheduled.', 'success');

                    } catch (error) {
                        console.error("Error unscheduling job:", error);
                        showMessage(`Failed to unschedule job: ${error.message}`, 'error');
                    }
                }
            );
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

    const invoiceTechnicianSelectionOverlay = document.getElementById('invoiceTechnicianSelectionOverlay');
    const invoiceTechnicianSelectionCloseBtn = document.getElementById('invoiceTechnicianSelectionCloseBtn');
    if (invoiceTechnicianSelectionCloseBtn) {
        invoiceTechnicianSelectionCloseBtn.addEventListener('click', () => closeOverlay(invoiceTechnicianSelectionOverlay));
    }

    const technicianInvoicesOverlay = document.getElementById('technicianInvoicesOverlay');
    const technicianInvoicesCloseBtn = document.getElementById('technicianInvoicesCloseBtn');
    if (technicianInvoicesCloseBtn) {
        technicianInvoicesCloseBtn.addEventListener('click', () => {
            closeOverlay(technicianInvoicesOverlay);
            // openInvoiceTechnicianSelectionOverlay(); // Changed to just close
        });
    }

    const allInvoicesListOverlay = document.getElementById('allInvoicesListOverlay');
    const allInvoicesListCloseBtn = document.getElementById('allInvoicesListCloseBtn');
    if (allInvoicesListCloseBtn) {
        allInvoicesListCloseBtn.addEventListener('click', () => {
            closeOverlay(allInvoicesListOverlay);
            // openInvoiceTechnicianSelectionOverlay(); // Changed to just close
        });
    }

    const invoiceTechnicianSelectionCards = document.getElementById('invoiceTechnicianSelectionCards');
    if (invoiceTechnicianSelectionCards) {
        invoiceTechnicianSelectionCards.addEventListener('click', (event) => {
            const card = event.target.closest('.tech-selection-card');
            if (card) {
                const techName = card.dataset.technician;
                closeOverlay(document.getElementById('invoiceTechnicianSelectionOverlay'));
                if (techName === 'All Invoices') {
                openAllInvoicesOverlay();
                } else {
                    openTechnicianInvoicesOverlay(techName);
                }
            }
        });
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
                    const completionDate = w.createdAt?.toDate();
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
                const completionDate = w.createdAt?.toDate();
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
                const invoiceId = card.dataset.invoiceId; // CORRECT: Use invoiceId from the dataset
                const claimsEmail = document.getElementById('claimsEmailInput').value;

                if (!claimsEmail || !claimsEmail.includes('@')) {
                    alert('Please enter a valid email address for claims submission.');
                    return;
                }
                
                // CORRECT: Find the invoice directly in the flat allWarrantiesData (which holds all warranty invoices)
                const invoice = allWarrantiesData.find(inv => inv.id === invoiceId);

                if (!invoice || !invoice.url) {
                    alert('Could not find the invoice details or its PDF URL. Please try again.');
                    return;
                }

                if (confirm(`This will submit invoice #${invoice.invoiceNumber} for processing to ${claimsEmail}. Proceed?`)) {
                    processBtn.textContent = 'Processing...';
                    processBtn.disabled = true;

                    try {
                        const response = await fetch(SEND_HOMEGUARD_CLAIM_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                warrantyId: invoice.id, // CORRECT: Pass the invoice's own ID as warrantyId
                                invoiceNumber: invoice.invoiceNumber,
                                claimsEmail: claimsEmail,
                                pdfUrl: invoice.url
                            })
                        });

                        const result = await response.json();
                        if (!response.ok) {
                            throw new Error(result.message || 'An unknown error occurred.');
                        }
                        
                        showMessage(`Invoice #${invoice.invoiceNumber} sent successfully!`, 'success');
                        // The backend now handles updating the status, so the frontend will update on the next Firestore snapshot.
                    } catch (error) {
                        console.error("Failed to send claim:", error);
                        alert(`Failed to send claim: ${error.message}`);
                        processBtn.textContent = 'Process Claim';
                        processBtn.disabled = false;
                    }
                }
            }
        });
    }

    const processAllBtn = document.getElementById('processAllBtn');
    if (processAllBtn) {
        processAllBtn.addEventListener('click', async () => {
            const claimsEmail = document.getElementById('claimsEmailInput').value;

            if (!claimsEmail || !claimsEmail.includes('@')) {
                alert('Please enter a valid email address for claims submission.');
                return;
            }

            const providerKey = currentProvider.toLowerCase();
            if (providerKey !== 'home guard') {
                alert('This bulk processing functionality is only for Home Guard warranties.');
                return;
            }

            const invoicesToSend = [];
            allWarrantiesData.forEach(warranty => {
                if (warranty.job?.warrantyProvider?.toLowerCase().includes('home guard')) {
                    warranty.invoices.forEach(invoice => {
                        if (invoice.status !== 'paid' && invoice.status !== 'Claimed' && invoice.url) {
                            invoicesToSend.push({
                                warrantyId: warranty.id,
                                invoiceNumber: invoice.invoiceNumber,
                                claimsEmail: claimsEmail,
                                pdfUrl: invoice.url
                            });
                        }
                    });
                }
            });

            if (invoicesToSend.length === 0) {
                alert('No unclaimed Home Guard invoices with PDFs were found to process.');
                return;
            }

            if (confirm(`This will process ${invoicesToSend.length} unclaimed invoices for ${currentProvider} and send them to ${claimsEmail}. Proceed?`)) {
                processAllBtn.textContent = 'Processing...';
                processAllBtn.disabled = true;

                let successCount = 0;
                let failCount = 0;

                for (const invoice of invoicesToSend) {
                    try {
                        const response = await fetch(SEND_HOMEGUARD_CLAIM_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(invoice)
                        });
                        if (!response.ok) {
                            failCount++;
                            console.error(`Failed to send invoice ${invoice.invoiceNumber}:`, await response.text());
                        } else {
                            successCount++;
                        }
                    } catch (error) {
                        failCount++;
                        console.error(`Failed to send invoice ${invoice.invoiceNumber}:`, error);
                    }
                }

                showMessage(`Processing complete. Sent: ${successCount}, Failed: ${failCount}.`, 'success');
                processAllBtn.textContent = 'Process All';
                processAllBtn.disabled = false;
            }
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
    
            // 1. Prepare to move trip sheets and update jobs
            currentTripSheets.forEach(sheet => {
                // Add trip sheet to the main collection
                const newTripSheetRef = firebase.firestore().collection('tripSheets').doc(sheet.id);
                batch.set(newTripSheetRef, sheet);
    
                // Delete trip sheet from the preview collection
                const oldTripSheetRef = firebase.firestore().collection('previewTripSheets').doc(sheet.id);
                batch.delete(oldTripSheetRef);
    
                // Collect all jobs that need their status updated
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
    
            // 2. Update the status of all collected jobs
            if (jobsToUpdate.size > 0) {
                jobsToUpdate.forEach((techInfo, jobId) => {
                    const jobRef = firebase.firestore().doc(`jobs/${jobId}`);
                    batch.update(jobRef, {
                        status: 'Awaiting completion',
                        assignedTechnicianId: techInfo.technicianId,
                        assignedTechnicianName: techInfo.technicianName,
                        participatingTechnicians: firebase.firestore.FieldValue.arrayUnion(techInfo.technicianId)
                    });
                });
            }
    
            // 3. Commit all changes in one atomic operation
            await batch.commit();
    
            // 4. Update UI
            if (jobsToUpdate.size > 0) {
                 scheduleStatus.textContent = `Successfully approved ${jobsToUpdate.size} jobs for ${date}. Trip sheets have been finalized.`;
            } else {
                scheduleStatus.textContent = `All jobs for ${date} were already approved. Trip sheets have been finalized.`;
            }
            
            // The listener on previewTripSheets will automatically clear the UI,
            // and we can disable the button.
            approveTripSheetsBtn.innerHTML = `<span class="material-icons-outlined">check_circle_outline</span>Sheets Approved`;
            approveTripSheetsBtn.disabled = true;
    
    
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

// === Send All To Office (Frontend) ===
// Call this from your "Send all to office" button handler.

async function sendAllToOffice(jobId, customerInvoice, warrantyInvoice) {
  if (!jobId) throw new Error("Missing jobId for warranty upload.");

  // Build items array dynamically (send what exists)
  const items = [];
  if (customerInvoice?.base64Pdf && customerInvoice?.invoiceNumber) {
    items.push({
      jobId,
      invoiceId: customerInvoice.invoiceId || null,
      invoiceNumber: customerInvoice.invoiceNumber,
      variant: "CUSTOMER",
      base64Pdf: customerInvoice.base64Pdf,
      invoiceData: customerInvoice, // <-- Add the full customer invoice object
    });
  }
  if (warrantyInvoice?.base64Pdf && warrantyInvoice?.invoiceNumber) {
    items.push({
      jobId,
      invoiceId: warrantyInvoice.invoiceId || null,
      invoiceNumber: warrantyInvoice.invoiceNumber,
      variant: "WARRANTY",
      base64Pdf: warrantyInvoice.base64Pdf,
      invoiceData: warrantyInvoice, // <-- Add the full warranty invoice object
    });
  }

  if (items.length === 0) {
    throw new Error("No PDFs to upload. Generate the invoices first.");
  }

  const res = await fetch("https://save-pdf-to-storage-216681158749.us-central1.run.app/warranties/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || "Upload failed.");
  }

  return res.json(); // { message, bucket, succeeded, failed }
}

    // --- Route Dropdown Logic ---
    const routeDropdownButton = document.getElementById('routeDropdownButton');
    const routeDropdownMenu = document.getElementById('routeDropdownMenu');
    const routeOptions = document.querySelectorAll('.route-option');

    if (routeDropdownButton && routeDropdownMenu && routeOptions.length > 0) {
        routeDropdownButton.addEventListener('click', () => {
            routeDropdownMenu.classList.toggle('hidden');
        });

        routeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const day = e.target.dataset.day;
                routeDropdownMenu.classList.add('hidden');

                if (day === 'today') {
                    listenForWorkerJobs(currentWorkerTechnicianId, currentWorkerTechnicianName);
                } else {
                    const date = new Date();
                    if (day === 'yesterday') {
                        date.setDate(date.getDate() - 1);
                    } else if (day === 'tomorrow') {
                        date.setDate(date.getDate() + 1);
                    }
                    fetchAndRenderJobsForDate(date, currentWorkerTechnicianId, currentWorkerTechnicianName);
                }
            });
        });

        // Close dropdown if clicking outside
        document.addEventListener('click', (event) => {
            if (routeDropdownButton && !routeDropdownButton.contains(event.target) && routeDropdownMenu && !routeDropdownMenu.contains(event.target)) {
                routeDropdownMenu.classList.add('hidden');
            }
        });
    }


    // Login Form
    // --- "Fit in Sheet" Modal Listeners ---
    const closeFitInSheetModalBtn = document.getElementById('closeFitInSheetModal');
    if (closeFitInSheetModalBtn) closeFitInSheetModalBtn.addEventListener('click', closeFitInSheetModal);

    const cancelFitInSheetBtn = document.getElementById('cancelFitInSheet');
    if (cancelFitInSheetBtn) cancelFitInSheetBtn.addEventListener('click', closeFitInSheetModal);

    const confirmFitInSheetBtn = document.getElementById('confirmFitInSheet');
    if (confirmFitInSheetBtn) confirmFitInSheetBtn.addEventListener('click', handleConfirmFitInSheet);


    // Login Form
    if(imageUploadInput) {
        imageUploadInput.addEventListener('change', handleImageSelection);
    }

    if (tabVisibilityContainer) {
        tabVisibilityContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('toggle-checkbox')) {
                const targetId = e.target.dataset.target;
                const isVisible = e.target.checked;
                const link = document.querySelector(`.nav-link[data-target="${targetId}"]`);

                if (link) {
                    link.classList.toggle('hidden', !isVisible);
                }
                
                if (!isVisible && currentView === targetId) {
                    switchView('dashboard');
                }

                saveTabSettings();
            }
        });
    }

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
        sendAllInvoicesBtn.textContent = 'Processing...';

        try {
            const jobId = currentJobIdForInvoicing;
            if (!jobId) {
                throw new Error("Missing job ID. Cannot send to office.");
            }

            // Generate final invoice numbers and PDFs before sending
            for (const invoice of pendingInvoices) {
                // Get a unique invoice number for each invoice
                await db.runTransaction(async (transaction) => {
                    const counterRef = db.collection('counters').doc('invoiceCounter');
                    const counterDoc = await transaction.get(counterRef);
                    let nextNumber = 1;
                    if (counterDoc.exists && counterDoc.data().lastNumber) {
                        nextNumber = counterDoc.data().lastNumber + 1;
                    }
                    const formattedInvoiceNumber = formatInvoiceNumber(nextNumber);
                    invoice.invoiceNumber = formattedInvoiceNumber;
                    transaction.set(counterRef, { lastNumber: nextNumber }, { merge: true });
                });

                // Re-generate the PDF with the final invoice number and no watermark
                invoice.base64Pdf = generatePDF(invoice, false);
            }

            // Find the customer and warranty invoices from the processed pendingInvoices
            const customerInvoice = pendingInvoices.find(inv => inv.invoiceType === 'customer');
            const warrantyInvoice = pendingInvoices.find(inv => inv.invoiceType === 'warranty');

            if (!customerInvoice?.base64Pdf && !warrantyInvoice?.base64Pdf) {
                alert("Please generate invoices first.");
                return;
            }

            const result = await sendAllToOffice(jobId, customerInvoice, warrantyInvoice);
            console.log("Warranties upload result:", result);

            // --- FIX: Update the job status to 'Completed' ---
            await db.collection('jobs').doc(jobId).update({
                status: 'Completed'
            });
            // --- END FIX ---

            // The backend handles all Firestore writes now.
            showMessage("Invoices sent to office and saved to warranties successfully.", 'success');

            // Cleanup local state and return to home screen
            pendingInvoices = [];
            currentJobIdForInvoicing = null;
            showWorkerHomeScreen();

        } catch (err) {
            console.error("Send all to office failed:", err);
            showMessage(`Failed to send invoices: ${err.message}`, 'error');
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
        storage = firebase.storage();
        console.log("Firebase Initialized (Compat).");

        const loginScreen = document.getElementById('loginScreen');
        const layoutContainer = document.getElementById('layoutContainer');
        const userAvatar = document.getElementById('userAvatar');
        const appLoader = document.getElementById('appLoader');

        auth.onAuthStateChanged(async user => {
            // Hide the main app loader once auth state is determined
            if (appLoader) {
                appLoader.style.display = 'none';
            }

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
                        listenForAllInvoices();
                        if (tripSheetDateInput.value) {
                           loadTripSheetsForDate(tripSheetDateInput.value);
                        }

                        const capacityDatePicker = document.getElementById('capacity-date-picker');
                        if (capacityDatePicker) {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            capacityDatePicker.value = tomorrow.toISOString().split('T')[0];

                            listenForBookedCounts(capacityDatePicker.value);

                            capacityDatePicker.addEventListener('change', () => {
                                listenForBookedCounts(capacityDatePicker.value);
                            });
                        }
                    });
                    initializeDanielAIChat();
                    
                    applyTabVisibility();
                    renderTabVisibilitySettings();
                    
                    // If the default view 'dashboard' is hidden, switch to the first available one.
                    const settings = loadTabSettings();
                    if (settings['dashboard'] === false) {
                        const firstVisibleTab = Array.from(navLinks).find(link => settings[link.dataset.target] !== false && link.dataset.target !== 'settings');
                        switchView(firstVisibleTab ? firstVisibleTab.dataset.target : 'settings');
                    } else {
                        switchView('dashboard');
                    }

                } else {
                    // --- WORKER ROLE ---
                    console.log("Worker user signed in:", user.email);
                    const techName = user.email.split('@')[0];
                    const capitalizedTechName = techName.charAt(0).toUpperCase() + techName.slice(1);
                    
                    const techQuery = await firebase.firestore().collection('technicians').where('name', '==', capitalizedTechName).limit(1).get();

                    if (!techQuery.empty) {
                        const technician = { id: techQuery.docs[0].id, ...techQuery.docs[0].data() };
                        console.log(`Found technician profile: ${technician.name}`);
                        
                        currentWorkerTechnicianId = technician.id;
                        currentWorkerTechnicianName = technician.name;

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

    // We set up a listener on the preview collection.
    // This allows the UI to update in real-time when sheets are generated.
    const previewQuery = firebase.firestore().collection("previewTripSheets").where("date", "==", dateString);
    
    currentTripSheetListener = previewQuery.onSnapshot((previewSnapshot) => {
        // Guard against stale listeners firing after the user has changed the date/view
        if (currentView !== 'schedule' || tripSheetDateInput.value !== dateString) {
            return;
        }

        if (!previewSnapshot.empty) {
            // If we find sheets in the preview collection, we display them for approval.
            const sheets = previewSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderTripSheets(sheets, dateString, false); // Not approved
        } else {
            // If the preview collection is empty, we fall back to checking the main collection
            // for already-approved sheets for that day.
            const approvedQuery = firebase.firestore().collection("tripSheets").where("date", "==", dateString);
            approvedQuery.get().then(approvedSnapshot => {
                // Another guard to ensure the date/view hasn't changed during the async fetch
                if (currentView === 'schedule' && tripSheetDateInput.value === dateString) {
                    const sheets = approvedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderTripSheets(sheets, dateString, true); // Approved
                }
            }).catch(error => {
                console.error(`Error getting approved trip sheets for ${dateString}:`, error);
                if (tripSheetsContainer) tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-red-500"><p>Error loading trip sheets for ${dateString}.</p></div>`;
                if (tripSheetApprovalContainer) tripSheetApprovalContainer.classList.add('hidden');
            });
        }
    }, (error) => {
        console.error(`Error listening to preview trip sheets for ${dateString}:`, error);
        if (tripSheetsContainer) tripSheetsContainer.innerHTML = `<div class="text-center py-8 text-red-500"><p>Error loading trip sheets for ${dateString}.</p></div>`;
        if (tripSheetApprovalContainer) tripSheetApprovalContainer.classList.add('hidden');
    });
}


let selectedFitIndex = -1;
let currentTripSheetForFit = null;

function closeFitInSheetModal() {
    const modal = document.getElementById('fitInSheetModal');
    if (modal) modal.style.display = 'none';
    // Reset state
    selectedFitIndex = -1;
    currentTripSheetForFit = null;
    currentJobToReschedule = null;
}

async function openFitInSheetModal() {
    const date = document.getElementById('modalJobDate').value;
    const techId = currentJobToReschedule.assignedTechnicianId;

    try {
        const tripSheetQuery = db.collection("tripSheets").where("date", "==", date).where("technicianId", "==", techId);
        const snapshot = await tripSheetQuery.get();

        if (snapshot.empty) {
            showMessage('Could not find the trip sheet for the selected date. Please try again.', 'error');
            return;
        }

        currentTripSheetForFit = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        const route = currentTripSheetForFit.route;
        const jobListContainer = document.getElementById('fitInSheetJobList');
        jobListContainer.innerHTML = ''; // Clear previous content

        const isMovingJob = route.some(job => job.id === currentJobToReschedule.id);
        const buttonText = isMovingJob ? "Move job here" : "Fit Job Here";

        // Render the "Fit here" button for the first position
        jobListContainer.innerHTML += `
            <button class="fit-job-btn w-full text-center p-2 border-2 border-dashed border-green-400 rounded-lg text-green-600 hover:bg-green-50" data-index="0">
                ${buttonText} (Start of Day)
            </button>
        `;

        route.forEach((job, index) => {
            jobListContainer.innerHTML += `
                <div class="p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm">
                    <p class="font-bold">${job.customer}</p>
                    <p>${job.address}</p>
                    <p class="text-xs text-slate-500">${job.timeSlot} - ${job.issue}</p>
                </div>
            `;
            jobListContainer.innerHTML += `
                <button class="fit-job-btn w-full text-center p-2 border-2 border-dashed border-green-400 rounded-lg text-green-600 hover:bg-green-50" data-index="${index + 1}">
                    ${buttonText}
                </button>
            `;
        });

        // Add event listeners to the new buttons
        document.querySelectorAll('.fit-job-btn').forEach(btn => {
            btn.addEventListener('click', handleFitJobClick);
        });

        // Show the modal
        const modal = document.getElementById('fitInSheetModal');
        modal.style.display = 'block';
        document.getElementById('confirmFitInSheet').classList.add('hidden'); // Hide confirm button initially

    } catch (error) {
        console.error("Error opening fit in sheet modal:", error);
        showMessage('Error fetching trip sheet data.', 'error');
    }
}

function handleFitJobClick(event) {
    const targetButton = event.currentTarget;
    selectedFitIndex = parseInt(targetButton.dataset.index);

    // Disable all fit buttons
    document.querySelectorAll('.fit-job-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('bg-slate-200', 'cursor-not-allowed', 'border-slate-300');
        btn.classList.remove('hover:bg-green-50');
    });

    // Visually show the job being placed
    const jobInfoHtml = `
        <div class="p-3 bg-blue-100 border border-blue-300 rounded-lg text-sm ring-2 ring-blue-500">
            <p class="font-bold">${currentJobToReschedule.customer}</p>
            <p>${currentJobToReschedule.address}</p>
            <p class="text-xs text-blue-600">This job will be placed here.</p>
        </div>
    `;
    targetButton.insertAdjacentHTML('afterend', jobInfoHtml);
    targetButton.classList.add('hidden'); // Hide the clicked button

    // Show the confirm button
    document.getElementById('confirmFitInSheet').classList.remove('hidden');
}

async function handleConfirmFitInSheet() {
    if (selectedFitIndex === -1 || !currentTripSheetForFit || !currentJobToReschedule) {
        showMessage('An error occurred. Please close the modal and try again.', 'error');
        return;
    }

    const confirmBtn = document.getElementById('confirmFitInSheet');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirming...';

    try {
        // Prepare the updated job data
        const newScheduledDate = document.getElementById('modalJobDate').value;
        const newTimeSlot = document.getElementById('modalJobTimeSlot').value;

        const jobToInsert = {
            id: currentJobToReschedule.id,
            customer: currentJobToReschedule.customer,
            address: currentJobToReschedule.address,
            issue: currentJobToReschedule.issue,
            timeSlot: newTimeSlot
        };

        // Create the new route by first removing the job if it exists, then inserting it.
        let newRoute = [...currentTripSheetForFit.route];
        const existingJobIndex = newRoute.findIndex(job => job.id === currentJobToReschedule.id);

        if (existingJobIndex > -1) {
            newRoute.splice(existingJobIndex, 1);
        }
        
        newRoute.splice(selectedFitIndex, 0, jobToInsert);

        // Update trip sheet in Firestore
        const tripSheetRef = db.collection('tripSheets').doc(currentTripSheetForFit.id);
        await tripSheetRef.update({ route: newRoute });

        // Update the job document in Firestore
        const jobRef = db.collection('jobs').doc(currentJobToReschedule.id);
        await jobRef.update({
            scheduledDate: newScheduledDate,
            timeSlot: newTimeSlot,
            status: 'Awaiting completion',
            assignedTechnicianId: currentJobToReschedule.assignedTechnicianId,
            assignedTechnicianName: currentJobToReschedule.assignedTechnicianName,
            participatingTechnicians: firebase.firestore.FieldValue.arrayUnion(currentJobToReschedule.assignedTechnicianId),
            rescheduleReason: firebase.firestore.FieldValue.delete()
        });

        showMessage('Job successfully fitted into trip sheet!', 'success');
        closeFitInSheetModal();
        closeScheduleJobModal();

    } catch (error) {
        console.error("Error confirming fit in sheet:", error);
        showMessage('Failed to update the trip sheet. Please try again.', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Placement';
    }
}


// --- Daniel AI Chat Logic ---
function formatChatMessage(text) {
    // This regex finds text surrounded by double asterisks and replaces it with <b> tags.
    // The 'g' flag ensures all occurrences are replaced, not just the first one.
    // The (.*?) part is a non-greedy capture of any characters between the asterisks.
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    
    // Replace newline characters with <br> tags to ensure line breaks are rendered in HTML.
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
}

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
            bubble.innerHTML = formatChatMessage(message);
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
                view: currentView,
                mode: currentChatMode
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'The AI is currently unavailable.');
        
        // --- MODIFIED LOGIC FOR COPY BUTTON ---
        processingBubble.innerHTML = ''; // Clear "thinking..." message
        processingBubble.classList.remove('processing-bubble');
        processingBubble.style.display = 'flex';
        processingBubble.style.alignItems = 'flex-start';
        processingBubble.style.gap = '10px';

        const messageContent = document.createElement('span');
        messageContent.style.flexGrow = '1';
        messageContent.innerHTML = formatChatMessage(result.response);

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-btn-daniel';
        copyButton.title = 'Copy message';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(result.response).then(() => {
                copyButton.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });

        processingBubble.appendChild(messageContent);
        processingBubble.appendChild(copyButton);
        // --- END MODIFIED LOGIC ---

        conversationHistory.push({ role: 'model', parts: [{ text: result.response }] });

    } catch (error) {
        console.error("Error calling askDaniel function:", error);
        processingBubble.classList.remove('processing-bubble');
        // Ensure the bubble is not a flex container on error
        processingBubble.style.display = ''; 
        processingBubble.innerHTML = formatChatMessage(`Sorry, I encountered an error: ${error.message}`);
    } finally {
        sendChatButton.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
        chatLog.scrollTop = chatLog.scrollHeight;
    }
}

function initializeDanielAIChat() {
    if (!chatLog || !chatInput || !sendChatButton) return;

    currentChatMode = 'tour_guide';
    
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

// --- NEW --- Function to clear chat memory on the backend
async function clearBackendChatMemory() {
    try {
        await fetch(`${ASK_DANIEL_URL}/memory/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dropMemory: true }) // Body might not be needed depending on server implementation
        });
    } catch (error) {
        console.error("Error clearing backend chat memory:", error);
    }
}

// --- NEW --- Function to switch to Email Writing mode
function activateEmailWritingMode() {
    currentChatMode = 'email_writing';
    
    // 1. Clear chat UI and history
    chatLog.innerHTML = '';
    conversationHistory = [];
    
    // 2. Clear backend memory
    clearBackendChatMemory();
    
    // 3. Change icon
    activateEmailBtn.innerHTML = `<i class="fas fa-envelope"></i>`;
    
    // 4. Set initial message for email mode
    const initialMessage = "Email Writing Mode activated. How can I help you draft an email?";
    appendToChatLog(initialMessage);
    conversationHistory.push({ role: 'model', parts: [{ text: initialMessage }] });

    // 5. Hide the popup
    emailWritingPopup.classList.remove('is-visible');
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

function handleImageSelection(event) {
    if (!imagePreviewContainer) return;

    // Clear previous previews and file list
    imagePreviewContainer.innerHTML = '';
    invoiceImageFiles = [];

    const files = event.target.files;

    for (const file of files) {
        // Add file to our global array
        invoiceImageFiles.push(file);

        // Create the preview element
        const previewWrapper = document.createElement('div');
        previewWrapper.className = 'relative'; // For positioning the remove button

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'w-full h-full object-cover rounded-lg';
        img.onload = () => {
            URL.revokeObjectURL(img.src); // Free up memory
        }

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.className = 'absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-lg';
        removeBtn.type = 'button'; // Prevent form submission

        removeBtn.addEventListener('click', () => {
            // Find the index of the file to remove
            const indexToRemove = invoiceImageFiles.indexOf(file);
            if (indexToRemove > -1) {
                invoiceImageFiles.splice(indexToRemove, 1);
            }
            // Remove the preview from the DOM
            previewWrapper.remove();
        });

        previewWrapper.appendChild(img);
        previewWrapper.appendChild(removeBtn);
        imagePreviewContainer.appendChild(previewWrapper);
    }
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

function handleDeleteTechnician(techId) {
    const tech = allTechniciansData.find(t => t.id === techId);
    if (!tech) {
        showMessage('Technician not found.', 'error');
        return;
    }

    showConfirmationModal(
        `Delete ${tech.name}`,
        `Are you sure you want to delete this technician? This action cannot be undone.`,
        async () => {
            try {
                await firebase.firestore().collection('technicians').doc(techId).delete();
                showMessage(`${tech.name} has been successfully deleted.`, 'success');
                closeEditTechModal();
            } catch (error) {
                console.error("Error deleting technician:", error);
                showMessage(`Error deleting technician: ${error.message}`, 'error');
            }
        }
    );
}

async function showInvoiceScreen(jobId) {
    currentJobIdForInvoicing = jobId;
    let job = allJobsData.find(j => j.id === jobId);

    if (!job) {
        job = currentWorkerAssignedJobs.find(j => j.id === jobId);
    }
    
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

async function getImageAsBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Failed to fetch or convert image from ${url}:`, error);
        return null;
    }
}

async function generatePDF(invoiceDataForPdf, isPreview = false) {
    console.log(`[generatePDF] Starting PDF generation for invoice: ${invoiceDataForPdf.invoiceNumber}, isPreview: ${isPreview}`);
    if (!invoiceDataForPdf) {
        console.error('[generatePDF] No invoice data provided.');
        return null;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        let yPos = margin;

        // --- STYLING CONSTANTS ---
        const BRAND_COLOR = '#059669'; // Tailwind's green-600
        const HEADING_COLOR = '#1E293B'; // slate-800
        const TEXT_COLOR = '#334155'; // slate-700
        const LIGHT_TEXT_COLOR = '#64748B'; // slate-500

        // --- HEADER ---
        // PASTE YOUR BASE64 LOGO DATA HERE
        const logoBase64Data = ""; 
        if (logoBase64Data) {
            try {
                // The logo's vertical position is set to -25 as requested.
                doc.addImage(logoBase64Data, 'PNG', margin, -25, 50, 0); 
                yPos += 15;
            } catch (e) {
                 console.error("Error adding logo image:", e);
            }
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(TEXT_COLOR);
        doc.text("2921 W. Central Ave. Unit C, Santa Ana, CA 92704 | Lic. # 821771", margin, yPos);
        yPos += 4;
        doc.setTextColor(LIGHT_TEXT_COLOR);
        doc.text("(714) 414-7979 | (805) 201-5815 | (800) 810-3246 | (949) 899-3560 | (310) 903-0212", margin, yPos);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(HEADING_COLOR);
        doc.text("INVOICE", pageWidth - margin, margin, { align: 'right' });
        
        yPos += 10;
        doc.setDrawColor(BRAND_COLOR);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;

        // --- BILL TO & INVOICE DETAILS ---
        const detailsX = pageWidth / 2 + 10;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(HEADING_COLOR);
        doc.text("BILL TO", margin, yPos);
        doc.text("INVOICE DETAILS", detailsX, yPos);

        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_COLOR);

        let customerName = invoiceDataForPdf.customerName || "N/A";
        if (invoiceDataForPdf.invoiceType === 'warranty') {
            customerName += " (Warranty)";
        } else if (invoiceDataForPdf.invoiceType === 'customer') {
            customerName += " (Non-covered)";
        }
        doc.text(customerName, margin, yPos);
        const invoiceNumberText = isPreview 
            ? "Will be generated when sent to office" 
            : `${invoiceDataForPdf.invoiceNumber || "N/A"}`;
        doc.text(`Invoice #: ${invoiceNumberText}`, detailsX, yPos);
        yPos += 5;
        
        const addressLines = doc.splitTextToSize(invoiceDataForPdf.customerAddress || "N/A", (pageWidth / 2) - margin * 2);
        doc.text(addressLines, margin, yPos);
        
        doc.text(`Date: ${new Date(invoiceDataForPdf.invoiceDate + 'T00:00:00').toLocaleDateString()}`, detailsX, yPos);
        yPos += 5;

        const emailY = yPos + (addressLines.length - 1) * 5;
        doc.text(invoiceDataForPdf.customerEmail || "N/A", margin, emailY);
        doc.text(`P.O. #: ${invoiceDataForPdf.poNumber || "N/A"}`, detailsX, yPos);
        yPos += 5;

        const phoneY = yPos + (addressLines.length - 1) * 5;
        doc.text(invoiceDataForPdf.customerPhone || "N/A", margin, phoneY);
        let paymentString = `Payment: ${invoiceDataForPdf.paymentMethod || "N/A"}`;
        if (invoiceDataForPdf.paymentMethod === 'Cheque' && invoiceDataForPdf.chequeNumber) {
            paymentString += ` (#${invoiceDataForPdf.chequeNumber})`;
        }
        doc.text(paymentString, detailsX, yPos);
        yPos += 5;

        doc.text(`County Tax: ${invoiceDataForPdf.selectedCountyTax || "N/A"}`, detailsX, yPos);

        yPos = Math.max(emailY, phoneY, yPos) + 5;

        // --- JOB & WARRANTY DETAILS ---
        yPos += 5;
        doc.setDrawColor('#E2E8F0'); // slate-200
        doc.setLineWidth(0.2);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(HEADING_COLOR);
        doc.text("JOB DETAILS", margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_COLOR);
        doc.text(`Warranty Provider: ${invoiceDataForPdf.warrantyName || "N/A"}`, margin, yPos);
        doc.text(`Plan Type: ${invoiceDataForPdf.planType || "N/A"}`, detailsX, yPos);
        yPos += 5;
        doc.text(`Equipment: ${invoiceDataForPdf.typeOfEquipment || "N/A"}`, margin, yPos);
        yPos += 10;

        // --- ITEMS TABLE ---
        const tableBody = invoiceDataForPdf.items.map(item => [
            item.description || "",
            item.quantity || 0,
            `$${(item.price || 0).toFixed(2)}`,
            `$${(item.total || 0).toFixed(2)}`
        ]);
        doc.autoTable({
            startY: yPos,
            head: [['Description', 'Quantity', 'Unit Price', 'Total']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: HEADING_COLOR, textColor: '#FFFFFF' },
            styles: { fontSize: 9, cellPadding: 2.5 },
            columnStyles: {
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' }
            },
            margin: { left: margin, right: margin }
        });
        yPos = doc.lastAutoTable.finalY + 5;

        // --- DESCRIPTIONS & TOTALS ---
        let leftColumnY = yPos;
        const rightColumnX = pageWidth - margin;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(HEADING_COLOR);
        doc.text('Job Description', margin, leftColumnY);
        leftColumnY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_COLOR);
        const descLines = doc.splitTextToSize(invoiceDataForPdf.jobDescription, (pageWidth / 2) - margin);
        doc.text(descLines, margin, leftColumnY);
        leftColumnY += (descLines.length * 5) + 5;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(HEADING_COLOR);
        doc.text('Recommendations', margin, leftColumnY);
        leftColumnY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_COLOR);
        const recLines = doc.splitTextToSize(invoiceDataForPdf.recommendations, (pageWidth / 2) - margin);
        doc.text(recLines, margin, leftColumnY);
        leftColumnY += (recLines.length * 5) + 5;
        
        if (invoiceDataForPdf.nonCoveredItems) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(HEADING_COLOR);
            doc.text('Non-Covered Items', margin, leftColumnY);
            leftColumnY += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(TEXT_COLOR);
            const nonCovLines = doc.splitTextToSize(invoiceDataForPdf.nonCoveredItems, (pageWidth / 2) - margin);
            doc.text(nonCovLines, margin, leftColumnY);
            leftColumnY += (nonCovLines.length * 5);
        }

        const totalsXLabel = rightColumnX - 50;
        let totalsY = yPos;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_COLOR);
        doc.text("Subtotal:", totalsXLabel, totalsY, { align: 'right' });
        doc.text(`$${(invoiceDataForPdf.subtotal || 0).toFixed(2)}`, rightColumnX, totalsY, { align: 'right' });
        totalsY += 6;
        doc.text("Labor:", totalsXLabel, totalsY, { align: 'right' });
        doc.text(`$${(invoiceDataForPdf.labor || 0).toFixed(2)}`, rightColumnX, totalsY, { align: 'right' });
        totalsY += 6;
        doc.text("Service Call:", totalsXLabel, totalsY, { align: 'right' });
        doc.text(`$${(invoiceDataForPdf.serviceCall || 0).toFixed(2)}`, rightColumnX, totalsY, { align: 'right' });
        totalsY += 6;
        doc.text(`Sales Tax (${invoiceDataForPdf.salesTaxRate || 0}%):`, totalsXLabel, totalsY, { align: 'right' });
        doc.text(`$${(invoiceDataForPdf.salesTaxAmount || 0).toFixed(2)}`, rightColumnX, totalsY, { align: 'right' });
        totalsY += 6;
        doc.setDrawColor('#E2E8F0');
        doc.line(totalsXLabel - 2, totalsY, rightColumnX, totalsY);
        totalsY += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(BRAND_COLOR);
        doc.text("Total Due:", totalsXLabel, totalsY, { align: 'right' });
        doc.text(formatCurrency(invoiceDataForPdf.total), rightColumnX, totalsY, { align: 'right' });

        // --- ATTACHED IMAGES ---
        if (invoiceDataForPdf.imageUrls && invoiceDataForPdf.imageUrls.length > 0) {
            leftColumnY += 5; // Add some space before the images section
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(HEADING_COLOR);
            doc.text('Attached Images', margin, leftColumnY);
            leftColumnY += 8;

            const imageWidth = (pageWidth - margin * 3) / 2; // Two columns with a margin in between
            let xPos = margin;
            let maxImageHeightInRow = 0;

            for (let i = 0; i < invoiceDataForPdf.imageUrls.length; i++) {
                const imageUrl = invoiceDataForPdf.imageUrls[i];
                const base64Image = await getImageAsBase64(imageUrl);

                if (base64Image) {
                    const imgProps = doc.getImageProperties(base64Image);
                    const aspectRatio = imgProps.height / imgProps.width;
                    const imageHeight = imageWidth * aspectRatio;

                    if (leftColumnY + imageHeight > pageHeight - 25) { // Check for page break (leave footer room)
                        doc.addPage();
                        leftColumnY = margin;
                        xPos = margin;
                    }

                    doc.addImage(base64Image, 'JPEG', xPos, leftColumnY, imageWidth, imageHeight);
                    maxImageHeightInRow = Math.max(maxImageHeightInRow, imageHeight);
                    
                    if ((i + 1) % 2 === 0) {
                        xPos = margin;
                        leftColumnY += maxImageHeightInRow + 5;
                        maxImageHeightInRow = 0;
                    } else {
                        xPos += imageWidth + margin;
                    }
                }
            }
            
            if (invoiceDataForPdf.imageUrls.length % 2 !== 0) {
                leftColumnY += maxImageHeightInRow + 5;
            }
        }

        // --- FOOTER, TERMS & SIGNATURE ---
        let finalY = Math.max(leftColumnY, totalsY, pageHeight - 60); 
        if (finalY > pageHeight - 60) {
            doc.addPage();
            finalY = margin;
        }
        
        doc.setDrawColor('#E2E8F0');
        doc.line(margin, finalY, pageWidth - margin, finalY);
        finalY += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(HEADING_COLOR);
        doc.text("Customer Signature:", margin, finalY);

        if (invoiceDataForPdf.signatureDataURL && invoiceDataForPdf.signatureDataURL !== "placeholder") {
            try {
                doc.addImage(invoiceDataForPdf.signatureDataURL, 'PNG', margin, finalY + 2, 87.5, 26.25);
            } catch (e) { console.error("Error adding signature image:", e); }
        } else if (invoiceDataForPdf.signatureDataURL === "placeholder") {
            doc.setFont("cursive", "normal");
            doc.setFontSize(20);
            doc.text("J. Doe", margin + 2, finalY + 15);
        }
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(LIGHT_TEXT_COLOR);
        const termsText1 = "Payment due upon receipt of invoice. A service charge of $5.00 or 1.5% monthly (whichever is greater) will be charged on all balances over 15 days from date of invoice.";
        const termsText2 = "Service and Parts Warranty: All new parts described in the invoice are covered by MANUFACTURER'S warranty. Safeway Garage Doors agrees to supply said in-warranty parts for one year at no charge. Labor warranty on SERVICE CALLS is 30 Days on same problem.";
        const termsLines = doc.splitTextToSize(termsText1 + "\n" + termsText2, 100);
        doc.text(termsLines, pageWidth - margin, finalY, { align: 'right' });
        
        doc.setFontSize(8);
        doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 10, { align: 'center' });

        return doc.output('datauristring');

    } catch (e) {
        console.error("Critical error during PDF generation:", e);
        alert('Critical error generating PDF. Check console for details.');
        return null;
    }
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

    // This is the new HTML for Variant 1
    const newItemHtml = `
        <div class="line-item p-4 border border-slate-200 rounded-lg bg-slate-50" id="item-${lineItemCount}">
            <div class="grid grid-cols-12 gap-4 items-end">
                <!-- Item Description -->
                <div class="col-span-12 md:col-span-6">
                    <label for="itemDescription-${lineItemCount}" class="form-label">Item Name / Description</label>
                    <input type="text" id="itemDescription-${lineItemCount}" name="itemDescription-${lineItemCount}" class="form-input" value="${description}">
                </div>
                <!-- Quantity -->
                <div class="col-span-4 md:col-span-2">
                    <label for="itemQuantity-${lineItemCount}" class="form-label">Qty</label>
                    <input type="number" id="itemQuantity-${lineItemCount}" name="itemQuantity-${lineItemCount}" class="form-input text-center" value="${quantity}">
                </div>
                <!-- Price -->
                <div class="col-span-4 md:col-span-2">
                    <label for="itemPrice-${lineItemCount}" class="form-label">Price</label>
                    <input type="number" id="itemPrice-${lineItemCount}" name="itemPrice-${lineItemCount}" class="form-input text-right" value="${price}">
                </div>
                <!-- Total -->
                <div class="col-span-4 md:col-span-2 text-right">
                     <label class="form-label">Total</label>
                    <p id="itemTotal-${lineItemCount}" class="font-semibold text-slate-800 text-lg">$0.00</p>
                </div>
            </div>
            <hr class="my-4 border-slate-200">
            <div class="flex justify-between items-center">
                <!-- Warranty Toggle -->
                <div class="flex items-center">
                    <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" name="warrantyToggle-${lineItemCount}" id="warrantyToggle-${lineItemCount}" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" checked/>
                        <label for="warrantyToggle-${lineItemCount}" class="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 cursor-pointer"></label>
                    </div>
                    <label for="warrantyToggle-${lineItemCount}" class="text-sm font-medium text-slate-700">Covered by Warranty?</label>
                </div>
                <!-- Remove Button -->
                <button type="button" class="removeItemBtn text-red-500 hover:text-red-700 font-semibold text-sm" data-itemid="${lineItemCount}">Remove</button>
            </div>
        </div>
    `;

    if(lineItemsContainer) lineItemsContainer.insertAdjacentHTML('beforeend', newItemHtml);
    attachLineItemListeners(lineItemCount);
    updateLineItemTotal(lineItemCount);
    updateTotals();
}

function updateTotals() {
    // Get all display elements
    const warrantySubtotalDisplay = document.getElementById('warrantySubtotalDisplay');
    const customerSubtotalDisplay = document.getElementById('customerSubtotalDisplay');
    const totalDisplay = document.getElementById('totalDisplay');
    const warrantyTotalDisplay = document.getElementById('warrantyTotalDisplay');
    const grandTotalDisplay = document.getElementById('grandTotalDisplay');
    const salesTaxRateInput = document.getElementById('salesTaxRate');
    const salesTaxAmountDisplay = document.getElementById('salesTaxAmountDisplay');

    // Get all the new fee input elements
    const warrantyLaborInput = document.getElementById('warrantyLabor');
    const customerLaborInput = document.getElementById('customerLabor');
    const warrantyServiceCallInput = document.getElementById('warrantyServiceCall');
    const customerServiceCallInput = document.getElementById('customerServiceCall');

    let warrantySubtotal = 0;
    let customerSubtotal = 0;

    // Calculate subtotals from line items
    document.querySelectorAll('.line-item').forEach(item => {
        const id = item.id.split('-')[1];
        const quantityEl = document.querySelector(`[name=itemQuantity-${id}]`);
        const priceEl = document.querySelector(`[name=itemPrice-${id}]`);
        const warrantyToggle = document.querySelector(`[name=warrantyToggle-${id}]`);

        if (quantityEl && priceEl && warrantyToggle) {
            const itemTotal = (parseFloat(quantityEl.value) || 0) * (parseFloat(priceEl.value) || 0);
            if (warrantyToggle.checked) {
                warrantySubtotal += itemTotal;
            } else {
                customerSubtotal += itemTotal;
            }
        }
    });

    // Read the values from the four new fee fields
    const warrantyLabor = warrantyLaborInput ? (parseFloat(warrantyLaborInput.value) || 0) : 0;
    const customerLabor = customerLaborInput ? (parseFloat(customerLaborInput.value) || 0) : 0;
    const warrantyServiceCall = warrantyServiceCallInput ? (parseFloat(warrantyServiceCallInput.value) || 0) : 0;
    const customerServiceCall = customerServiceCallInput ? (parseFloat(customerServiceCallInput.value) || 0) : 0;

    // Calculate sales tax
    const taxRate = salesTaxRateInput ? (parseFloat(salesTaxRateInput.value) || 0) : 0;
    
    // --- NEW LOGIC: Tax is applied only to parts/items for both customer and warranty. ---
    const customerTax = customerSubtotal * (taxRate / 100);
    const warrantyTax = warrantySubtotal * (taxRate / 100);
    const totalTax = customerTax + warrantyTax;

    // Calculate totals
    const customerTotal = customerSubtotal + customerLabor + customerServiceCall + customerTax;
    const warrantyTotal = warrantySubtotal + warrantyLabor + warrantyServiceCall + warrantyTax;
    const grandTotal = customerTotal + warrantyTotal;

    // Update all the display elements on the screen
    if(warrantySubtotalDisplay) warrantySubtotalDisplay.value = warrantySubtotal;
    if(customerSubtotalDisplay) customerSubtotalDisplay.value = customerSubtotal;
    if(salesTaxAmountDisplay) salesTaxAmountDisplay.textContent = formatCurrency(totalTax);
    if(totalDisplay) totalDisplay.textContent = formatCurrency(customerTotal);
    if(warrantyTotalDisplay) warrantyTotalDisplay.textContent = formatCurrency(warrantyTotal);
    if(grandTotalDisplay) grandTotalDisplay.textContent = formatCurrency(grandTotal);
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
    signatureCanvas.height = signaturePadContainer.offsetHeight * ratio; 
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
    // --- FIX STARTS HERE ---
    const warrantyToggle = document.querySelector(`[name=warrantyToggle-${id}]`); // Get the new toggle

    if(quantityInput && priceInput) {
        [quantityInput, priceInput].forEach(input => {
            input.addEventListener('input', () => {
                updateLineItemTotal(id);
                updateTotals();
            });
        });
    }
    
    // Add an event listener to the new toggle switch
    if (warrantyToggle) {
        warrantyToggle.addEventListener('change', () => {
            updateTotals(); // Recalculate everything when the toggle is clicked
        });
    }
    // --- FIX ENDS HERE ---

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

async function uploadInvoiceImages(jobId) {
    if (invoiceImageFiles.length === 0) {
        return [];
    }
    if (!jobId) {
        console.error("Cannot upload images, Job ID is missing.");
        showMessage("Cannot upload images, Job ID is missing.", "error");
        throw new Error("Job ID is missing");
    }

    // Helper to read a file as a Base64 Data URL
    const readFileAsDataURL = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    };

    const uploadPromises = invoiceImageFiles.map(async (file) => {
        try {
            const imageDataUrl = await readFileAsDataURL(file);
            
            const response = await fetch(UPLOAD_INVOICE_IMAGE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jobId: jobId,
                    filename: file.name,
                    imageDataUrl: imageDataUrl,
                }),
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.details || `Server error: ${response.status}`);
            }

            const result = await response.json();
            return result.url;

        } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            // We throw the error so that Promise.all will reject.
            throw error; 
        }
    });

    try {
        const imageUrls = await Promise.all(uploadPromises);
        console.log("All images uploaded successfully via backend:", imageUrls);
        return imageUrls;
    } catch (error) {
        console.error("One or more image uploads failed:", error);
        showMessage("Error uploading images. Please try again.", "error");
        // Re-throw the error to be caught by the save button's handler
        throw error;
    }
}

function collectInvoiceData(imageUrls = []) {
    // --- 1. GATHER ALL RAW DATA FROM THE FORM ---
    const invoiceFormEl = document.getElementById('invoiceForm');
    const formData = new FormData(invoiceFormEl);
    const selectedCountyTaxRadio = document.querySelector('input[name="countyTax"]:checked');
    let selectedCountyValue = selectedCountyTaxRadio ? selectedCountyTaxRadio.value : null;
    if (selectedCountyValue === 'Other') {
        const customAreaNameInput = document.getElementById('customAreaName');
        const customName = customAreaNameInput ? customAreaNameInput.value.trim() : '';
        selectedCountyValue = customName || 'Custom';
    }

    const baseData = {
        invoiceDate: document.getElementById('invoiceDate').value,
        poNumber: document.getElementById('poNumber').value,
        customerName: document.getElementById('customerName').value.trim(),
        customerEmail: document.getElementById('customerEmail').value.trim(),
        customerPhone: document.getElementById('customerPhone').value,
        customerAddress: document.getElementById('customerAddress').value,
        jobAddress: document.getElementById('jobAddress').value,
        recommendations: document.getElementById('recommendations').value,
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || null,
        chequeNumber: document.getElementById('chequeNumber').value.trim() || null,
        salesTaxRate: parseFloat(document.getElementById('salesTaxRate').value) || 0,
        signatureDataURL: confirmedSignatureDataURL,
        signedBy: confirmedSignatureDataURL ? (document.getElementById('customerName')?.value.trim() || "Customer") : null,
        selectedCountyTax: selectedCountyValue,
        planType: document.getElementById('planType').value,
        warrantyName: document.getElementById('warrantyName').value,
        imageUrls: imageUrls,
    };
     if (auth.currentUser && auth.currentUser.uid) {
        baseData.createdByWorkerId = auth.currentUser.uid;
        baseData.workerName = auth.currentUser.displayName || (auth.currentUser.email ? auth.currentUser.email.split('@')[0] : 'N/A');
    }

    // --- 2. SEPARATE ITEMS AND FEES ---
    const warrantyItems = [];
    const customerItems = [];
    document.querySelectorAll('.line-item').forEach(item => {
        const id = item.id.split('-')[1];
        const warrantyToggle = document.querySelector(`[name=warrantyToggle-${id}]`);
        const lineItemData = {
            description: document.querySelector(`[name=itemDescription-${id}]`).value,
            quantity: parseFloat(document.querySelector(`[name=itemQuantity-${id}]`).value) || 0,
            price: parseFloat(document.querySelector(`[name=itemPrice-${id}]`).value) || 0,
        };
        lineItemData.total = lineItemData.quantity * lineItemData.price;

        if (warrantyToggle && warrantyToggle.checked) {
            warrantyItems.push(lineItemData);
        } else {
            customerItems.push(lineItemData);
        }
    });

    const warrantyLabor = parseFloat(document.getElementById('warrantyLabor').value) || 0;
    const customerLabor = parseFloat(document.getElementById('customerLabor').value) || 0;
    const warrantyServiceCall = parseFloat(document.getElementById('warrantyServiceCall').value) || 0;
    const customerServiceCall = parseFloat(document.getElementById('customerServiceCall').value) || 0;

    // --- 3. CREATE THE TWO INVOICE OBJECTS ---
    const customerInvoice = {
        ...baseData,
        invoiceType: 'customer',
        items: customerItems,
        labor: customerLabor,
        serviceCall: customerServiceCall,
        subtotal: customerItems.reduce((acc, item) => acc + item.total, 0),
        status: 'pending',
    };
    // --- NEW LOGIC: Tax is applied only to parts/items ---
    customerInvoice.salesTaxAmount = customerInvoice.subtotal * (customerInvoice.salesTaxRate / 100);
    customerInvoice.total = customerInvoice.subtotal + customerInvoice.labor + customerInvoice.serviceCall + customerInvoice.salesTaxAmount;

    const warrantyInvoice = {
        ...baseData,
        invoiceType: 'warranty',
        items: warrantyItems,
        labor: warrantyLabor,
        serviceCall: warrantyServiceCall,
        subtotal: warrantyItems.reduce((acc, item) => acc + item.total, 0),
        status: 'pending',
    };
    // --- NEW LOGIC: Tax is applied only to parts/items ---
    warrantyInvoice.salesTaxAmount = warrantyInvoice.subtotal * (warrantyInvoice.salesTaxRate / 100);
    warrantyInvoice.total = warrantyInvoice.subtotal + warrantyInvoice.labor + warrantyInvoice.serviceCall + warrantyInvoice.salesTaxAmount;

    // --- NEW LOGIC: Add separate descriptions to each invoice object ---
    customerInvoice.jobDescription = document.getElementById('nonCoveredJobDescription').value;
    customerInvoice.typeOfEquipment = document.getElementById('nonCoveredTypeOfEquipment').value;
    warrantyInvoice.jobDescription = document.getElementById('warrantyJobDescription').value;
    warrantyInvoice.typeOfEquipment = document.getElementById('warrantyTypeOfEquipment').value;

    // --- 4. ADD TO PENDING INVOICES ---
    // We add invoices that have a total value OR have a description/equipment type entered.
    if (customerInvoice.total > 0 || (customerInvoice.jobDescription && customerInvoice.jobDescription.trim()) || (customerInvoice.typeOfEquipment && customerInvoice.typeOfEquipment.trim())) {
        pendingInvoices.push(customerInvoice);
    }
    if (warrantyInvoice.total > 0 || (warrantyInvoice.jobDescription && warrantyInvoice.jobDescription.trim()) || (warrantyInvoice.typeOfEquipment && warrantyInvoice.typeOfEquipment.trim())) {
        pendingInvoices.push(warrantyInvoice);
    }

    console.log("Created Customer Invoice:", customerInvoice);
    console.log("Created Warranty Invoice:", warrantyInvoice);
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
    document.getElementById('warrantyName').value = job.warrantyProvider || '';

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
              <div class="flex flex-col justify-center flex-grow">
                <p class="text-[#111518] text-base font-medium leading-normal">Invoice for ${invoice.customerName} (${invoice.invoiceType === 'warranty' ? 'Warranty' : 'Non covered'})</p>
                <p class="text-[#60768a] text-sm font-normal leading-normal">Total: ${formatCurrency(invoice.total)}</p>
              </div>
              <button class="preview-invoice-btn text-slate-500 hover:text-green-600" data-invoice-index="${index}">
                <span class="material-icons-outlined">visibility</span>
              </button>
            </div>
        `;
        pendingInvoicesList.insertAdjacentHTML('beforeend', invoiceCard);
    });

    const afterSendInvoiceTitle = document.getElementById('afterSendInvoiceTitle');
    if (afterSendInvoiceTitle) {
        afterSendInvoiceTitle.textContent = `Invoices for ${customerName}`;
    }

    // PDF Preview Logic
    const pdfPreviewModal = document.getElementById('pdfPreviewModal');
    const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');
    const closePdfPreviewBtn = document.getElementById('closePdfPreview');

    document.querySelectorAll('.preview-invoice-btn').forEach(button => {
        button.addEventListener('click', async () => { // Make the listener async
            const invoiceIndex = button.dataset.invoiceIndex;
            const invoice = pendingInvoices[invoiceIndex];
            if (invoice && invoice.pdfDataURL) {
                try {
                    // Convert data URI to blob
                    const response = await fetch(invoice.pdfDataURL);
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    
                    pdfPreviewFrame.src = objectUrl;
                    
                    const closePreviewModal = () => {
                        URL.revokeObjectURL(objectUrl); // Clean up the object URL to prevent memory leaks
                        pdfPreviewModal.classList.add('hidden');
                        pdfPreviewModal.classList.remove('flex');
                        pdfPreviewFrame.src = 'about:blank';
                    };

                    closePdfPreviewBtn.addEventListener('click', closePreviewModal, { once: true });
                    pdfPreviewModal.addEventListener('click', (e) => {
                        if (e.target === pdfPreviewModal) {
                            closePreviewModal();
                        }
                    }, { once: true });


                    pdfPreviewModal.classList.remove('hidden');
                    pdfPreviewModal.classList.add('flex');
                } catch (error) {
                    console.error("Error creating PDF preview:", error);
                    showMessage('Could not generate PDF preview.', 'error');
                }
            } else {
                showMessage('PDF preview is not available for this invoice.', 'error');
            }
        });
    });
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

    // --- New Link Logic ---
    const linkContainer = document.getElementById('warrantyModalLinkContainer');
    const linkInput = document.getElementById('warrantyModalLinkInput');
    const copyBtn = document.getElementById('warrantyModalCopyBtn');

    if (linkContainer && linkInput && copyBtn && job.id) {
        const schedulingUrl = `${window.location.origin}/scheduling.html?jobId=${job.id}`;
        linkInput.value = schedulingUrl;
        linkContainer.classList.remove('hidden');

        copyBtn.onclick = () => {
            linkInput.select();
            document.execCommand('copy');
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = `<span class="material-icons-outlined text-lg">check</span>`;
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
            }, 2000);
        };
    } else if (linkContainer) {
        // Hide it if there's no job id
        linkContainer.classList.add('hidden');
    }
    // --- End New Link Logic ---

    modal.style.display = 'block';

    const closeButtons = modal.querySelectorAll('.close-button');
    closeButtons.forEach(btn => {
        btn.onclick = () => { modal.style.display = 'none'; }
    });
    window.onclick = (event) => {
        if (event.target == modal) { modal.style.display = 'none'; }
    }
}

// --- Tab Visibility Settings ---

function renderTabVisibilitySettings() {
    if (!tabVisibilityContainer) return;

    tabVisibilityContainer.innerHTML = '';
    const settings = loadTabSettings();

    navLinks.forEach(link => {
        const targetId = link.dataset.target;
        if (targetId === 'settings') return;

        if (targetId === 'performance') {
            const toggleWrapper = document.createElement('div');
            toggleWrapper.className = 'flex items-center justify-between py-2';

            const labelContainer = document.createElement('div');
            
            const label = document.createElement('label');
            label.htmlFor = 'toggle-performance';
            label.className = 'text-slate-700 font-medium';
            label.textContent = 'Performance';
            
            const comingSoonText = document.createElement('p');
            comingSoonText.className = 'text-xs text-gray-500';
            comingSoonText.textContent = 'This feature is coming soon!';

            labelContainer.appendChild(label);
            labelContainer.appendChild(comingSoonText);

            const switchContainer = document.createElement('div');
            switchContainer.className = 'relative inline-block w-10 mr-2 align-middle select-none';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'toggle-performance';
            checkbox.id = 'toggle-performance';
            checkbox.className = 'toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-not-allowed';
            checkbox.checked = false;
            checkbox.disabled = true;

            const switchLabel = document.createElement('label');
            switchLabel.htmlFor = 'toggle-performance';
            switchLabel.className = 'toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-not-allowed';

            switchContainer.appendChild(checkbox);
            switchContainer.appendChild(switchLabel);
            toggleWrapper.appendChild(labelContainer);
            toggleWrapper.appendChild(switchContainer);
            tabVisibilityContainer.appendChild(toggleWrapper);
            return;
        }

        const isVisible = settings[targetId] !== false;

        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = 'flex items-center justify-between py-2';

        const label = document.createElement('label');
        label.htmlFor = `toggle-${targetId}`;
        label.className = 'text-slate-700 font-medium';
        
        let labelText = '';
        link.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                labelText = node.textContent.trim();
            }
        });
        label.textContent = labelText || targetId;

        const switchContainer = document.createElement('div');
        switchContainer.className = 'relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = `toggle-${targetId}`;
        checkbox.id = `toggle-${targetId}`;
        checkbox.className = 'toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer';
        checkbox.checked = isVisible;
        checkbox.dataset.target = targetId;

        const switchLabel = document.createElement('label');
        switchLabel.htmlFor = `toggle-${targetId}`;
        switchLabel.className = 'toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer';

        switchContainer.appendChild(checkbox);
        switchContainer.appendChild(switchLabel);
        toggleWrapper.appendChild(label);
        toggleWrapper.appendChild(switchContainer);
        tabVisibilityContainer.appendChild(toggleWrapper);
    });
}

function saveTabSettings() {
    const settings = {};
    const toggles = document.querySelectorAll('#tab-visibility-container .toggle-checkbox');
    toggles.forEach(toggle => {
        settings[toggle.dataset.target] = toggle.checked;
    });
    localStorage.setItem('tabVisibilitySettings', JSON.stringify(settings));
}

function loadTabSettings() {
    const settingsString = localStorage.getItem('tabVisibilitySettings');
    return settingsString ? JSON.parse(settingsString) : {};
}

function applyTabVisibility() {
    const settings = loadTabSettings();
    let firstVisibleTab = null;

    navLinks.forEach(link => {
        const targetId = link.dataset.target;
        // Settings tab can't be hidden
        if (targetId === 'settings') {
            if (!firstVisibleTab) firstVisibleTab = targetId;
            return;
        }

        // Always hide the performance tab
        if (targetId === 'performance') {
            link.classList.add('hidden');
            return;
        }

        const isVisible = settings[targetId] !== false; // Default to visible
        link.classList.toggle('hidden', !isVisible);

        if (isVisible && !firstVisibleTab) {
            firstVisibleTab = targetId;
        }
    });

    // If the currently active tab is now hidden, switch to the first available one.
    const activeLink = document.querySelector('.nav-link.active');
    if (activeLink && activeLink.classList.contains('hidden')) {
        // If all tabs are hidden, it will switch to 'settings'
        switchView(firstVisibleTab || 'settings');
    }
}

// --- End Tab Visibility Settings ---
