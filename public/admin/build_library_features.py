import re

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# 1. Update fetchCourses to also get counts
new_fetch = """
window.fetchCourses = async function() {
    try {
        const { data, error } = await supabaseClient
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        allCourses = data || [];
        
        // Fetch active assignments count
        const { data: assignments, error: assignError } = await supabaseClient
            .from('client_courses')
            .select('course_id')
            .eq('is_active', true);
            
        window.courseActiveCounts = {};
        if (!assignError && assignments) {
            assignments.forEach(a => {
                window.courseActiveCounts[a.course_id] = (window.courseActiveCounts[a.course_id] || 0) + 1;
            });
        }
        
        renderCourses();
    } catch (err) {
        console.error('Error fetching courses:', err);
    }
}
"""
js = re.sub(r'window\.fetchCourses = async function\(\) \{.*?(?=window\.renderCourses = function\(\))', new_fetch, js, flags=re.DOTALL)

# 2. Update renderCourses HTML
# Find the card innerHTML injection and replace it.
card_old = r'<div class="flex flex-col gap-1 text-sm text-outline">.*?<div class="mt-auto pt-4 border-t border-separator flex justify-between relative z-10">'
card_new = """<div class="flex flex-col gap-1 text-sm text-outline">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[16px]">calendar_month</span>
                        <span>${daysCount} ${currentLang === 'ar' ? 'أيام تدريبية' : 'Training Days'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[16px]">group</span>
                        <span>${window.courseActiveCounts[course.id] || 0} ${currentLang === 'ar' ? 'متدربين نشطين' : 'Active Trainees'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[16px]">schedule</span>
                        <span dir="ltr">${dateStr}</span>
                    </div>
                </div>
            </div>
            
            <div class="mt-auto pt-4 border-t border-separator flex justify-between relative z-10">"""
js = re.sub(card_old, card_new, js, flags=re.DOTALL)

buttons_old = r'<!-- Assign Button \(Placeholder\) -->.*?</div>\s*</div>\s*`;'
buttons_new = """<button onclick="openAssignModal('${course.id}')" class="text-[var(--primary-color)] hover:text-white flex items-center gap-1 text-sm transition-colors" title="${currentLang === 'ar' ? 'إسناد لمتدرب' : 'Assign to Client'}">
                    <span class="material-symbols-outlined text-[18px]">person_add</span>
                    <span>${currentLang === 'ar' ? 'إسناد' : 'Assign'}</span>
                </button>
                
                <div class="flex gap-2">
                    <button onclick="editCourse('${course.id}')" class="text-outline hover:text-[var(--primary-color)] transition-colors p-1" title="${currentLang === 'ar' ? 'تعديل' : 'Edit'}">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onclick="deleteCourse('${course.id}')" class="text-outline hover:text-error transition-colors p-1" title="${currentLang === 'ar' ? 'حذف' : 'Delete'}">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </div>
        `;"""
js = re.sub(buttons_old, buttons_new, js, flags=re.DOTALL)

