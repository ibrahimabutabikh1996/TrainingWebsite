import re

with open("app.js", "r", encoding="utf-8") as f:
    content = f.read()

# Replace openCourseBuilder to populate trainees
old_open_builder = """function openCourseBuilder() {
    const modal = document.getElementById('courseBuilderModal');
    const content = document.getElementById('courseBuilderContent');
    
    // Reset form
    document.getElementById('course-name').value = '';
    document.getElementById('course-desc').value = '';
    
    const container = document.getElementById('course-weeks-container');
    container.innerHTML = '<div class="text-center py-8 text-outline text-sm italic">اضغط على "إضافة أسبوع جديد" للبدء بتصميم الجدول</div>';
    courseWeeksCount = 0;

    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}"""

new_open_builder = """function openCourseBuilder() {
    const modal = document.getElementById('courseBuilderModal');
    const content = document.getElementById('courseBuilderContent');
    
    // Reset form
    document.getElementById('course-name').value = '';
    document.getElementById('course-desc').value = '';
    
    // Populate Trainees
    const traineeSelect = document.getElementById('course-trainee');
    traineeSelect.innerHTML = '<option class="bg-[var(--bg-color)] text-on-surface" value="">-- اختر المتدرب --</option>';
    
    for (const [id, profile] of Object.entries(profilesData || {})) {
        const pData = profile.data || {};
        const name = pData.fullname || profile.full_name || profile.username || 'بدون اسم';
        traineeSelect.innerHTML += `<option class="bg-[var(--bg-color)] text-on-surface" value="${id}">${name}</option>`;
    }
    
    const container = document.getElementById('course-weeks-container');
    container.innerHTML = '<div class="text-center py-8 text-outline text-sm italic">يرجى اختيار المتدرب ليتم توليد أيام التدريب تلقائياً</div>';
    courseWeeksCount = 0;

    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}

function onTraineeSelected(traineeId) {
    const container = document.getElementById('course-weeks-container');
    container.innerHTML = '';
    courseWeeksCount = 0;
    
    if (!traineeId) {
        container.innerHTML = '<div class="text-center py-8 text-outline text-sm italic">يرجى اختيار المتدرب ليتم توليد أيام التدريب تلقائياً</div>';
        return;
    }
    
    const profile = profilesData[traineeId];
    if (!profile) return;
    
    // Extract training days or default to 4
    let daysCount = 4;
    const pData = profile.data || {};
    // Let's check for common property names for training days
    if (pData.training_days) {
        daysCount = parseInt(pData.training_days) || 4;
    }
    
    // Generate 1 week with that many days
    addCourseWeek(daysCount);
}"""

content = content.replace(old_open_builder, new_open_builder)

# Replace addCourseWeek to accept daysCount
old_add_week = """function addCourseWeek() {
    courseWeeksCount++;
    const container = document.getElementById('course-weeks-container');
    
    // Remove empty state message if it exists
    if(courseWeeksCount === 1) {
        container.innerHTML = '';
    }

    const weekDiv = document.createElement('div');
    weekDiv.className = 'glass-child border border-separator rounded-xl p-4 transition-all';
    weekDiv.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h5 class="text-sm font-bold text-on-surface">الأسبوع ${courseWeeksCount}</h5>
            <div class="flex items-center gap-2">
                <button onclick="addCourseDay(this)" class="text-xs font-bold bg-[var(--color-success)]/10 text-[var(--color-success)] px-2 py-1 rounded hover:bg-[var(--color-success)]/20 transition-colors flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">add</span>
                    إضافة يوم
                </button>
                <button onclick="this.parentElement.parentElement.parentElement.remove();" class="text-xs font-bold text-outline hover:text-error transition-colors">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
            </div>
        </div>
        <div class="space-y-3 days-container pl-2 border-r-2 border-[var(--separator)] rtl:border-r-0 rtl:border-l-2 rtl:pr-2">
            <!-- Days will be added here -->
        </div>
    `;
    
    container.appendChild(weekDiv);
    // Add first day automatically
    addCourseDay(weekDiv.querySelector('button'));
}"""

