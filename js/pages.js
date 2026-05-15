// pages.js - All page renderers

// ===== FAMILY DETAIL =====
async function renderFamilyDetail(headId) {
    const head = await db.getMember(headId);
    if (!head) { showToast('الأسرة غير موجودة', 'error'); navigate('dashboard'); return; }
    const members = await db.getFamilyMembers(headId);
    const others = members.filter(m => m.role !== 'head').sort((a, b) => sortByAge(a, b));

    document.getElementById('mainContent').innerHTML = `
        <div class="section">
            <div class="section-header">
                <h3 class="section-title"><i class="fas fa-user-tie"></i> رب الأسرة ${head.familyName?'<small style="color:var(--text-muted)">('+head.familyName+')</small>':''}</h3>
                <div class="btn-group no-print">
                    <button class="btn btn-primary btn-sm" onclick="navigate('edit-member',{memberId:${head.id}})"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn btn-outline btn-sm" onclick="navigate('family-tree',{headId:${head.id}})"><i class="fas fa-sitemap"></i> الشجرة</button>
                    <button class="btn btn-outline btn-sm" onclick="window.print()"><i class="fas fa-print"></i> طباعة البطاقة</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteHead(${head.id})"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>
            <div class="card"><div class="member-profile">
                <div class="member-photo">${head.photo?`<img src="${head.photo}">`:'<i class="fas fa-user"></i>'}</div>
                <div class="member-info-grid">
                    ${infoItem('الاسم',head.fullName)}${infoItem('الهوية',head.nationalId)}${infoItem('الجنس',getGenderLabel(head.gender))}
                    ${infoItem('الميلاد',formatDate(head.birthDate))}${infoItem('العمر',formatAge(head.birthDate))}${infoItem('الحالة',getMaritalLabel(head.maritalStatus))}${infoItem('اسم الأم',head.motherName)}
                    ${infoItem('العنوان',head.address)}${infoItem('الجوال',head.phone)}${head.familyName?infoItem('الفرع',head.familyName):''}
                    ${head.deathDate?infoItem('الوفاة',formatDate(head.deathDate)):''}
                    ${head.notes?infoItem('ملاحظات',head.notes):''}
                </div></div></div>
            <h3 class="print-header">بطاقة أسرة ${head.fullName} ${head.familyName?'('+head.familyName+')':''}</h3>
        </div>
        <div class="section">
            <div class="section-header"><h3 class="section-title"><i class="fas fa-users"></i> أفراد الأسرة (${others.length})</h3>
            <button class="btn btn-success btn-sm no-print" onclick="navigate('add-member',{role:'child',familyId:${headId}})"><i class="fas fa-plus"></i> إضافة فرد</button></div>
            ${membersList(others, headId)}
        </div>`;
}

function membersList(members, headId) {
    if (!members.length) return '<div class="empty-state" style="padding:30px"><i class="fas fa-user-plus" style="font-size:32px"></i><p>لا يوجد</p></div>';
    let html = '<div class="table-wrapper"><table><thead><tr><th>الاسم</th><th>الهوية</th><th>الجنس</th><th>صلة القرابة</th><th>العمر</th><th>الميلاد</th><th>الحالة</th><th class="no-print">إجراءات</th></tr></thead><tbody>';
    for (const m of members) {
        html += `<tr><td>${m.fullName}</td><td>${m.nationalId||'-'}</td><td>${getGenderLabel(m.gender)}</td>
            <td>${m.relationship||'-'}</td><td>${formatAge(m.birthDate)}</td><td>${formatDate(m.birthDate)}</td><td>${getMaritalLabel(m.maritalStatus)}</td>
            <td class="table-actions no-print">
                <button class="btn btn-sm btn-outline" onclick="navigate('edit-member',{memberId:${m.id}})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline" onclick="promoteToHead(${m.id})" title="ترقية لرب أسرة"><i class="fas fa-level-up-alt"></i></button>
                <button class="btn btn-sm btn-danger" onclick="confirmDeleteMember(${m.id},${headId})"><i class="fas fa-trash"></i></button>
            </td></tr>`;
    }
    html += '</tbody></table></div>';
    return html;
}

