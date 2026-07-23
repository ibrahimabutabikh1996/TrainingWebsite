import re

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# Add translation keys
ar_adds = """        course_client: "المتدرب (اختياري)",
        general_course: "-- كورس عام / بدون متدرب --",
        course_name_label: "اسم الكورس *",
        course_name_ph: "تضخيم 4 أسابيع",
        training_schedule: "جدول التدريب",
        add_day: "إضافة يوم",
        save_course: "حفظ الكورس",
        exercises_library_mini: "مكتبة التمارين",
        mini_search_ph: "ابحث...",
"""
en_adds = """        course_client: "Client (Optional)",
        general_course: "-- General Course / No Client --",
        course_name_label: "Course Name *",
        course_name_ph: "4 Weeks Bulking",
        training_schedule: "Training Schedule",
        add_day: "Add Day",
        save_course: "Save Course",
        exercises_library_mini: "Exercises Library",
        mini_search_ph: "Search...",
"""

js = js.replace('        no_courses_yet: "لا توجد كورسات في المكتبة حتى الآن.",', '        no_courses_yet: "لا توجد كورسات في المكتبة حتى الآن.",\n' + ar_adds)
js = js.replace('        no_courses_yet: "No courses in the library yet.",', '        no_courses_yet: "No courses in the library yet.",\n' + en_adds)

# Update fetchClients to call populateClientDropdown()
if 'populateClientDropdown();' not in js:
    js = js.replace('renderClients();', 'renderClients();\n        populateClientDropdown();')

# Update fetchExercises to call renderMiniExercises()
if 'renderMiniExercises();' not in js:
    js = js.replace('window.renderExercises();', 'window.renderExercises();\n        renderMiniExercises();')