new_add_week = """function addCourseWeek(daysToGenerate = 1) {
    courseWeeksCount++;
    const container = document.getElementById('course-weeks-container');
    
    // Remove empty state message if it exists
    if(container.querySelector('.italic')) {
        container.innerHTML = '';
    }

    const weekDiv = document.createElement('div');
    weekDiv.className = 'glass-child border border-separator rounded-xl p-4 transition-all mb-4';
    weekDiv.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h5 class="text-sm font-bold text-on-surface">الأسبوع ${courseWeeksCount}</h5>
            <div class="flex items-center gap-2">
                <button onclick="addCourseDay(this)" class="text-xs font-bold bg-[var(--color-success)]/10 text-[var(--color-success)] px-2 py-1 rounded hover:bg-[var(--color-success)]/20 transition-colors flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">add</span>
                    إضافة يوم
                </button>
                <button onclick="this.parentElement.parentElement.parentElement.remove();" class="text-xs font-bold text-outline hover:text-error transition-colors">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
            </div>
        </div>
        <div class="space-y-3 days-container pl-2 border-r-2 border-[var(--separator)] rtl:border-r-0 rtl:border-l-2 rtl:pr-2">
            <!-- Days will be added here -->
        </div>
    `;
    
    container.appendChild(weekDiv);
    
    // Generate specified number of days
    const daysContainer = weekDiv.querySelector('.days-container');
    const btn = weekDiv.querySelector('button');
    if(typeof daysToGenerate === 'object') daysToGenerate = 1; // if called by click event
    for(let i=0; i<daysToGenerate; i++){
        addCourseDay(btn);
    }
}"""

content = content.replace(old_add_week, new_add_week)

# Replace addCourseDay
old_add_day = """function addCourseDay(btnElement) {
    const daysContainer = btnElement.closest('.glass-child').querySelector('.days-container');
    const dayCount = daysContainer.children.length + 1;
    
    const dayDiv = document.createElement('div');
    dayDiv.className = 'bg-[var(--bg-color)] border border-separator rounded-lg p-3 relative group';
    dayDiv.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <input type="text" class="text-xs font-bold text-on-surface bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] rounded px-1 w-32" value="اليوم ${dayCount}" placeholder="اسم اليوم...">
            <div class="flex items-center gap-2">
                <button onclick="alert('سيتم فتح نافذة لاختيار تمرين من قاعدة التمارين')" class="text-[10px] font-bold bg-[var(--color-primary)] text-white px-2 py-1 rounded shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">fitness_center</span>
                    إضافة تمرين
                </button>
                <button onclick="this.closest('.relative').remove()" class="text-outline hover:text-error opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
            </div>
        </div>
        <div class="exercises-list space-y-2">
            <div class="text-[10px] text-outline text-center py-2 italic border border-dashed border-separator rounded">لا يوجد تمارين مضافة لهذا اليوم</div>
        </div>
    `;
    daysContainer.appendChild(dayDiv);
}"""

