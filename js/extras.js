// extras.js - Reports, Import/Export, Settings, Family Tree

// ===== REPORTS =====
async function renderReports() {
    const stats = await db.getStats();
    const heads = await db.getAllHeads();
    const all = await db.getAllMembers();

    document.getElementById('mainContent').innerHTML = `
        <div class="section">
            <div class="section-header"><h3 class="section-title"><i class="fas fa-chart-pie"></i> الإحصائيات العامة</h3></div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-house-user"></i></div><div class="stat-info"><h3>${stats.families}</h3><p>أسرة</p></div></div>
                <div class="stat-card"><div class="stat-icon green"><i class="fas fa-users"></i></div><div class="stat-info"><h3>${stats.total}</h3><p>فرد</p></div></div>
                <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-male"></i></div><div class="stat-info"><h3>${stats.males}</h3><p>ذكور</p></div></div>
                <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-female"></i></div><div class="stat-info"><h3>${stats.females}</h3><p>إناث</p></div></div>
            </div>
        </div>
        <div class="section">
            <div class="section-header"><h3 class="section-title"><i class="fas fa-id-card"></i> البطاقات العائلية</h3></div>
            <div class="cards-grid" id="familyCards">
                ${heads.map(h => {
                    const members = all.filter(m => m.familyId === h.id);
                    const children = members.filter(m => m.role === 'child').sort((a, b) => sortByAge(a, b));
                    return `<div class="card"><h4 style="margin-bottom:12px;color:var(--primary-light)"><i class="fas fa-house-user"></i> أسرة ${h.fullName}</h4>
                        <div class="info-item" style="margin-bottom:8px"><label>رب الأسرة</label><span>${h.fullName} - ${h.nationalId||''}</span></div>
                        ${children.length?`<div class="info-item" style="margin-bottom:8px"><label>أفراد الأسرة</label><span>${children.map(c=>(c.relationship||'فرد')+': '+c.fullName).join('، ')}</span></div>`:''}
                        <div class="info-item"><label>عدد الأفراد</label><span>${members.length}</span></div></div>`;
                }).join('')}
            </div>
        </div>`;
}

// ===== IMPORT/EXPORT =====
async function renderImportExport() {
    document.getElementById('mainContent').innerHTML = `
        <div class="section">
            <div class="section-header"><h3 class="section-title"><i class="fas fa-file-excel"></i> استيراد / تصدير البيانات</h3></div>
            <div class="cards-grid">
                <div class="card">
                    <h4 style="margin-bottom:16px"><i class="fas fa-download" style="color:var(--success)"></i> تصدير</h4>
                    <p style="color:var(--text-muted);margin-bottom:16px">تصدير جميع البيانات إلى ملف Excel</p>
                    <button class="btn btn-success" onclick="exportToExcel()"><i class="fas fa-file-download"></i> تصدير Excel</button>
                </div>
                <div class="card">
                    <h4 style="margin-bottom:16px"><i class="fas fa-file-download" style="color:var(--info)"></i> تحميل النموذج</h4>
                    <p style="color:var(--text-muted);margin-bottom:16px">حمّل نموذج Excel فارغ لتعبئته بالبيانات</p>
                    <button class="btn btn-outline" onclick="downloadTemplate()"><i class="fas fa-download"></i> تحميل النموذج</button>
                </div>
                <div class="card">
                    <h4 style="margin-bottom:16px"><i class="fas fa-upload" style="color:var(--warning)"></i> استيراد</h4>
                    <p style="color:var(--text-muted);margin-bottom:16px">استيراد بيانات من ملف Excel</p>
                    <div class="drop-zone" id="dropZone" onclick="document.getElementById('importFile').click()">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <h3>اسحب الملف هنا</h3>
                        <p>أو انقر للاختيار</p>
                        <input type="file" id="importFile" accept=".xlsx,.xls" style="display:none">
                    </div>
                    <div id="importResults" style="margin-top:16px"></div>
                </div>
            </div>
        </div>`;

    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleImportFile(e.dataTransfer.files[0]); });
    document.getElementById('importFile').addEventListener('change', (e) => { if(e.target.files[0]) handleImportFile(e.target.files[0]); });
}