# 3. Add assign and edit functions
extra_funcs = """
window.editingCourseId = null;
window.currentCourseAssignId = null;

window.openAssignModal = async function(courseId) {
    window.currentCourseAssignId = courseId;
    const modal = document.getElementById('assignModal');
    const list = document.getElementById('assignClientsList');
    list.innerHTML = '<div class="text-center text-outline text-sm">جاري التحميل...</div>';
    
    // Show modal
    modal.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        document.getElementById('assignModalContent').classList.remove('scale-95');
        document.getElementById('assignModalContent').classList.add('scale-100');
    }, 10);
    
    try {
        // Fetch active assignments for this course
        const { data: assignments } = await supabaseClient
            .from('client_courses')
            .select('client_id')
            .eq('course_id', courseId)
            .eq('is_active', true);
            
        const activeIds = assignments ? assignments.map(a => a.client_id) : [];
        
        // Build list
        list.innerHTML = '';
        const clients = Object.values(profilesData).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        
        if (clients.length === 0) {
            list.innerHTML = '<div class="text-center text-outline text-sm">لا يوجد متدربين حالياً.</div>';
            return;
        }
        
        clients.forEach(c => {
            const name = (c.data && c.data.fullname) || c.full_name || c.username || 'بدون اسم';
            const isChecked = activeIds.includes(c.id) ? 'checked' : '';
            
            list.innerHTML += `
                <label class="flex items-center justify-between p-3 rounded-lg border border-separator hover:bg-[var(--hover-bg)] cursor-pointer transition-colors">
                    <span class="text-on-surface text-sm font-medium">${name}</span>
                    <input type="checkbox" value="${c.id}" class="client-assign-cb w-5 h-5 accent-[var(--primary-color)] rounded border-separator" ${isChecked}>
                </label>
            `;
        });
        
    } catch (err) {
        console.error('Error opening assign modal:', err);
        list.innerHTML = '<div class="text-error text-sm text-center">حدث خطأ في جلب البيانات.</div>';
    }
}

window.closeAssignModal = function() {
    const modal = document.getElementById('assignModal');
    document.getElementById('assignModalContent').classList.remove('scale-100');
    document.getElementById('assignModalContent').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        window.currentCourseAssignId = null;
    }, 300);
}

window.saveAssignments = async function() {
    if (!window.currentCourseAssignId) return;
    
    const checkboxes = document.querySelectorAll('.client-assign-cb');
    const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const allIds = Array.from(checkboxes).map(cb => cb.value);
    const unselectedIds = allIds.filter(id => !selectedIds.includes(id));
    
    try {
        const btn = document.querySelector('#assignModalContent button:last-child');
        const oldText = btn.innerHTML;
        btn.innerHTML = 'جاري الحفظ...';
        btn.disabled = true;
        
        // 1. Deactivate this course for unselected clients
        if (unselectedIds.length > 0) {
            await supabaseClient.from('client_courses')
                .update({ is_active: false })
                .eq('course_id', window.currentCourseAssignId)
                .eq('is_active', true)
                .in('client_id', unselectedIds);
        }
        
        // 2. For selected clients, we need to check if they already have it active
        const { data: existing } = await supabaseClient.from('client_courses')
            .select('client_id')
            .eq('course_id', window.currentCourseAssignId)
            .eq('is_active', true)
            .in('client_id', selectedIds);
            
        const existingIds = existing ? existing.map(e => e.client_id) : [];
        const newIds = selectedIds.filter(id => !existingIds.includes(id));
        
        if (newIds.length > 0) {
            // Deactivate their other active courses
            for (const cId of newIds) {
                await supabaseClient.from('client_courses')
                    .update({ is_active: false })
                    .eq('client_id', cId)
                    .eq('is_active', true);
                    
                // Insert new assignment
                await supabaseClient.from('client_courses')
                    .insert([{
                        client_id: cId,
                        course_id: window.currentCourseAssignId,
                        is_active: true
                    }]);
                    
                // Update profile current_course_id
                await supabaseClient.from('profiles')
                    .update({ current_course_id: window.currentCourseAssignId })
                    .eq('id', cId);
            }
        }
        
        btn.innerHTML = oldText;
        btn.disabled = false;
        closeAssignModal();
        fetchCourses(); // refresh counts
        alert(currentLang === 'ar' ? 'تم حفظ الإسناد بنجاح!' : 'Assignments saved successfully!');
        
    } catch (err) {
        console.error('Error saving assignments:', err);
        alert('Error saving assignments.');
    }
}

window.editCourse = function(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    
    window.editingCourseId = course.id;
    
    // Switch to create course view
    switchView('create-course');
    
    // Populate simple fields
    document.getElementById('courseNameInput').value = course.name;
    
    const preview = document.getElementById('courseCoverPreview');
    if (course.cover_image) {
        preview.src = course.cover_image;
        preview.classList.remove('hidden');
    } else {
        preview.src = '';
        preview.classList.add('hidden');
    }
    
    // Clear existing days
    document.getElementById('courseDaysContainer').innerHTML = '';
    window.courseDaysCount = 0;
    
    // Populate days and exercises
    const daysData = course.days_data || [];
    daysData.forEach((dayObj, dIndex) => {
        addCourseDay(); // Creates Day element
        
        const dayDiv = document.querySelectorAll('#courseDaysContainer > div')[dIndex];
        const dayExContainer = dayDiv.querySelector('.day-exercises');
        
        dayObj.exercises.forEach(exObj => {
            // We need to inject the exercise HTML. It's similar to addExerciseToDay logic.
            // But we already have the DOM structure function inside addExerciseToDay, which requires an ID.
            // Since we have custom sets/reps, we will just build the HTML directly here.
            
            const exDiv = document.createElement('div');
            exDiv.className = 'flex flex-col gap-3 p-3 bg-[var(--bg-color)] rounded-xl border border-separator mb-3';
            
            // Header
            let headerHtml = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-[var(--error-color)] cursor-pointer hover:bg-[var(--error-color)]/10 rounded-full p-1" onclick="this.closest('.flex-col.gap-3').remove()">delete</span>
                        <h5 class="text-sm font-bold text-on-surface">${exObj.name}</h5>
                    </div>
                    <span class="text-[10px] px-2 py-1 rounded-full bg-[var(--surface-color)] text-outline border border-separator">${exObj.category}</span>
                </div>
            `;
            
            let contentHtml = '';
            if (exObj.category === 'مقاومة' || exObj.category === 'Resistance') {
                contentHtml += `<div id="sets-container-${Math.random()}" class="flex flex-col gap-2">`;
                (exObj.sets || []).forEach((setObj, sIndex) => {
                    contentHtml += `
                        <div class="set-row flex items-center gap-2 text-xs">
                            <span class="text-outline w-6">ج ${sIndex + 1}</span>
                            <div class="flex-1 flex flex-col gap-1">
                                <label class="text-[10px] text-outline">عدات</label>
                                <input type="number" class="w-full bg-[var(--surface-color)] border border-separator rounded p-1 text-center text-on-surface" value="${setObj.reps}">
                            </div>
                            <div class="flex-1 flex flex-col gap-1">
                                <label class="text-[10px] text-outline">راحة (ث)</label>
                                <input type="number" class="w-full bg-[var(--surface-color)] border border-separator rounded p-1 text-center text-on-surface" value="${setObj.rest}">
                            </div>
                            <div class="flex-[2] flex flex-col gap-1">
                                <label class="text-[10px] text-outline">وزن / ملاحظة</label>
                                <input type="text" class="w-full bg-[var(--surface-color)] border border-separator rounded p-1 text-on-surface" value="${setObj.note || ''}">
                            </div>
                            <span class="material-symbols-outlined text-error cursor-pointer text-[14px] mt-4" onclick="this.closest('.set-row').remove()">close</span>
                        </div>
                    `;
                });
                contentHtml += `</div>
                <button onclick="window.addSetToExercise(this)" class="text-[10px] text-[var(--primary-color)] hover:underline self-start mt-1">+ جلسة إضافية</button>`;
            } else {
                contentHtml = `
                    <div class="flex items-center gap-2 text-xs">
                        <div class="flex-1 flex flex-col gap-1">
                            <label class="text-[10px] text-outline">Time (mins)</label>
                            <input type="number" class="w-full bg-[var(--surface-color)] border border-separator rounded p-1 text-center text-on-surface" value="${exObj.time || ''}">
                        </div>
                        <div class="flex-[2] flex flex-col gap-1">
                            <label class="text-[10px] text-outline">Note</label>
                            <input type="text" class="w-full bg-[var(--surface-color)] border border-separator rounded p-1 text-on-surface" value="${exObj.note || ''}">
                        </div>
                    </div>
                `;
            }
            
            exDiv.innerHTML = headerHtml + contentHtml;
            dayExContainer.appendChild(exDiv);
        });
    });
    
    // Change save button text
    const saveBtn = document.querySelector('#create-course-view button[onclick="saveCourse()"]');
    if (saveBtn) {
        saveBtn.innerHTML = `<span class="material-symbols-outlined">save</span> ${currentLang === 'ar' ? 'تحديث الكورس' : 'Update Course'}`;
    }
}
"""