new_add_day = """function addCourseDay(btnElement) {
    const daysContainer = btnElement.closest('.glass-child').querySelector('.days-container');
    const dayCount = daysContainer.children.length + 1;
    
    // Generate a unique ID for this day container so we know where to append exercises
    const dayId = 'day-' + Math.random().toString(36).substr(2, 9);
    
    const dayDiv = document.createElement('div');
    dayDiv.className = 'bg-[var(--bg-color)] border border-separator rounded-lg p-3 relative group';
    dayDiv.id = dayId;
    dayDiv.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <input type="text" class="text-xs font-bold text-on-surface bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] rounded px-1 w-32" value="اليوم ${dayCount}" placeholder="اسم اليوم...">
            <div class="flex items-center gap-2">
                <button onclick="openExerciseSelectionModal('${dayId}')" class="text-[10px] font-bold bg-[var(--color-primary)] text-[var(--bg-color)] px-2 py-1 rounded shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">fitness_center</span>
                    إضافة تمرين
                </button>
                <button onclick="this.closest('.group').remove()" class="text-outline hover:text-error transition-colors bg-[var(--hover-bg)] rounded-full p-1">
                    <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
            </div>
        </div>
        <div class="exercises-list space-y-2">
            <div class="empty-state text-[10px] text-outline text-center py-2 italic border border-dashed border-separator rounded">لا يوجد تمارين مضافة لهذا اليوم</div>
        </div>
    `;
    daysContainer.appendChild(dayDiv);
}

// Global variable to keep track of which day we are adding an exercise to
let currentTargetDayId = null;

function openExerciseSelectionModal(dayId) {
    currentTargetDayId = dayId;
    const modal = document.getElementById('exerciseSelectionModal');
    const content = document.getElementById('exerciseSelectionContent');
    
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
    
    renderModalExercises();
}

function closeExerciseSelectionModal() {
    const modal = document.getElementById('exerciseSelectionModal');
    const content = document.getElementById('exerciseSelectionContent');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
}

function renderModalExercises(query = '') {
    const grid = document.getElementById('modal-exercises-grid');
    grid.innerHTML = '';
    
    const searchTerm = query.toLowerCase().trim();
    
    let filtered = exercisesData;
    if (searchTerm !== '') {
        filtered = exercisesData.filter(ex => {
            const exData = ex.data || {};
            const nameAr = (exData.name_ar || '').toLowerCase();
            const nameEn = (exData.name_en || '').toLowerCase();
            const targetMuscle = (exData.target_muscle || '').toLowerCase();
            return nameAr.includes(searchTerm) || nameEn.includes(searchTerm) || targetMuscle.includes(searchTerm);
        });
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-8 text-center text-outline text-sm">لا توجد تمارين مطابقة للبحث</div>';
        return;
    }
    
    filtered.forEach(ex => {
        const exData = ex.data || {};
        const nameAr = exData.name_ar || 'تمرين بدون اسم';
        const targetMuscle = exData.target_muscle || 'عام';
        const mediaUrl = getMediaUrl(exData);
        
        // Use muscle icon mapping
        let defaultIcon = 'assets/icons/general.png';
        if (targetMuscle === 'صدر') defaultIcon = 'assets/muscles/chest.png';
        else if (targetMuscle === 'ظهر' || targetMuscle === 'ترابيس' || targetMuscle === 'قطنية') defaultIcon = 'assets/muscles/back.png';
        else if (targetMuscle === 'أكتاف' || targetMuscle === 'أكتاف خلفية') defaultIcon = 'assets/muscles/shoulders.png';
        else if (targetMuscle === 'بايسبس') defaultIcon = 'assets/muscles/biceps.png';
        else if (targetMuscle === 'ترايسبس') defaultIcon = 'assets/muscles/triceps.png';
        else if (targetMuscle === 'سواعد') defaultIcon = 'assets/muscles/forearms.png';
        else if (targetMuscle === 'بطن' || targetMuscle === 'جوانب البطن') defaultIcon = 'assets/muscles/abs.png';
        else if (targetMuscle === 'أفخاذ أمامية' || targetMuscle === 'أفخاذ خلفية' || targetMuscle === 'أرداف') defaultIcon = 'assets/muscles/legs.png';
        else if (targetMuscle === 'سمانة') defaultIcon = 'assets/muscles/calves.png';
        
        let visualHtml = '';
        if (mediaUrl) {
            if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
                const vidId = extractYouTubeID(mediaUrl);
                if (vidId) {
                    visualHtml = `<img src="https://img.youtube.com/vi/${vidId}/0.jpg" class="w-full h-full object-cover" onerror="this.src='${defaultIcon}'; this.className='w-1/2 h-1/2 object-contain opacity-50'">`;
                } else {
                    visualHtml = `<img src="${defaultIcon}" class="w-1/2 h-1/2 object-contain opacity-50">`;
                }
            } else {
                visualHtml = `<img src="${mediaUrl}" class="w-full h-full object-cover">`;
            }
        } else {
            visualHtml = `<img src="${defaultIcon}" class="w-1/2 h-1/2 object-contain opacity-50">`;
        }

        const div = document.createElement('div');
        div.className = 'glass-child border border-separator rounded-xl overflow-hidden cursor-pointer hover:border-[var(--color-primary)] hover:shadow-[0_0_15px_rgba(0,90,194,0.15)] transition-all flex flex-col group';
        // When clicked, add to the day!
        div.onclick = () => addExerciseToDay(currentTargetDayId, ex);
        
        div.innerHTML = `
            <div class="h-24 bg-surface-variant/50 relative flex items-center justify-center shrink-0">
                ${visualHtml}
                <div class="absolute inset-0 bg-[var(--color-primary)]/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span class="material-symbols-outlined text-white text-2xl drop-shadow-md">add_circle</span>
                </div>
            </div>
            <div class="p-2 flex-1 flex flex-col justify-between">
                <h5 class="text-xs font-bold text-on-surface line-clamp-2 leading-snug mb-1">${nameAr}</h5>
                <span class="text-[9px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-1.5 py-0.5 rounded-md inline-block w-fit">${targetMuscle}</span>
            </div>
        `;
        
        grid.appendChild(div);
    });
}

function filterModalExercises() {
    const input = document.getElementById('modalSearchExercise');
    renderModalExercises(input.value);
}

function addExerciseToDay(dayId, exerciseObj) {
    if (!dayId) return;
    const dayContainer = document.getElementById(dayId);
    if (!dayContainer) return;
    
    const exercisesList = dayContainer.querySelector('.exercises-list');
    const emptyState = exercisesList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const exData = exerciseObj.data || {};
    const nameAr = exData.name_ar || 'تمرين';
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex items-center justify-between bg-surface-variant/30 border border-separator rounded-lg p-2 group/item';
    
    itemDiv.innerHTML = `
        <div class="flex items-center gap-2 flex-1">
            <div class="w-8 h-8 rounded bg-surface-variant flex items-center justify-center shrink-0 overflow-hidden">
                <span class="material-symbols-outlined text-outline text-[16px]">fitness_center</span>
            </div>
            <span class="text-xs font-bold text-on-surface line-clamp-1 flex-1 pr-1" title="${nameAr}">${nameAr}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0 ltr:pl-2 rtl:pr-2">
            <div class="flex items-center gap-1">
                <label class="text-[10px] text-outline">جولات:</label>
                <input type="number" min="1" value="3" class="w-12 bg-[var(--bg-color)] border border-separator rounded text-xs text-center py-1 text-on-surface focus:outline-none focus:border-[var(--color-primary)]">
            </div>
            <div class="flex items-center gap-1">
                <label class="text-[10px] text-outline">تكرارات:</label>
                <input type="text" value="10-12" class="w-16 bg-[var(--bg-color)] border border-separator rounded text-xs text-center py-1 text-on-surface focus:outline-none focus:border-[var(--color-primary)]">
            </div>
            <button onclick="this.closest('.group\\\\/item').remove(); if(document.getElementById('${dayId}').querySelectorAll('.group\\\\/item').length === 0) document.getElementById('${dayId}').querySelector('.exercises-list').innerHTML = '<div class=\\'empty-state text-[10px] text-outline text-center py-2 italic border border-dashed border-separator rounded\\'>لا يوجد تمارين مضافة لهذا اليوم</div>';" class="text-outline hover:text-error transition-colors p-1">
                <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
        </div>
    `;
    
    exercisesList.appendChild(itemDiv);
    
    // Close modal after adding
    closeExerciseSelectionModal();
}
"""

content = content.replace(old_add_day, new_add_day)

with open("app.js", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated app.js")