async function confirmDeleteHead(headId) {
    const canDel = await db.canDeleteHead(headId);
    if (!canDel) { showToast('لا يمكن حذف رب الأسرة قبل نقل أو حذف جميع أفراده', 'error'); return; }
    showModal('تأكيد الحذف', '<p>هل أنت متأكد من حذف رب الأسرة؟</p>',
        `<button class="btn btn-danger" onclick="deleteHead(${headId})">نعم، احذف</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

async function deleteHead(headId) { await db.deleteMember(headId); closeModal(); showToast('تم الحذف'); navigate('dashboard'); }

async function confirmDeleteMember(memberId, headId) {
    showModal('تأكيد الحذف', '<p>هل أنت متأكد من حذف هذا الفرد؟</p>',
        `<button class="btn btn-danger" onclick="deleteMemberAndRefresh(${memberId},${headId})">نعم</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

async function deleteMemberAndRefresh(memberId, headId) { await db.deleteMember(memberId); closeModal(); showToast('تم الحذف'); navigate('family-detail', {headId}); }

async function promoteToHead(memberId) {
    showModal('ترقية لرب أسرة', '<p>سيتم نقل هذا الفرد ليصبح رب أسرة مستقل. هل تريد المتابعة؟</p>',
        `<button class="btn btn-primary" onclick="doPromote(${memberId})">نعم</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

async function doPromote(memberId) { await db.promoteToHead(memberId); closeModal(); showToast('تمت الترقية بنجاح'); navigate('dashboard'); }

// ===== MEMBER FORM =====
async function renderMemberForm(params) {
    let member = {};
    let isEdit = false;
    const guestMode = params.guestMode || false;
    if (params.memberId) { member = await db.getMember(params.memberId) || {}; isEdit = true; }
    const role = member.role || params.role || 'head';
    const familyId = member.familyId || params.familyId || null;

    const knownRelations = ['زوجة','ابن','ابنة','أخ','أخت','أب','أم','جد','جدة'];
    const relationOptions = role === 'child' ? `
        <div class="form-group"><label>صلة القرابة</label>
            <select id="fRelation" onchange="toggleCustomRelation(this)">
                <option value="">اختر</option>
                <option value="زوجة" ${member.relationship==='زوجة'?'selected':''}>زوجة</option>
                <option value="ابن" ${member.relationship==='ابن'?'selected':''}>ابن</option>
                <option value="ابنة" ${member.relationship==='ابنة'?'selected':''}>ابنة</option>
                <option value="أخ" ${member.relationship==='أخ'?'selected':''}>أخ</option>
                <option value="أخت" ${member.relationship==='أخت'?'selected':''}>أخت</option>
                <option value="أب" ${member.relationship==='أب'?'selected':''}>أب</option>
                <option value="أم" ${member.relationship==='أم'?'selected':''}>أم</option>
                <option value="جد" ${member.relationship==='جد'?'selected':''}>جد</option>
                <option value="جدة" ${member.relationship==='جدة'?'selected':''}>جدة</option>
                <option value="other" ${member.relationship && !knownRelations.includes(member.relationship)?'selected':''}>أخرى</option>
            </select>
        </div>
        <div class="form-group" id="customRelationGroup" style="${member.relationship && !knownRelations.includes(member.relationship) && member.relationship?'':'display:none'}">
            <label>حدد صلة القرابة</label>
            <input type="text" id="fRelationCustom" value="${member.relationship && !knownRelations.includes(member.relationship)?member.relationship:''}" placeholder="اكتب صلة القرابة...">
        </div>` : '';

    document.getElementById('mainContent').innerHTML = `
        <div class="card" style="max-width:700px">
            <h3 style="margin-bottom:20px"><i class="fas fa-user-edit"></i> ${isEdit?'تعديل بيانات':'إضافة'} ${getRoleLabel(role)}</h3>
            <form id="memberForm">
                <div style="text-align:center;margin-bottom:20px">
                    <div class="photo-upload" id="photoUpload" onclick="document.getElementById('photoInput').click()">
                        ${member.photo?`<img src="${member.photo}" id="photoPreview">`:'<i class="fas fa-camera"></i><span>صورة</span>'}
                        <input type="file" id="photoInput" accept="image/*">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>الاسم الكامل *</label><input type="text" id="fName" value="${member.fullName||''}" required></div>
                    <div class="form-group"><label>رقم الهوية</label><input type="text" id="fNatId" value="${member.nationalId||''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>الجنس *</label><select id="fGender" required><option value="">اختر</option><option value="male" ${member.gender==='male'?'selected':''}>ذكر</option><option value="female" ${member.gender==='female'?'selected':''}>أنثى</option></select></div>
                    <div class="form-group"><label>تاريخ الميلاد</label><input type="date" id="fBirth" value="${member.birthDate||''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>الحالة الاجتماعية</label><select id="fMarital"><option value="">اختر</option><option value="single" ${member.maritalStatus==='single'?'selected':''}>أعزب/عزباء</option><option value="married" ${member.maritalStatus==='married'?'selected':''}>متزوج/ة</option><option value="divorced" ${member.maritalStatus==='divorced'?'selected':''}>مطلق/ة</option><option value="widowed" ${member.maritalStatus==='widowed'?'selected':''}>أرمل/ة</option><option value="separated" ${member.maritalStatus==='separated'?'selected':''}>منفصل/ة</option></select></div>
                    <div class="form-group"><label>اسم الأم</label><input type="text" id="fMother" value="${member.motherName||''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>لقب العائلة (الفرع)</label><input type="text" id="fFamilyName" value="${member.familyName||''}"></div>
                    ${relationOptions}
                </div>
                <div class="form-row">
                    <div class="form-group"><label>العنوان</label><input type="text" id="fAddress" value="${member.address||''}"></div>
                    <div class="form-group"><label>رقم الجوال</label><input type="text" id="fPhone" value="${member.phone||''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>تاريخ الوفاة</label><input type="date" id="fDeath" value="${member.deathDate||''}"></div>
                    <div class="form-group"></div>
                </div>
                <div class="form-group"><label>ملاحظات</label><textarea id="fNotes">${member.notes||''}</textarea></div>
                <div class="btn-group">
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ</button>
                    <button type="button" class="btn btn-outline" onclick="${guestMode?'backToGuest()':`navigate(${familyId&&role!=='head'?`'family-detail',{headId:${familyId}}`:`'dashboard'`})`}">إلغاء</button>
                </div>
            </form>
        </div>`;

    // Photo handler
    document.getElementById('photoInput').addEventListener('change', function(e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const pu = document.getElementById('photoUpload');
            pu.innerHTML = `<img src="${ev.target.result}" id="photoPreview"><input type="file" id="photoInput" accept="image/*">`;
        };
        reader.readAsDataURL(file);
    });

    // Form submit
    document.getElementById('memberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const preview = document.getElementById('photoPreview');
        let relationship = '';
        if (role === 'child') {
            const sel = document.getElementById('fRelation');
            relationship = sel.value === 'other' ? (document.getElementById('fRelationCustom')?.value.trim()||'') : sel.value;
        }
        const data = {
            fullName: document.getElementById('fName').value.trim(),
            nationalId: document.getElementById('fNatId').value.trim(),
            gender: document.getElementById('fGender').value,
            birthDate: document.getElementById('fBirth').value,
            maritalStatus: document.getElementById('fMarital').value,
            motherName: document.getElementById('fMother').value.trim(),
            familyName: document.getElementById('fFamilyName').value.trim(),
            address: document.getElementById('fAddress').value.trim(),
            phone: document.getElementById('fPhone').value.trim(),
            deathDate: document.getElementById('fDeath').value,
            notes: document.getElementById('fNotes').value.trim(),
            photo: preview ? preview.src : (member.photo || ''),
            role: role,
            relationship: relationship
        };

        if (data.nationalId) {
            const exists = await db.isNationalIdExists(data.nationalId, isEdit ? member.id : null);
            if (exists) { showToast('رقم الهوية موجود مسبقاً', 'error'); return; }
        }

        try {
            if (isEdit) {
                await db.updateMember(member.id, data);
                showToast('تم التحديث بنجاح');
            } else {
                if (role === 'head') {
                    const newId = await db.addMember({...data, familyId: 0});
                    await db.updateMember(newId, {familyId: newId});
                } else {
                    await db.addMember({...data, familyId: familyId});
                }
                showToast('تمت الإضافة بنجاح');
            }
            if (guestMode) {
                backToGuest();
            } else {
                navigate(familyId && role !== 'head' ? 'family-detail' : 'dashboard', familyId && role !== 'head' ? {headId: familyId} : {});
            }
        } catch(err) { showToast('حدث خطأ: ' + err.message, 'error'); }
    });
}

function toggleCustomRelation(sel) {
    const g = document.getElementById('customRelationGroup');
    g.style.display = sel.value === 'other' ? '' : 'none';
}

// ===== ALL MEMBERS (with filters) =====
async function renderAllMembers() {
    const all = await db.getAllMembers();
    const heads = await db.getAllHeads();

    // Group by family, sort members by age within each family
    let grouped = [];
    for (const h of heads) {
        grouped.push(h);
        const familyMembers = all.filter(m => m.familyId === h.id && m.role !== 'head')
            .sort((a, b) => sortByAge(a, b));
        grouped.push(...familyMembers);
    }
    // Orphan members
    const allIds = grouped.map(m => m.id);
    const orphans = all.filter(m => !allIds.includes(m.id));
    grouped.push(...orphans);

    window._allMembersData = grouped;

    let html = `<div class="section"><div class="section-header"><h3 class="section-title"><i class="fas fa-users"></i> جميع الأفراد (${all.length})</h3>
        <div class="btn-group no-print">
            <button class="btn btn-primary btn-sm" onclick="navigate('add-member',{role:'head'})"><i class="fas fa-plus"></i> إضافة أسرة</button>
            <button class="btn btn-outline btn-sm" onclick="window.print()"><i class="fas fa-print"></i> طباعة</button>
            <button class="btn btn-success btn-sm" onclick="exportFilteredToExcel()"><i class="fas fa-file-excel"></i> تصدير Excel</button>
        </div></div>
        <div class="filter-bar no-print">
            <div class="filter-group"><label>العمر من</label><input type="number" id="filterAgeFrom" min="0" placeholder="من" style="width:80px" oninput="applyFilters()"></div>
            <div class="filter-group"><label>إلى</label><input type="number" id="filterAgeTo" min="0" placeholder="إلى" style="width:80px" oninput="applyFilters()"></div>
            <div class="filter-group"><label>الحالة الاجتماعية</label>
                <select id="filterMarital" onchange="applyFilters()"><option value="">الكل</option><option value="single">أعزب/عزباء</option><option value="married">متزوج/ة</option><option value="divorced">مطلق/ة</option><option value="widowed">أرمل/ة</option><option value="separated">منفصل/ة</option></select>
            </div>
            <div class="filter-group"><label>الجنس</label>
                <select id="filterGender" onchange="applyFilters()"><option value="">الكل</option><option value="male">ذكر</option><option value="female">أنثى</option></select>
            </div>
            <button class="btn btn-outline btn-sm" onclick="resetFilters()" style="align-self:flex-end"><i class="fas fa-times"></i> إعادة ضبط</button>
        </div>
        <div id="membersTableContainer"></div>
    </div>`;

    document.getElementById('mainContent').innerHTML = html;
    applyFilters();
}

function applyFilters() {
    const data = window._allMembersData || [];
    const ageFromVal = document.getElementById('filterAgeFrom')?.value;
    const ageToVal = document.getElementById('filterAgeTo')?.value;
    const ageFrom = ageFromVal !== '' && ageFromVal !== undefined ? parseInt(ageFromVal) : null;
    const ageTo = ageToVal !== '' && ageToVal !== undefined ? parseInt(ageToVal) : null;
    const marital = document.getElementById('filterMarital')?.value || '';
    const gender = document.getElementById('filterGender')?.value || '';
    const hasAgeFilter = ageFrom !== null || ageTo !== null;

    const filtered = data.filter(m => {
        const age = calculateAge(m.birthDate);
        if (hasAgeFilter) {
            if (age === '') return false;
            if (ageFrom !== null && age < ageFrom) return false;
            if (ageTo !== null && age > ageTo) return false;
        }
        if (marital && m.maritalStatus !== marital) return false;
        if (gender && m.gender !== gender) return false;
        return true;
    });

    window._filteredData = filtered;

    let html = '';
    if (!filtered.length) {
        html = '<div class="empty-state"><i class="fas fa-inbox"></i><h3>لا يوجد أفراد</h3></div>';
    } else {
        html = '<h3 class="print-header">قائمة جميع الأفراد</h3>';
        html += `<p class="filter-count no-print" style="color:var(--text-muted);margin-bottom:10px">عرض ${filtered.length} من ${data.length} فرد</p>`;
        html += '<div class="table-wrapper"><table><thead><tr><th>الاسم</th><th>الهوية</th><th>الجنس</th><th>الدور</th><th>صلة القرابة</th><th>العمر</th><th>الحالة</th><th>الفرع</th><th>الجوال</th></tr></thead><tbody>';
        for (const m of filtered) {
            html += `<tr style="cursor:pointer" onclick="${m.role==='head'?`navigate('family-detail',{headId:${m.id}})`:`navigate('edit-member',{memberId:${m.id}})`}" ${m.role==='head'?'class="head-row"':''}>
                <td>${m.fullName}</td><td>${m.nationalId||'-'}</td><td>${getGenderLabel(m.gender)}</td>
                <td><span class="badge ${m.role==='head'?'badge-primary':'badge-success'}">${getRoleLabel(m.role)}</span></td>
                <td>${m.relationship||'-'}</td><td>${formatAge(m.birthDate)}</td>
                <td>${getMaritalLabel(m.maritalStatus)}</td><td>${m.familyName||'-'}</td><td>${m.phone||'-'}</td></tr>`;
        }
        html += '</tbody></table></div>';
    }

    document.getElementById('membersTableContainer').innerHTML = html;
}

function resetFilters() {
    document.getElementById('filterAgeFrom').value = '';
    document.getElementById('filterAgeTo').value = '';
    document.getElementById('filterMarital').value = '';
    document.getElementById('filterGender').value = '';
    applyFilters();
}

async function exportFilteredToExcel() {
    const data = window._filteredData || window._allMembersData || [];
    if (!data.length) { showToast('لا توجد بيانات للتصدير', 'warning'); return; }

    const heads = await db.getAllHeads();
    const headMap = {};
    heads.forEach(h => { headMap[h.id] = h.nationalId; });

    const exportData = data.map(m => ({
        'الاسم': m.fullName, 'رقم الهوية': m.nationalId, 'الجنس': getGenderLabel(m.gender),
        'تاريخ الميلاد': m.birthDate, 'العمر': calculateAge(m.birthDate) !== '' ? calculateAge(m.birthDate) : '',
        'الحالة الاجتماعية': getMaritalLabel(m.maritalStatus), 'اسم الأم': m.motherName,
        'لقب العائلة': m.familyName, 'العنوان': m.address, 'الجوال': m.phone,
        'الدور': getRoleLabel(m.role), 'صلة القرابة': m.relationship,
        'هوية رب الأسرة': headMap[m.familyId] || m.nationalId,
        'تاريخ الوفاة': m.deathDate, 'ملاحظات': m.notes
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأفراد');
    XLSX.writeFile(wb, 'سجل_العائلة_مفلتر.xlsx');
    showToast('تم تصدير البيانات بنجاح');
}

// ===== SEARCH (with age) =====
async function renderSearch(query) {
    let html = `<div class="section"><div class="section-header"><h3 class="section-title"><i class="fas fa-search"></i> البحث</h3></div>
        <div class="form-group no-print"><input type="text" id="searchInput" placeholder="ابحث بالاسم أو رقم الهوية..." value="${query}" style="max-width:500px"></div>
        <div id="searchResults"></div></div>`;
    document.getElementById('mainContent').innerHTML = html;

    const input = document.getElementById('searchInput');
    input.focus();

    const doSearch = async () => {
        const q = input.value.trim();
        const resultsDiv = document.getElementById('searchResults');
        if (!q) { resultsDiv.innerHTML = ''; return; }
        const results = await db.search(q);
        if (!results.length) { resultsDiv.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><h3>لا توجد نتائج</h3></div>'; return; }

        let rhtml = `<div class="section-header"><p style="color:var(--text-muted)">تم العثور على ${results.length} نتيجة</p>
            <button class="btn btn-outline btn-sm no-print" onclick="window.print()"><i class="fas fa-print"></i> طباعة النتائج</button></div>
            <h3 class="print-header">نتائج البحث: ${q}</h3>
            <div class="table-wrapper"><table><thead><tr><th>الاسم</th><th>الهوية</th><th>الجنس</th><th>الدور</th><th>الفرع</th><th>العمر</th><th>الحالة</th><th>اسم الأم</th><th>الميلاد</th><th>العنوان</th><th>الجوال</th></tr></thead><tbody>`;
        for (const m of results) {
            rhtml += `<tr style="cursor:pointer" onclick="${m.role==='head'?`navigate('family-detail',{headId:${m.id}})`:`navigate('edit-member',{memberId:${m.id}})`}">
                <td>${m.fullName}</td><td>${m.nationalId||'-'}</td><td>${getGenderLabel(m.gender)}</td>
                <td><span class="badge ${m.role==='head'?'badge-primary':'badge-success'}">${getRoleLabel(m.role)}</span></td>
                <td>${m.familyName||'-'}</td><td>${formatAge(m.birthDate)}</td><td>${getMaritalLabel(m.maritalStatus)}</td><td>${m.motherName||'-'}</td>
                <td>${formatDate(m.birthDate)}</td><td>${m.address||'-'}</td><td>${m.phone||'-'}</td></tr>`;
        }
        rhtml += '</tbody></table></div>';
        resultsDiv.innerHTML = rhtml;
    };

    input.addEventListener('input', doSearch);
    if (query) doSearch();
}