async function exportToExcel() {
    const all = await db.getAllMembers();
    const heads = await db.getAllHeads();
    const headMap = {};
    heads.forEach(h => { headMap[h.id] = h.nationalId; });
    const data = all.map(m => ({
        'الاسم': m.fullName, 'رقم الهوية': m.nationalId, 'الجنس': getGenderLabel(m.gender),
        'تاريخ الميلاد': m.birthDate, 'العمر': calculateAge(m.birthDate) !== '' ? calculateAge(m.birthDate) : '',
        'الحالة الاجتماعية': getMaritalLabel(m.maritalStatus),
        'اسم الأم': m.motherName, 'لقب العائلة': m.familyName, 'العنوان': m.address, 'الجوال': m.phone,
        'الدور': getRoleLabel(m.role), 'صلة القرابة': m.relationship,
        'هوية رب الأسرة': headMap[m.familyId] || m.nationalId,
        'تاريخ الوفاة': m.deathDate, 'ملاحظات': m.notes
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأفراد');
    XLSX.writeFile(wb, 'سجل_العائلة.xlsx');
    showToast('تم تصدير البيانات بنجاح');
}

function downloadTemplate() {
    const template = [{ 'الاسم':'', 'رقم الهوية':'', 'الجنس':'', 'تاريخ الميلاد':'', 'الحالة الاجتماعية':'', 'اسم الأم':'', 'لقب العائلة':'', 'العنوان':'', 'الجوال':'', 'الدور':'', 'صلة القرابة':'', 'هوية رب الأسرة':'', 'تاريخ الوفاة':'', 'ملاحظات':'' }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نموذج');
    XLSX.writeFile(wb, 'نموذج_السجل.xlsx');
    showToast('تم تحميل النموذج');
}

async function handleImportFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const wb = XLSX.read(e.target.result, {type:'array'});
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws);
            if (!rows.length) { showToast('الملف فارغ', 'error'); return; }

            const genderMap = {'ذكر':'male','أنثى':'female','انثى':'female','male':'male','female':'female'};
            const maritalMap = {'أعزب':'single','عزباء':'single','أعزب/عزباء':'single','متزوج':'married','متزوجة':'married','متزوج/ة':'married','مطلق':'divorced','مطلقة':'divorced','مطلق/ة':'divorced','أرمل':'widowed','ارملة':'widowed','أرمل/ة':'widowed','منفصل':'separated','منفصلة':'separated','منفصل/ة':'separated'};

            // Helper to find column value by partial match
            function getCol(r, keys) {
                for (const k of keys) {
                    for (const col of Object.keys(r)) {
                        if (col.includes(k)) return (r[col]||'').toString().trim();
                    }
                }
                return '';
            }

            const headIdMap = {};
            const members = [];

            for (const r of rows) {
                const nationalId = getCol(r, ['رقم الهوية', 'الهوية', 'هوية']).replace(/[^\d]/g,'') || getCol(r, ['رقم الهوية', 'الهوية']);
                const headNatId = getCol(r, ['هوية رب', 'رقم هوية رب', 'هوية الأب', 'هوية الاب', 'رب الأسرة', 'رب الاسرة']);
                const gender = genderMap[getCol(r, ['الجنس', 'جنس'])] || 'male';
                const rawRole = getCol(r, ['الدور', 'دور', 'نوع']);
                const rawRelation = getCol(r, ['صلة القرابة', 'القرابة', 'صلة']);

                // Determine role: head or child
                let role = 'child';
                let relationship = rawRelation;

                // Check if this person IS the head
                if (rawRole && (rawRole.includes('رب') || rawRole === 'رب أسرة' || rawRole === 'رب اسرة' || rawRole === 'رب الأسرة')) {
                    role = 'head';
                } else if (!headNatId || headNatId === nationalId) {
                    // No head reference or same as self = head
                    role = 'head';
                }

                // If child and no relationship specified, determine from gender or rawRole
                if (role === 'child' && !relationship) {
                    if (rawRole && (rawRole.includes('زوج') && !rawRole.includes('متزوج'))) {
                        relationship = 'زوجة';
                    } else if (gender === 'male') {
                        relationship = 'ابن';
                    } else {
                        relationship = 'ابنة';
                    }
                }

                const m = {
                    fullName: getCol(r, ['الاسم', 'اسم']),
                    nationalId: nationalId,
                    gender: gender,
                    birthDate: getCol(r, ['تاريخ الميلاد', 'الميلاد', 'ميلاد']),
                    maritalStatus: maritalMap[getCol(r, ['الحالة الاجتماعية', 'الحالة', 'حالة'])] || '',
                    motherName: getCol(r, ['اسم الأم', 'اسم الام', 'الأم', 'الام']),
                    familyName: getCol(r, ['لقب العائلة', 'اللقب', 'الفرع', 'لقب']),
                    address: getCol(r, ['العنوان', 'عنوان']),
                    phone: getCol(r, ['الجوال', 'الهاتف', 'جوال', 'هاتف', 'رقم الجوال']),
                    deathDate: getCol(r, ['تاريخ الوفاة', 'الوفاة', 'وفاة']),
                    notes: getCol(r, ['ملاحظات', 'ملاحظة']),
                    relationship: relationship,
                    role: role,
                    headNatId: headNatId,
                    photo: ''
                };
                members.push(m);
            }

            // Auto-detect: if headNatId references exist but no head with that ID, create head from first match
            const headNatIds = [...new Set(members.filter(m => m.headNatId && m.role === 'child').map(m => m.headNatId))];
            for (const hid of headNatIds) {
                const hasHead = members.some(m => m.role === 'head' && m.nationalId === hid);
                if (!hasHead) {
                    const candidate = members.find(m => m.nationalId === hid);
                    if (candidate) {
                        candidate.role = 'head';
                        candidate.relationship = '';
                    }
                }
            }

            let success = 0, failed = 0, errors = [];

            // Add heads first
            for (const m of members.filter(x => x.role === 'head')) {
                if (!m.fullName) { failed++; errors.push('سطر بدون اسم'); continue; }
                if (m.nationalId && headIdMap[m.nationalId]) { continue; }
                const id = await db.addMember({...m, familyId: 0});
                await db.updateMember(id, {familyId: id});
                if (m.nationalId) headIdMap[m.nationalId] = id;
                success++;
            }

            // Add children (linked by headNatId)
            for (const m of members.filter(x => x.role !== 'head')) {
                if (!m.fullName) { failed++; errors.push('سطر بدون اسم'); continue; }
                const fId = headIdMap[m.headNatId];
                if (!fId) { failed++; errors.push(`${m.fullName}: رب الأسرة غير موجود (هوية: ${m.headNatId})`); continue; }
                await db.addMember({...m, familyId: fId});
                success++;
            }

            document.getElementById('importResults').innerHTML = `
                <div class="card"><h4 style="margin-bottom:8px">نتيجة الاستيراد</h4>
                <p style="color:var(--success)">✅ نجح: ${success}</p>
                ${failed?`<p style="color:var(--danger)">❌ فشل: ${failed}</p><ul style="color:var(--text-muted);font-size:13px;margin-top:8px">${errors.slice(0,10).map(e=>`<li>${e}</li>`).join('')}</ul>`:''}</div>`;
            showToast(`تم استيراد ${success} سجل`);
        } catch(err) { showToast('خطأ في قراءة الملف: ' + err.message, 'error'); }
    };
    reader.readAsArrayBuffer(file);
}

