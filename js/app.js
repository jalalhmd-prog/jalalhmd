// app.js - Core Application
const db = new FamilyDB();
let currentPage = 'dashboard';
let isAdmin = false;

async function initApp() {
    await db.init();
    await db.migrateWifesToChildren();
    setupEvents();
    // Start in guest mode
    showGuest();
}

// ===== AUTH =====
function showGuest() {
    isAdmin = false;
    document.getElementById('guestScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
}

function showAdmin() {
    isAdmin = true;
    document.getElementById('guestScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    navigate('dashboard');
}

function openAdminLogin() {
    document.getElementById('adminLoginModal').classList.remove('hidden');
}

function closeAdminLogin() {
    document.getElementById('adminLoginModal').classList.add('hidden');
    document.getElementById('loginError').textContent = '';
}

async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;
    const auth = await db.getAuth();
    if (auth && u === auth.username && p === auth.password) {
        sessionStorage.setItem('loggedIn', '1');
        closeAdminLogin();
        showAdmin();
    } else {
        document.getElementById('loginError').textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    }
}

// ===== GUEST ACTIONS =====
async function guestRetrieveFamily() {
    const natId = document.getElementById('guestRetrieveId').value.trim();
    if (!natId) { showToast('أدخل رقم الهوية', 'warning'); return; }
    const results = await db.search(natId);
    const head = results.find(m => m.role === 'head' && m.nationalId === natId);
    if (!head) { showToast('لا توجد أسرة بهذا الرقم', 'error'); return; }
    // Show family info in guest content (read-only with request edit)
    const members = await db.getFamilyMembers(head.id);
    const others = members.filter(m => m.role !== 'head')
        .sort((a, b) => sortByAge(a, b));

    document.getElementById('guestContent').innerHTML = `
        <div class="card" style="text-align:right;margin-top:16px">
            <h4 style="margin-bottom:12px;color:var(--primary-light)"><i class="fas fa-house-user"></i> أسرة ${head.fullName} ${head.familyName?'('+head.familyName+')':''}</h4>
            <div class="member-info-grid">
                ${infoItem('رب الأسرة',head.fullName)}
                ${infoItem('الهوية',head.nationalId)}
                ${infoItem('الجنس',getGenderLabel(head.gender))}
                ${infoItem('تاريخ الميلاد',formatDate(head.birthDate))}
                ${infoItem('العمر',formatAge(head.birthDate))}
                ${infoItem('الحالة',getMaritalLabel(head.maritalStatus))}
                ${infoItem('اسم الأم',head.motherName)}
                ${infoItem('العنوان',head.address)}
                ${infoItem('الجوال',head.phone)}
            </div>
            ${others.length ? `<h4 style="margin:12px 0 8px;font-size:14px"><i class="fas fa-users"></i> أفراد الأسرة</h4>
                <div class="member-info-grid">${others.map(c => infoItem(c.relationship || 'فرد', c.fullName + (formatAge(c.birthDate) !== '-' ? ' (' + formatAge(c.birthDate) + ')' : ''))).join('')}</div>` : ''}
            <div style="margin-top:16px">
                <button class="btn btn-success btn-sm" onclick="guestAddMember(${head.id})"><i class="fas fa-plus"></i> إضافة فرد</button>
            </div>
        </div>`;
}

function guestAddMember(headId) {
    document.getElementById('guestScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    document.querySelector('.sidebar').classList.add('hidden');
    document.querySelector('.main-content').style.marginRight = '0';
    navigate('add-member', {role:'child', familyId: headId, guestMode: true});
}

// ===== NAVIGATION =====
function navigate(page, params = {}) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const active = document.querySelector(`[data-page="${page}"]`);
    if (active) active.classList.add('active');

    const titles = { dashboard:'الرئيسية', 'all-members':'جميع الأفراد', search:'البحث', reports:'التقارير', 'import-export':'استيراد / تصدير', settings:'الإعدادات', 'family-detail':'تفاصيل الأسرة', 'add-member':'إضافة فرد', 'edit-member':'تعديل بيانات', 'family-tree':'شجرة الأسرة' };
    document.getElementById('pageTitle').textContent = titles[page] || '';

    closeSidebar();
    const content = document.getElementById('mainContent');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    setTimeout(() => {
        switch(page) {
            case 'dashboard': renderDashboard(); break;
            case 'family-detail': renderFamilyDetail(params.headId); break;
            case 'all-members': renderAllMembers(); break;
            case 'search': renderSearch(params.query || ''); break;
            case 'add-member': renderMemberForm(params); break;
            case 'edit-member': renderMemberForm(params); break;
            case 'reports': renderReports(); break;
            case 'import-export': renderImportExport(); break;
            case 'settings': renderSettings(); break;
            case 'family-tree': renderFamilyTree(params.headId); break;
            default: renderDashboard();
        }
    }, 100);
}

// ===== EVENTS =====
function setupEvents() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('adminLoginBtn').addEventListener('click', openAdminLogin);
    document.getElementById('guestAddFamily').addEventListener('click', () => {
        // Switch to admin-like view just for adding
        document.getElementById('guestScreen').classList.add('hidden');
        document.getElementById('appShell').classList.remove('hidden');
        document.querySelector('.sidebar').classList.add('hidden');
        document.querySelector('.main-content').style.marginRight = '0';
        navigate('add-member', {role:'head', guestMode: true});
    });
    document.getElementById('guestRetrieveBtn').addEventListener('click', guestRetrieveFamily);
    document.getElementById('guestRetrieveId').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') guestRetrieveFamily();
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('loggedIn');
        showGuest();
    });
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.querySelector('#modal .modal-overlay').addEventListener('click', closeModal);
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', (e) => { e.preventDefault(); navigate(n.dataset.page); });
    });
    document.getElementById('quickSearch').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) navigate('search', { query: e.target.value.trim() });
    });
    // Theme toggle
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
    document.getElementById('themeToggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    });
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function backToGuest() {
    document.querySelector('.sidebar').classList.remove('hidden');
    document.querySelector('.main-content').style.marginRight = '';
    showGuest();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }

// ===== HELPERS =====
function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.remove(); }, 3000);
}