# Append new logic
course_logic = """
// ==========================================
// Course Builder Logic
// ==========================================
let courseDaysCount = 0;
let currentActiveDayId = null;

function populateClientDropdown() {
    const select = document.getElementById('courseClientSelect');
    if (!select) return;
    
    // Keep the first option
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);
    
    const clients = Object.values(profilesData).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.className = 'bg-[var(--bg-color)] text-on-surface';
        opt.innerText = c.full_name || 'بدون اسم';
        select.appendChild(opt);
    });
}

window.renderMiniExercises = function() {
    const grid = document.getElementById('mini-exercises-grid');
    if (!grid) return;
    
    const searchQuery = document.getElementById('miniExSearch')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('miniExCategory')?.value || 'الكل';
    
    grid.innerHTML = '';
    const exercises = Object.values(exercisesData);
    
    if (exercises.length === 0) {
        grid.innerHTML = `<div class="py-8 text-center text-outline text-sm">${currentLang === "ar" ? "لا توجد تمارين." : "No exercises."}</div>`;
        return;
    }
    
    const filteredExercises = exercises.filter(ex => {
        const nameArMatch = ex.name_ar && ex.name_ar.toLowerCase().includes(searchQuery);
        const nameEnMatch = ex.name_en && ex.name_en.toLowerCase().includes(searchQuery);
        const matchesSearch = nameArMatch || nameEnMatch;
        const matchesCategory = categoryFilter === 'الكل' || ex.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
    
    if (filteredExercises.length === 0) {
        grid.innerHTML = `<div class="py-8 text-center text-outline text-sm">${currentLang === "ar" ? "لا يوجد تطابق." : "No matches."}</div>`;
        return;
    }
    
    filteredExercises.forEach(ex => {
        const card = document.createElement('div');
        card.className = "glass-child p-3 rounded-xl border border-separator hover:border-[var(--color-primary)]/50 transition-colors flex items-center justify-between gap-2";
        
        const iconHTML = getMuscleIcon(ex.target_muscle);
        
        card.innerHTML = `
            <div class="flex items-center gap-3">
                ${iconHTML ? `<div class="bg-[var(--hover-bg)] rounded-lg p-1.5 flex items-center justify-center border border-separator shadow-inner scale-75">${iconHTML}</div>` : ''}
                <div>
                    <h4 class="font-bold text-on-surface text-sm">${currentLang === 'ar' ? ex.name_ar : (ex.name_en || ex.name_ar)}</h4>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--hover-bg)] text-outline inline-block mt-1">${ex.category}</span>
                </div>
            </div>
            <button onclick="addExerciseToDay('${ex.id}')" class="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--bg-color)] transition-colors flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
        `;
        grid.appendChild(card);
    });
}

window.addCourseDay = function() {
    courseDaysCount++;
    const dayId = 'day-' + courseDaysCount;
    const container = document.getElementById('courseDaysContainer');
    
    const dayDiv = document.createElement('div');
    dayDiv.id = dayId;
    dayDiv.className = "border border-separator rounded-xl p-4 bg-[var(--bg-color)]/30 transition-colors";
    
    dayDiv.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h4 class="font-bold text-on-surface text-md flex items-center gap-2">
                <span class="material-symbols-outlined text-outline">calendar_today</span>
                <span>${currentLang === 'ar' ? 'اليوم ' + courseDaysCount : 'Day ' + courseDaysCount}</span>
            </h4>
            <div class="flex items-center gap-2">
                <input type="radio" name="activeCourseDay" value="${dayId}" ${courseDaysCount === 1 ? 'checked' : ''} onchange="setActiveDay('${dayId}')" class="accent-[var(--color-primary)] cursor-pointer w-4 h-4">
                <label class="text-xs text-outline cursor-pointer" onclick="document.querySelector('input[value=\\'${dayId}\\']').click()">${currentLang === 'ar' ? 'تحديد' : 'Select'}</label>
                <button onclick="document.getElementById('${dayId}').remove()" class="text-error hover:opacity-80 ltr:ml-4 rtl:mr-4">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
            </div>
        </div>
        <div class="day-exercises flex flex-col gap-2 min-h-[50px] border border-dashed border-separator rounded-lg p-2 flex items-center justify-center text-outline text-xs text-center">
            ${currentLang === 'ar' ? 'قم بتحديد هذا اليوم ثم اضغط (+) على التمارين من المكتبة لإضافتها هنا' : 'Select this day and press (+) on exercises to add them here'}
        </div>
    `;
    
    container.appendChild(dayDiv);
    
    if (courseDaysCount === 1) {
        setActiveDay(dayId);
    }
}

window.setActiveDay = function(dayId) {
    currentActiveDayId = dayId;
    // Highlight active day
    document.querySelectorAll('#courseDaysContainer > div').forEach(div => {
        div.classList.remove('border-[var(--color-primary)]');
        div.classList.add('border-separator');
    });
    const activeDiv = document.getElementById(dayId);
    if(activeDiv) {
        activeDiv.classList.remove('border-separator');
        activeDiv.classList.add('border-[var(--color-primary)]');
    }
}

window.addExerciseToDay = function(exId) {
    if (!currentActiveDayId) {
        alert(currentLang === 'ar' ? 'يرجى إضافة يوم جديد وتحديده أولاً!' : 'Please add a day and select it first!');
        return;
    }
    
    const dayDiv = document.getElementById(currentActiveDayId);
    if (!dayDiv) return;
    
    const exContainer = dayDiv.querySelector('.day-exercises');
    
    // Remove the placeholder text if it's the first exercise
    if (exContainer.innerHTML.includes('(+)')) {
        exContainer.innerHTML = '';
        exContainer.classList.remove('items-center', 'justify-center', 'text-outline', 'border-dashed', 'text-center');
    }
    
    const ex = exercisesData[exId];
    if (!ex) return;
    
    const exIdUnique = 'ex-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    const row = document.createElement('div');
    row.id = exIdUnique;
    row.className = "flex items-center gap-3 bg-[var(--hover-bg)] p-3 rounded-lg border border-separator/50";
    
    const isResistance = ex.category === 'مقاومة';
    const isCardio = ex.category === 'كارديو' || ex.category === 'إطالة';
    
    let inputsHtml = '';
    if (isResistance) {
        inputsHtml = `
            <div class="flex items-center gap-2">
                <div class="flex flex-col">
                    <label class="text-[10px] text-outline mb-0.5">${currentLang === 'ar' ? 'جلسات' : 'Sets'}</label>
                    <input type="number" class="w-12 bg-[var(--bg-color)] border border-separator rounded px-1 py-1 text-xs text-center focus:outline-none focus:border-[var(--color-primary)]" value="3">
                </div>
                <div class="flex flex-col">
                    <label class="text-[10px] text-outline mb-0.5">${currentLang === 'ar' ? 'تكرارات' : 'Reps'}</label>
                    <input type="number" class="w-12 bg-[var(--bg-color)] border border-separator rounded px-1 py-1 text-xs text-center focus:outline-none focus:border-[var(--color-primary)]" value="12">
                </div>
                <div class="flex flex-col">
                    <label class="text-[10px] text-outline mb-0.5">${currentLang === 'ar' ? 'راحة (ث)' : 'Rest(s)'}</label>
                    <input type="number" class="w-12 bg-[var(--bg-color)] border border-separator rounded px-1 py-1 text-xs text-center focus:outline-none focus:border-[var(--color-primary)]" value="60">
                </div>
            </div>
        `;
    } else {
        inputsHtml = `
            <div class="flex items-center gap-2">
                <div class="flex flex-col">
                    <label class="text-[10px] text-outline mb-0.5">${currentLang === 'ar' ? 'المدة (د)' : 'Time(m)'}</label>
                    <input type="number" class="w-16 bg-[var(--bg-color)] border border-separator rounded px-1 py-1 text-xs text-center focus:outline-none focus:border-[var(--color-primary)]" value="15">
                </div>
            </div>
        `;
    }
    
    row.innerHTML = `
        <div class="flex-1 min-w-0">
            <h5 class="font-bold text-sm text-on-surface truncate">${currentLang === 'ar' ? ex.name_ar : (ex.name_en || ex.name_ar)}</h5>
            <span class="text-[10px] text-outline">${ex.category}</span>
        </div>
        ${inputsHtml}
        <button onclick="document.getElementById('${exIdUnique}').remove()" class="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors shrink-0 ltr:ml-2 rtl:mr-2">
            <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
    `;
    
    exContainer.appendChild(row);
}

// Add a starter day when switching to create-course view for the first time
const originalSwitchView = window.switchView;
window.switchView = function(viewName) {
    originalSwitchView(viewName);
    if (viewName === 'create-course' && courseDaysCount === 0) {
        addCourseDay();
    }
}
"""

if "function populateClientDropdown()" not in js:
    js += "\n" + course_logic

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Injected course logic into app.js")