if 'window.openAssignModal =' not in js:
    js += "\n" + extra_funcs

# 4. Modify saveCourse to handle UPDATE
# Find the insert block
insert_old = r"""const { data: courseData, error: courseError } = await supabaseClient
            \.from\('courses'\)
            \.insert\(\[payload\]\)
            \.select\(\);"""

insert_new = """let courseData, courseError;
        
        if (window.editingCourseId) {
            const res = await supabaseClient
                .from('courses')
                .update(payload)
                .eq('id', window.editingCourseId)
                .select();
            courseData = res.data;
            courseError = res.error;
        } else {
            const res = await supabaseClient
                .from('courses')
                .insert([payload])
                .select();
            courseData = res.data;
            courseError = res.error;
        }"""
js = re.sub(insert_old, insert_new, js, flags=re.DOTALL)

# Find the clear form part of saveCourse to reset editingCourseId and save button text
clear_old = r"courseDaysCount = 0;\s*addCourseDay\(\); // Add day 1 back"
clear_new = """courseDaysCount = 0;
        addCourseDay(); // Add day 1 back
        window.editingCourseId = null;
        const saveBtn = document.querySelector('#create-course-view button[onclick="saveCourse()"]');
        if (saveBtn) saveBtn.innerHTML = `<span class="material-symbols-outlined">save</span> ${currentLang === 'ar' ? 'حفظ الكورس' : 'Save Course'}`;"""
js = re.sub(clear_old, clear_new, js)


with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)
print("Updated app.js with library features")

