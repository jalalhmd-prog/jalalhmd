// app.js - Core Application
const db = new FamilyDB();
let currentPage = 'dashboard';

async function initApp() {
    await db.init();
    await db.migrateWifesToChildren();
    setupEvents();
    navigate('dashboard');
}

// ===== NAVIGATION =====
function navigate(page, params = {}) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const active = document.querySelector(`[data-page="${page}"]`);
    if (active) active.classList.add('active');

    const titles = { dashboard:'الرئيسية', 'all-members':'جميع الأفراد', 'import-export':'استيراد / تصدير', settings:'الإعدادات', 'family-detail':'تفاصيل الأسرة', 'add-member':'إضافة فرد', 'edit-member':'تعديل بيانات', 'family-tree':'شجرة الأسرة' };
    document.getElementById('pageTitle').textContent = titles[page] || '';

    closeSidebar();
    const content = document.getElementById('mainContent');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    setTimeout(() => {
        switch(page) {
            case 'dashboard': renderDashboard(); break;
            case 'family-detail': renderFamilyDetail(params.headId); break;
            case 'all-members': renderAllMembers(); break;
            case 'import-export': renderImportExport(); break;
            case 'add-member': renderMemberForm(params); break;
            case 'edit-member': renderMemberForm(params); break;
            case 'settings': renderSettings(); break;
            case 'family-tree': renderFamilyTree(params.headId); break;
            default: renderDashboard();
        }
    }, 100);
}

// ===== EVENTS =====
function setupEvents() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        navigate('dashboard');
    });
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.querySelector('#modal .modal-overlay').addEventListener('click', closeModal);
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', (e) => { e.preventDefault(); navigate(n.dataset.page); });
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
            const children = members.filter(m => m.role === 'child').sort((a, b) => sortByAge(a, b));
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
            <div class="quick-action" onclick="navigate('all-members')"><i class="fas fa-users"></i><span>جميع الأفراد</span></div>
            <div class="quick-action" onclick="navigate('import-export')"><i class="fas fa-file-excel"></i><span>استيراد / تصدير</span></div>
        </div>
        <div class="section">
            <div class="section-header"><h3 class="section-title"><i class="fas fa-house-user"></i> البطاقات العائلية (${heads.length})</h3></div>
            ${familiesHtml}
        </div>`;
}

function infoItem(label, value) {
    return `<div class="info-item"><label>${label}</label><span>${value||'-'}</span></div>`;
}

initApp();