// ===== SETTINGS =====
async function renderSettings() {
    const auth = await db.getAuth();
    document.getElementById('mainContent').innerHTML = `
        <div class="card settings-card">
            <h3 style="margin-bottom:20px"><i class="fas fa-cog"></i> الإعدادات</h3>
            <form id="settingsForm">
                <div class="form-group"><label>اسم المستخدم</label><input type="text" id="sUser" value="${auth.username}" required></div>
                <div class="form-group"><label>كلمة المرور الحالية</label><input type="password" id="sOldPass" required></div>
                <div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="sNewPass" required></div>
                <div class="form-group"><label>تأكيد كلمة المرور</label><input type="password" id="sConfPass" required></div>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ التغييرات</button>
            </form>
        </div>`;

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const auth = await db.getAuth();
        const oldPass = document.getElementById('sOldPass').value;
        const newPass = document.getElementById('sNewPass').value;
        const confPass = document.getElementById('sConfPass').value;
        const newUser = document.getElementById('sUser').value.trim();

        if (oldPass !== auth.password) { showToast('كلمة المرور الحالية غير صحيحة', 'error'); return; }
        if (newPass !== confPass) { showToast('كلمة المرور الجديدة غير متطابقة', 'error'); return; }
        if (!newUser) { showToast('اسم المستخدم مطلوب', 'error'); return; }

        await db.updateAuth({ username: newUser, password: newPass });
        showToast('تم تحديث الإعدادات بنجاح');
    });
}

// ===== FAMILY TREE =====
async function renderFamilyTree(headId) {
    const head = await db.getMember(headId);
    if (!head) { navigate('dashboard'); return; }
    const members = await db.getFamilyMembers(headId);
    const children = members.filter(m => m.role === 'child').sort((a, b) => sortByAge(a, b));

    // Separate wives and other members for tree display
    const wives = children.filter(m => m.relationship === 'زوجة');
    const others = children.filter(m => m.relationship !== 'زوجة');

    document.getElementById('mainContent').innerHTML = `
        <div class="section">
            <div class="section-header"><h3 class="section-title"><i class="fas fa-sitemap"></i> شجرة أسرة ${head.fullName}</h3>
            <button class="btn btn-outline btn-sm" onclick="navigate('family-detail',{headId:${headId}})"><i class="fas fa-arrow-right"></i> رجوع</button></div>
            <div class="tree-container"><div class="tree">
                <div class="tree-node head"><div class="tree-node-name">${head.fullName}</div><div class="tree-node-role">رب الأسرة</div></div>
                ${wives.length ? `<div class="tree-connector"></div><div class="tree-wives">${wives.map(w =>
                    `<div class="tree-node wife"><div class="tree-node-name">${w.fullName}</div><div class="tree-node-role">زوجة</div></div>`
                ).join('')}</div>` : ''}
                ${others.length ? `<div class="tree-connector"></div><div class="tree-children">${others.map(c =>
                    `<div class="tree-node child"><div class="tree-node-name">${c.fullName}</div><div class="tree-node-role">${c.relationship||'فرد'}</div></div>`
                ).join('')}</div>` : ''}
            </div></div>
        </div>`;
}