function showModal(title, body, footer = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    const f = document.getElementById('modalFooter');
    if (footer) { f.innerHTML = footer; f.classList.remove('hidden'); } else { f.classList.add('hidden'); }
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// Format date as DD/MM/YYYY with English numerals
function formatDate(d) {
    if (!d) return '-';
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return d;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch(e) { return d; }
}

// Calculate age from birthDate
function calculateAge(birthDate) {
    if (!birthDate) return '';
    try {
        const birth = new Date(birthDate);
        if (isNaN(birth.getTime())) return '';
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age >= 0 ? age : '';
    } catch(e) { return ''; }
}

// Format age for display
function formatAge(birthDate) {
    const age = calculateAge(birthDate);
    return age !== '' ? age + ' سنة' : '-';
}

// Sort by age (oldest first)
function sortByAge(a, b) {
    if (!a.birthDate && !b.birthDate) return 0;
    if (!a.birthDate) return 1;
    if (!b.birthDate) return -1;
    return new Date(a.birthDate) - new Date(b.birthDate);
}

function getMaritalLabel(s) { return {single:'أعزب/عزباء',married:'متزوج/ة',divorced:'مطلق/ة',widowed:'أرمل/ة',separated:'منفصل/ة'}[s]||s||'-'; }
function getGenderLabel(g) { return g==='male'?'ذكر':g==='female'?'أنثى':'-'; }
function getRoleLabel(r) { return {head:'رب أسرة',child:'فرد'}[r]||r; }

// ===== DASHBOARD =====
async function renderDashboard() {
    const stats = await db.getStats();
    const heads = await db.getAllHeads();
    const all = await db.getAllMembers();

    let familiesHtml = '';
    if (!heads.length) {
        familiesHtml = '<div class="empty-state"><i class="fas fa-inbox"></i><h3>لا توجد أسر</h3><p>ابدأ بإضافة أسرة جديدة</p></div>';
    } else {
        familiesHtml = '<div class="cards-grid">';
        for (const h of heads) {
            const members = all.filter(m => m.familyId === h.id);
            familiesHtml += `<div class="card family-card" onclick="navigate('family-detail',{headId:${h.id}})">
                <div class="family-card-head"><div class="family-avatar">${h.photo?`<img src="${h.photo}">`:'<i class="fas fa-user"></i>'}</div>
                <div><div class="family-name">${h.fullName} ${h.familyName?'<small style="color:var(--text-muted)">('+h.familyName+')</small>':''}</div><div class="family-id">هوية: ${h.nationalId||'-'}</div></div></div>
                <div class="family-meta"><span><i class="fas fa-users"></i> ${members.length} فرد</span>
                <span><i class="fas fa-ring"></i> ${getMaritalLabel(h.maritalStatus)}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${h.address||'-'}</span></div></div>`;
        }
        familiesHtml += '</div>';
    }

    document.getElementById('mainContent').innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-house-user"></i></div><div class="stat-info"><h3>${stats.families}</h3><p>أسرة</p></div></div>
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-users"></i></div><div class="stat-info"><h3>${stats.total}</h3><p>فرد</p></div></div>
            <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-male"></i></div><div class="stat-info"><h3>${stats.males}</h3><p>ذكور</p></div></div>
            <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-female"></i></div><div class="stat-info"><h3>${stats.females}</h3><p>إناث</p></div></div>
        </div>
        <div class="quick-actions">
            <div class="quick-action" onclick="navigate('add-member',{role:'head'})"><i class="fas fa-plus-circle"></i><span>إضافة أسرة جديدة</span></div>
            <div class="quick-action" onclick="navigate('search')"><i class="fas fa-search"></i><span>البحث</span></div>
            <div class="quick-action" onclick="navigate('import-export')"><i class="fas fa-file-excel"></i><span>استيراد / تصدير</span></div>
        </div>
        <div class="section">
            <div class="section-header"><h3 class="section-title"><i class="fas fa-house-user"></i> الأسر (${heads.length})</h3></div>
            ${familiesHtml}
        </div>`;
}

function infoItem(label, value) {
    return `<div class="info-item"><label>${label}</label><span>${value||'-'}</span></div>`;
}

initApp();
