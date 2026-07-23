const SUPABASE_URL = 'https://ryomqumuisdwclbjtbqi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b21xdW11aXNkd2NsYmp0YnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzg4MzQsImV4cCI6MjA5NzQ1NDgzNH0.Zm0u-Twwt376Bz7beu5p2KWk0WKQ2G7WOPIdPvCeRNU';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    // apply initial theme
    const html = document.documentElement;
    const knob = document.getElementById('themeKnob');
    const icon = document.getElementById('themeIcon');
    if (isDark) {
        html.classList.add('dark');
        icon.innerText = 'dark_mode';
        if(knob) {
            knob.classList.remove(currentLang === 'ar' ? '-translate-x-6' : 'translate-x-6');
            knob.classList.add('translate-x-0');
        }
    } else {
        html.classList.remove('dark');
        icon.innerText = 'light_mode';
        if(knob) {
            knob.classList.remove('translate-x-0');
            knob.classList.add(currentLang === 'ar' ? '-translate-x-6' : 'translate-x-6');
        }
    }
    
    // apply initial language
    setLanguage(currentLang);
});

// ==========================================
// CRM Logic
// ==========================================
let profilesData = {};

async function fetchClients() {
    const tbody = document.getElementById('clients-table-body');
    try {
        const { data: profiles, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (!profiles || profiles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-outline" data-i18n="no_clients">لا يوجد متدربين حالياً.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = '';
        
        profilesData = {};
        profiles.forEach(profile => {
            profilesData[profile.id] = profile;
            const pData = profile.data || {};
            const name = pData.fullname || profile.full_name || profile.username || 'بدون اسم';
            const goal = pData.subscription_goal || pData.goal || profile.goal || 'غير محدد';
            const dateStr = profile.created_at;
            const firstLetter = name.charAt(0).toUpperCase();
            
            const tr = document.createElement('tr');
            tr.className = "group hover:bg-surface-variant/30 transition-colors cursor-pointer border-transparent ltr:border-l-2 rtl:border-r-2 hover:border-primary";
            tr.onclick = () => updatePreviewPanel(profile, tr);
            
            tr.innerHTML = `
                <td class="py-3 px-5">
                    <div class="flex items-center gap-3 cursor-pointer group/name" onclick="openFullProfile(event, '${profile.id}')">
                        <div class="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center border border-[var(--color-primary)]/30 text-[var(--color-primary)] font-bold shadow-inner shrink-0 group-hover/name:bg-[var(--color-primary)]/30 transition-colors">
                            ${firstLetter}
                        </div>
                        <div>
                            <div class="font-medium text-on-surface group-hover/name:text-[var(--color-primary)] underline decoration-transparent group-hover/name:decoration-[var(--color-primary)] transition-all">${name}</div>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-5">
                    <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-400/10 border border-emerald-400/20 whitespace-nowrap">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]"></span>
                        <span class="text-xs font-semibold text-emerald-400 status-text" data-en="Active" data-ar="نشط">${currentLang === 'ar' ? 'نشط' : 'Active'}</span>
                    </div>
                </td>
                <td class="py-3 px-5 text-on-surface-variant text-sm">${translateDynamic(goal)}</td>
                <td class="py-3 px-5 text-data-mono text-outline text-sm date-cell" data-date="${dateStr}">
                    ${formatDate(dateStr)}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Select first automatically
        if(profiles.length > 0) {
            tbody.firstElementChild.click();
        }
        
        // Populate courses dropdown
        if (typeof populateClientDropdown === 'function') {
            populateClientDropdown();
        }

        
    } catch (err) {
        console.error('Error fetching profiles:', err);
        tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-error" data-i18n="error_fetch">حدث خطأ أثناء جلب البيانات. الرجاء تحديث الصفحة.</td></tr>`;
    }
}

function updatePreviewPanel(profile, clickedRow) {
    const rows = document.querySelectorAll('#clients-table-body tr');
    rows.forEach(r => r.classList.remove('bg-surface-variant/20', 'border-primary'));
    if(clickedRow) {
        clickedRow.classList.add('bg-surface-variant/20', 'border-primary');
    }

    const pData = profile.data || {};
    
    // Extract fields
    const name = pData.fullname || profile.full_name || profile.username || 'بدون اسم';
    const goal = pData.subscription_goal || pData.goal || profile.goal || 'غير محدد';
    const weight = pData.weight || profile.weight || '--';
    const height = pData.height || profile.height || '--';
    const age = pData.age || '--';
    const gender = pData.gender || '--';
    const targetWeight = pData.target_weight || '--';
    const activity = pData.activity || '--';
    const exp = pData.workout_exp || '--';
    const days = pData.workout_days || '--';
    const injuries = pData.injuries || 'لا يوجد';
    const allergies = pData.allergies || 'لا يوجد';

    const firstLetter = name.charAt(0).toUpperCase();
    
    // Unhide details
    document.getElementById('panel-details').classList.remove('hidden');

    // Header
    document.getElementById('panel-avatar').innerText = firstLetter;
    document.getElementById('panel-name').innerText = name;
    document.getElementById('panel-goal').innerText = translateDynamic(goal);
    
    // General
    document.getElementById('panel-age').innerText = age;
    document.getElementById('panel-gender').innerText = translateDynamic(gender);

    // Physio
    document.getElementById('panel-weight').innerText = weight;
    document.getElementById('panel-height').innerText = height;
    document.getElementById('panel-target-weight').innerText = targetWeight;

    // Training
    document.getElementById('panel-activity').innerText = translateDynamic(activity);
    document.getElementById('panel-exp').innerText = translateDynamic(exp);
    document.getElementById('panel-days').innerText = translateDynamic(days);

    // Medical
    document.getElementById('panel-injuries').innerText = injuries;
    document.getElementById('panel-allergies').innerText = allergies;
}

function formatDate(dateStr) {
    if(!dateStr) return currentLang === 'ar' ? 'اليوم' : 'Today';
    const loc = currentLang === 'ar' ? 'ar-EG' : 'en-US';
    return new Date(dateStr).toLocaleDateString(loc);
}


// ==========================================
// UI Logic: Settings, Theme, i18n
// ==========================================

let isDark = localStorage.getItem('theme') !== 'light'; 
let currentLang = localStorage.getItem('lang') || 'ar';

function toggleSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const content = document.getElementById('settingsModalContent');
    
    if (modal.classList.contains('opacity-0')) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    } else {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
    }
}

function toggleTheme() {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const html = document.documentElement;
    const knob = document.getElementById('themeKnob');
    const icon = document.getElementById('themeIcon');
    
    if (isDark) {
        html.classList.add('dark');
        icon.innerText = 'dark_mode';
        knob.classList.remove(currentLang === 'ar' ? '-translate-x-6' : 'translate-x-6');
        knob.classList.add('translate-x-0');
    } else {
        html.classList.remove('dark');
        icon.innerText = 'light_mode';
        knob.classList.remove('translate-x-0');
        knob.classList.add(currentLang === 'ar' ? '-translate-x-6' : 'translate-x-6');
    }
}

// Static UI Translations
const translations = {
    en: {
        coach_dashboard: "Coach Dashboard",
        main_menu: "Main Menu",
        client_management: "Client Management",
        settings: "Settings",
        logout: "Logout",
        crm_title: "Clients (CRM)",
        crm_desc: "Manage clients, track their status, and view their primary goals.",
        athlete: "Athlete",
        status: "Status",
        goal: "Goal",
        join_date: "Join Date",
        loading: "Fetching client data...",
        select_client: "Select a Client",
        general_data: "General Info",
        age: "Age",
        gender: "Gender",
        physiological_data: "Physiological Data",
        weight: "Weight",
        height: "Height",
        target_weight: "Target",
        training_data: "Training & Activity",
        activity_level: "Activity Level:",
        workout_exp: "Experience:",
        workout_days: "Days/Week:",
        medical_info: "Health & Injuries",
        injuries: "Injuries:",
        allergies: "Allergies:",
        future_modules: "Workout and nutrition builder buttons will be added here later.",
        theme: "Theme",
        theme_desc: "Toggle between light and dark mode",
        language: "Language",
        language_desc: "Change the interface language",
        no_clients: "No clients currently.",
        error_fetch: "Error fetching data. Please refresh.",
        exercises_base: "Exercises Base",
        exercises_desc: "Add, edit, and manage all your available exercises.",
        search_trainee: "Search trainee...",
        search_exercise: "Search exercise...",
        new_exercise: "New Exercise",
        cat_all: "All Types",
        cat_resistance: "Resistance (Weights)",
        cat_bodyweight: "Bodyweight",
        cat_cardio: "Cardio",
        cat_stretching: "Stretching",
        muscle_all: "All Muscles",
        muscle_chest: "Chest",
        muscle_back: "Back",
        muscle_shoulders: "Shoulders",
        muscle_rear_delts: "Rear Delts",
        muscle_traps: "Traps",
        muscle_lower_back: "Lower Back",
        muscle_biceps: "Biceps",
        muscle_triceps: "Triceps",
        muscle_forearms: "Forearms",
        muscle_abs: "Abs",
        muscle_obliques: "Obliques",
        muscle_quads: "Quads",
        muscle_hamstrings: "Hamstrings",
        muscle_calves: "Calves",
        muscle_glutes: "Glutes",
        muscle_general: "General",
        add_new_exercise: "Add New Exercise",
        edit_exercise: "Edit Exercise",
        not_selected: "Not Selected",
        exercise_type: "Exercise Type *",
        ex_name_ar: "Exercise Name (Arabic) *",
        ex_name_en: "Exercise Name (English) - Optional",
        ex_video_url: "Video URL (YouTube) - Optional",
        ex_notes: "Notes / Performance",
        btn_delete: "Delete",
        btn_cancel: "Cancel",
        btn_save: "Save Exercise",
        close: "Close",
        create_plan: "Create Training Plan",
        loading_exercises: "Fetching exercises...",
        ex_name_ar_ph: "Example: Dumbbell Chest Press",
        ex_notes_ph: "Notes on performance...",
    },
    ar: {
        coach_dashboard: "لوحة تحكم المدرب",
        main_menu: "القائمة الرئيسية",
        client_management: "إدارة المشتركين",
        settings: "الإعدادات",
        logout: "تسجيل الخروج",
        crm_title: "المشتركون (CRM)",
        crm_desc: "إدارة المتدربين، متابعة حالاتهم، والاطلاع على أهدافهم الأساسية.",
        athlete: "المتدرب",
        status: "الحالة",
        goal: "الهدف",
        join_date: "تاريخ التسجيل",
        loading: "جاري سحب بيانات المتدربين...",
        select_client: "اختر متدرباً",
        general_data: "معلومات عامة",
        age: "العمر",
        gender: "الجنس",
        physiological_data: "البيانات الفسيولوجية",
        weight: "الوزن",
        height: "الطول",
        target_weight: "الهدف",
        training_data: "التدريب والنشاط",
        activity_level: "مستوى النشاط:",
        workout_exp: "الخبرة:",
        workout_days: "أيام التدريب:",
        medical_info: "الحالة الصحية والإصابات",
        injuries: "الإصابات:",
        allergies: "الحساسية:",
        future_modules: "سيتم إضافة أزرار الكورسات والبرامج الغذائية هنا لاحقاً.",
        theme: "المظهر",
        theme_desc: "تغيير نمط العرض بين فاتح وداكن",
        language: "اللغة",
        language_desc: "تغيير لغة الواجهة",
        no_clients: "لا يوجد متدربين حالياً.",
        error_fetch: "حدث خطأ أثناء جلب البيانات. الرجاء تحديث الصفحة.",
        exercises_base: "قاعدة التمارين",
        exercises_desc: "أضف، عدل، وقم بإدارة كافة التمارين المتوفرة لديك.",
        search_trainee: "ابحث عن متدرب...",
        search_exercise: "ابحث عن تمرين...",
        new_exercise: "تمرين جديد",
        cat_all: "كل الأنواع",
        cat_resistance: "مقاومة (حديد)",
        cat_bodyweight: "بوزن الجسم",
        cat_cardio: "كارديو",
        cat_stretching: "إطالة",
        muscle_all: "كل العضلات",
        muscle_chest: "صدر",
        muscle_back: "ظهر",
        muscle_shoulders: "أكتاف",
        muscle_rear_delts: "أكتاف خلفية",
        muscle_traps: "ترابيس",
        muscle_lower_back: "قطنية",
        muscle_biceps: "بايسبس",
        muscle_triceps: "ترايسبس",
        muscle_forearms: "سواعد",
        muscle_abs: "معدة",
        muscle_obliques: "خواصر",
        muscle_quads: "أفخاذ أمامية",
        muscle_hamstrings: "أفخاذ خلفية",
        muscle_calves: "سمانة",
        muscle_glutes: "أرداف",
        muscle_general: "عام",
        add_new_exercise: "إضافة تمرين جديد",
        edit_exercise: "تعديل التمرين",
        not_selected: "لم يتم التحديد",
        exercise_type: "نوع التمرين *",
        ex_name_ar: "اسم التمرين (عربي) *",
        ex_name_en: "اسم التمرين (إنجليزي) - اختياري",
        ex_video_url: "رابط فيديو (YouTube) - اختياري",
        ex_notes: "ملاحظات / أداء التمرين",
        btn_delete: "حذف",
        btn_cancel: "إلغاء",
        btn_save: "حفظ التمرين",
        close: "إغلاق",
        create_plan: "إنشاء خطة تدريب",
        loading_exercises: "جاري سحب التمارين...",
        ex_name_ar_ph: "مثال: ضغط الصدر بالدمبل",
        ex_notes_ph: "ملاحظات حول طريقة الأداء...",
    }
};

// Dynamic Data Translations dictionary
const dynamicDict = {
    "male": { ar: "ذكر", en: "Male" },
    "female": { ar: "أنثى", en: "Female" },
    "muscle_gain": { ar: "بناء العضلات", en: "Muscle Gain" },
    "fat_loss": { ar: "خسارة الدهون", en: "Fat Loss" },
    "maintain": { ar: "الحفاظ على الوزن", en: "Maintain Weight" },
    "light": { ar: "خفيف", en: "Light" },
    "moderate": { ar: "متوسط", en: "Moderate" },
    "active": { ar: "نشط", en: "Active" },
    "very_active": { ar: "نشط جداً", en: "Very Active" },
    "beginner": { ar: "مبتدئ", en: "Beginner" },
    "year": { ar: "سنة أو أكثر", en: "1+ Years" },
    "years": { ar: "عدة سنوات", en: "Multiple Years" },
    "no": { ar: "لا يوجد", en: "None" },
    "half-to-hour": { ar: "نصف ساعة إلى ساعة", en: "30 - 60 mins" },
    "gym": { ar: "النادي", en: "Gym" },
    "home": { ar: "المنزل", en: "Home" },
    "weights": { ar: "أوزان", en: "Weights" },
    "cardio": { ar: "كارديو", en: "Cardio" },
    "beef": { ar: "لحم بقري", en: "Beef" },
    "chicken": { ar: "دجاج", en: "Chicken" },
    "anything": { ar: "أي نوع", en: "Anything" },
    "yes": { ar: "نعم", en: "Yes" }
};

// Helper to translate dynamic database values
function translateDynamic(val) {
    if(!val) return '--';
    const key = val.toString().toLowerCase().trim();
    if (dynamicDict[key]) {
        return dynamicDict[key][currentLang];
    }
    // Fallback if no translation found
    return val;
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    const html = document.documentElement;
    
    const btnAr = document.getElementById('btnAr');
    const btnEn = document.getElementById('btnEn');

    if (lang === 'ar') {
        html.setAttribute('dir', 'rtl');
        html.setAttribute('lang', 'ar');
        // Activate AR
        btnAr.className = "w-16 h-7 text-xs font-bold rounded-md bg-[var(--color-primary)] text-[var(--bg-color)] shadow-sm transition-all flex items-center justify-center";
        // Deactivate EN
        btnEn.className = "w-16 h-7 text-xs font-bold rounded-md text-outline hover:text-on-surface transition-all flex items-center justify-center";
    } else {
        html.setAttribute('dir', 'ltr');
        html.setAttribute('lang', 'en');
        // Activate EN
        btnEn.className = "w-16 h-7 text-xs font-bold rounded-md bg-[var(--color-primary)] text-[var(--bg-color)] shadow-sm transition-all flex items-center justify-center";
        // Deactivate AR
        btnAr.className = "w-16 h-7 text-xs font-bold rounded-md text-outline hover:text-on-surface transition-all flex items-center justify-center";
    }

    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            if(el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = translations[lang][key];
            } else {
                el.innerText = translations[lang][key];
            }
        }
    });

    document.querySelectorAll('.status-text').forEach(el => {
        el.innerText = el.getAttribute(`data-${lang}`);
    });
    
    document.querySelectorAll('.date-cell').forEach(el => {
        const d = el.getAttribute('data-date');
        el.innerText = formatDate(d);
    });

    fetchClients();
    fetchExercises();
    
    // Fix theme knob position
    const knob = document.getElementById('themeKnob');
    if(isDark) {
        knob.classList.remove('translate-x-6', '-translate-x-6');
        knob.classList.add('translate-x-0');
    } else {
        knob.classList.remove('translate-x-0', 'translate-x-6', '-translate-x-6');
        knob.classList.add(lang === 'ar' ? '-translate-x-6' : 'translate-x-6');
    }
}

// ==========================================
// Full Profile Modal Logic
// ==========================================
async function openFullProfile(event, profileId) {
    if(event) event.stopPropagation();
    const profile = profilesData[profileId];
    if(!profile) return;
    
    const pData = profile.data || {};
    const name = pData.fullname || profile.full_name || profile.username || 'بدون اسم';
    const goal = pData.subscription_goal || pData.goal || profile.goal || 'غير محدد';
    
    document.getElementById('fp-avatar').innerText = name.charAt(0).toUpperCase();
    document.getElementById('fp-name').innerText = name;
    document.getElementById('fp-goal').innerText = translateDynamic(goal);
    
    window.currentOpenedProfileId = profileId;

    if (allCourses.length === 0) {
        await window.fetchCourses();
    }

    // Build the body html
    const body = document.getElementById('fp-body');
    body.innerHTML = `
        <div class="space-y-6">
            <div class="glass-child p-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5">
                <h4 class="text-sm font-bold text-[var(--color-primary)] mb-3 border-b border-[var(--color-primary)]/20 pb-2 flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">fitness_center</span> ${currentLang === 'ar' ? 'الكورس التدريبي الحالي' : 'Current Training Course'}
                </h4>
                
                ${(() => {
                    const assignedCourse = allCourses.find(c => c.id === profile.current_course_id);
                    if (assignedCourse) {
                        return `
                        <div class="flex items-center gap-3 bg-[var(--bg-color)] p-3 rounded-lg border border-[var(--color-primary)]/20 shadow-sm mb-4">
                            <img src="${assignedCourse.cover_image || 'logo.png'}" class="w-14 h-14 object-cover rounded-md border border-separator">
                            <div class="flex-1">
                                <p class="text-sm font-bold text-on-surface">${assignedCourse.name}</p>
                                <p class="text-[11px] text-[var(--color-primary)] mt-1 font-bold bg-[var(--color-primary)]/10 inline-block px-2 py-0.5 rounded-full">${assignedCourse.days_data ? assignedCourse.days_data.length : 0} ${currentLang === 'ar' ? 'أيام تدريبية' : 'Days'}</p>
                            </div>
                        </div>
                        `;
                    } else {
                        return `
                        <div class="text-center py-5 mb-4 text-outline text-sm bg-[var(--bg-color)] rounded-lg border border-dashed border-separator">
                            <span class="material-symbols-outlined text-3xl mb-1 opacity-50 block">sentiment_dissatisfied</span>
                            ${currentLang === 'ar' ? 'لا يوجد كورس محدد حالياً' : 'No assigned course currently'}
                        </div>
                        `;
                    }
                })()}

                <div class="space-y-3 pt-2">
                    <div class="flex items-center gap-2 w-full">
                        <select id="fp-course-select-box" class="flex-1 bg-[var(--bg-color)] border border-separator rounded-lg px-3 py-2.5 text-xs font-medium text-on-surface focus:outline-none focus:border-[var(--color-primary)] appearance-none">
                            <option value="">${currentLang === 'ar' ? '-- اختر كورس لتعيينه من القائمة --' : '-- Select a course --'}</option>
                            ${allCourses.map(c => `<option value="${c.id}" ${profile.current_course_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                        <button id="assign-course-to-profile-btn" onclick="assignCourseToProfileBox()" class="px-4 py-2.5 text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-opacity-90 rounded-lg transition-colors whitespace-nowrap shadow-sm flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">check_circle</span>
                            ${currentLang === 'ar' ? 'تعيين' : 'Assign'}
                        </button>
                    </div>
                    
                    <div class="relative flex items-center py-1">
                        <div class="flex-grow border-t border-separator"></div>
                        <span class="flex-shrink-0 mx-2 text-[10px] text-outline">${currentLang === 'ar' ? 'أو' : 'OR'}</span>
                        <div class="flex-grow border-t border-separator"></div>
                    </div>
                    
                    <button class="w-full px-4 py-2.5 text-xs font-bold bg-[var(--bg-color)] text-on-surface border border-separator rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all hover:bg-[var(--hover-bg)]" onclick="createCourseForProfileBox()">
                        <span class="material-symbols-outlined text-[16px] text-[var(--color-primary)]">add_circle</span>
                        ${currentLang === 'ar' ? 'إنشاء كورس مخصص جديد لهذا المتدرب' : 'Create Custom Course'}
                    </button>
                </div>
            </div>
            
            <div class="glass-child p-4 rounded-xl border-separator">
                <h4 class="text-sm font-bold text-[var(--color-primary)] mb-3 border-b border-separator pb-2" data-i18n="general_data">${currentLang === 'ar' ? 'المعلومات الشخصية والفسيولوجية' : 'Personal & Physio Info'}</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'العمر' : 'Age'}</span><span class="font-medium text-on-surface">${pData.age || '--'}</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'الجنس' : 'Gender'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.gender)}</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'الوزن' : 'Weight'}</span><span class="font-data-mono font-medium text-on-surface">${pData.weight || '--'} kg</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'الطول' : 'Height'}</span><span class="font-data-mono font-medium text-on-surface">${pData.height || '--'} cm</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'الهدف' : 'Target'}</span><span class="font-data-mono font-medium text-on-surface">${pData.target_weight || '--'} kg</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'النشاط' : 'Activity'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.activity)}</span></div>
                </div>
            </div>

            <div class="glass-child p-4 rounded-xl border-separator">
                <h4 class="text-sm font-bold text-[var(--color-primary)] mb-3 border-b border-separator pb-2">${currentLang === 'ar' ? 'التدريب والنشاط البدني' : 'Training & Fitness'}</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'أيام التدريب' : 'Training Days'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.workout_days)}</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'مدة الجلسة' : 'Session Duration'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.gym_time)}</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'خبرة التدريب' : 'Experience'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.workout_exp)}</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'الالتزام' : 'Commitment'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.workout_commit)}</span></div>
                    <div class="col-span-2"><span class="text-xs text-outline block">${currentLang === 'ar' ? 'أنواع التدريب المتاحة' : 'Workout Types'}</span><span class="font-medium text-on-surface">${Array.isArray(pData.workout_type) ? pData.workout_type.map(translateDynamic).join('، ') : translateDynamic(pData.workout_type)}</span></div>
                </div>
            </div>
        </div>

        <div class="space-y-6">
            <div class="glass-child p-4 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error-bg)]">
                <h4 class="text-sm font-bold text-[var(--color-error)] mb-3 border-b border-[var(--color-error)]/20 pb-2 flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">medical_services</span> ${currentLang === 'ar' ? 'السجل الطبي والإصابات' : 'Medical Record'}</h4>
                <div class="space-y-3">
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'الإصابات أو العمليات' : 'Injuries / Surgeries'}</span><span class="font-medium text-on-surface">${pData.injuries || 'لا يوجد'}</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'الحساسية من أطعمة' : 'Allergies'}</span><span class="font-medium text-on-surface">${pData.allergies || 'لا يوجد'}</span></div>
                </div>
            </div>

            <div class="glass-child p-4 rounded-xl border-separator">
                <h4 class="text-sm font-bold text-[var(--color-primary)] mb-3 border-b border-separator pb-2">${currentLang === 'ar' ? 'النظام الغذائي والروتين' : 'Diet & Routine'}</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2"><span class="text-xs text-outline block">${currentLang === 'ar' ? 'الأطعمة المفضلة' : 'Favorite Foods'}</span><span class="font-medium text-on-surface">${pData.fav_foods || '--'}</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'تفضيل اللحوم' : 'Meat Preference'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.meat_pref)}</span></div>
                    <div><span class="text-xs text-outline block">${currentLang === 'ar' ? 'شراء مكملات؟' : 'Buy Supplements?'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.buy_supplements)}</span></div>
                    <div class="col-span-2"><span class="text-xs text-outline block">${currentLang === 'ar' ? 'القهوة (يومياً)' : 'Coffee (Daily)'}</span><span class="font-medium text-on-surface">${translateDynamic(pData.coffee_rate)} ${currentLang === 'ar' ? 'أكواب' : 'cups'} (${translateDynamic(pData.coffee_type)})</span></div>
                </div>
                <div class="mt-4">
                    <span class="text-xs text-outline block mb-2">${currentLang === 'ar' ? 'أوقات الوجبات' : 'Meal Times'}</span>
                    <div class="flex flex-wrap gap-2">
                        <span class="text-xs bg-[var(--hover-bg)] text-on-surface px-2 py-1 rounded border border-separator">${currentLang === 'ar' ? 'إفطار' : 'Breakfast'}: ${pData.work_breakfast || '--'}</span>
                        <span class="text-xs bg-[var(--hover-bg)] text-on-surface px-2 py-1 rounded border border-separator">${currentLang === 'ar' ? 'غداء' : 'Lunch'}: ${pData.work_lunch || '--'}</span>
                        <span class="text-xs bg-[var(--hover-bg)] text-on-surface px-2 py-1 rounded border border-separator">${currentLang === 'ar' ? 'عشاء' : 'Dinner'}: ${pData.work_dinner || '--'}</span>
                    </div>
                </div>
            </div>

            ${pData.body_photos && pData.body_photos.length > 0 ? `
            <div class="glass-child p-4 rounded-xl border-separator">
                <h4 class="text-sm font-bold text-[var(--color-primary)] mb-3 border-b border-separator pb-2">${currentLang === 'ar' ? 'صور المتدرب' : 'Body Photos'}</h4>
                <div class="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    ${pData.body_photos.map(p => `<a href="${p}" target="_blank" class="w-16 h-16 bg-[var(--hover-bg)] rounded flex-shrink-0 flex flex-col items-center justify-center text-xs text-outline hover:text-[var(--color-primary)] transition-colors border border-separator"><span class="material-symbols-outlined text-[20px]">image</span></a>`).join('')}
                </div>
                <p class="text-[10px] text-outline mt-1">* ${currentLang === 'ar' ? 'الصور مرفوعة سحابياً (اضغط للفتح)' : 'Photos stored in cloud (Click to open)'}</p>
            </div>
            ` : ''}
        </div>
    `;

    const modal = document.getElementById('fullProfileModal');
    const content = document.getElementById('fullProfileContent');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}

function closeFullProfile() {
    const modal = document.getElementById('fullProfileModal');
    const content = document.getElementById('fullProfileContent');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
}

// ==========================================
// Navigation & Views
// ==========================================
function switchView(viewName) {
    const views = ['crm', 'exercises', 'create-course', 'courses-library'];
    
    // Hide all views and reset navs
    views.forEach(v => {
        const viewEl = document.getElementById(v + '-view');
        const navEl = document.getElementById('nav-' + v);
        
        if (viewEl) viewEl.classList.add('hidden');
        if (navEl) {
            navEl.classList.remove('bg-[var(--color-primary)]/10', 'text-[var(--color-primary)]');
            navEl.classList.add('text-outline', 'border-transparent', 'shadow-none');
        }
    });

    // Show active view
    const activeView = document.getElementById(viewName + '-view');
    const activeNav = document.getElementById('nav-' + viewName);
    
    if (activeView) activeView.classList.remove('hidden');
    if (activeNav) {
        activeNav.classList.remove('text-outline', 'border-transparent', 'shadow-none');
        activeNav.classList.add('bg-[var(--color-primary)]/10', 'text-[var(--color-primary)]');
    }
}

// ==========================================
// Exercises Logic
// ==========================================
let exercisesData = {};

async function fetchExercises() {
    const grid = document.getElementById('exercises-grid');
    try {
        const { data: exercises, error } = await supabaseClient
            .from('exercises')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        exercisesData = {};
        if (exercises) {
            exercises.forEach(ex => {
                exercisesData[ex.id] = ex;
            });
        }
        
        window.renderExercises();
        renderMiniExercises();

    } catch (err) {
        console.error('Error fetching exercises:', err);
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-error">${currentLang === "ar" ? "فشل في جلب التمارين، هل قمت بإنشاء الجدول في Supabase؟" : "Failed to fetch exercises, did you create the table in Supabase?"}</div>`;
    }
}

window.renderExercises = function() {
    const grid = document.getElementById('exercises-grid');
    const searchQuery = document.getElementById('exerciseSearchInput')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('filterCategory')?.value || 'الكل';
    const muscleFilter = document.getElementById('filterMuscle')?.value || 'الكل';
    
    grid.innerHTML = '';
    const exercises = Object.values(exercisesData);
    
    if (exercises.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-outline">${currentLang === "ar" ? "لا توجد تمارين حالياً. اضغط على تمرين جديد للبدء." : "No exercises available. Click New Exercise to start."}</div>`;
        return;
    }
    
    const filteredExercises = exercises.filter(ex => {
        const nameArMatch = ex.name_ar && ex.name_ar.toLowerCase().includes(searchQuery);
        const nameEnMatch = ex.name_en && ex.name_en.toLowerCase().includes(searchQuery);
        const matchesSearch = nameArMatch || nameEnMatch;
        const matchesCategory = categoryFilter === 'الكل' || ex.category === categoryFilter;
        const matchesMuscle = muscleFilter === 'الكل' || (ex.target_muscle || 'عام') === muscleFilter;
        
        return matchesSearch && matchesCategory && matchesMuscle;
    });
    
    if (filteredExercises.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-outline">${currentLang === "ar" ? "لا توجد تمارين تطابق خيارات البحث." : "No exercises match the search criteria."}</div>`;
        return;
    }
    
    filteredExercises.forEach(ex => {
        const card = document.createElement('div');
        card.className = "glass-child p-4 rounded-xl border border-separator hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer flex items-center gap-4";
        card.onclick = () => openExerciseModal(ex.id);
        
        const iconHTML = getMuscleIcon(ex.target_muscle);
        
        card.innerHTML = `
            ${iconHTML ? `<div class="bg-[var(--hover-bg)] rounded-lg p-2 flex items-center justify-center border border-separator shadow-inner">${iconHTML}</div>` : ''}
            <div class="flex-1">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-on-surface text-lg">${ex.name_ar}</h4>
                    <span class="material-symbols-outlined text-outline text-sm">edit</span>
                </div>
                <div class="flex flex-wrap gap-2 mb-1">
                    ${ex.category ? `<div class="inline-block px-2 py-1 rounded-md bg-surface-variant text-outline text-[10px] font-bold border border-separator">${ex.category}</div>` : ''}
                    <div class="inline-block px-2 py-1 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold border border-[var(--color-primary)]/20">
                        ${ex.target_muscle || 'عام'}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
};

function getMuscleIcon(targetMuscle) {
    let iconName = 'general';
    let folder = 'icons';
    
    switch (targetMuscle) {
        case 'صدر': iconName = 'chest'; folder = 'muscles'; break;
        case 'ظهر': iconName = 'back'; folder = 'muscles'; break;
        case 'ترابيس': iconName = 'traps'; folder = 'muscles'; break;
        case 'قطنية': iconName = 'lower_back'; folder = 'muscles'; break;
        case 'أكتاف': 
        case 'أكتاف خلفية': iconName = 'shoulders'; folder = 'muscles'; break;
        case 'بايسبس': iconName = 'biceps'; folder = 'muscles'; break;
        case 'ترايسبس': iconName = 'triceps'; folder = 'muscles'; break;
        case 'سواعد': iconName = 'forearms'; folder = 'muscles'; break;
        case 'معدة': 
        case 'خواصر': iconName = 'abs'; folder = 'muscles'; break;
        case 'أفخاذ أمامية': iconName = 'quads'; folder = 'muscles'; break;
        case 'أفخاذ خلفية': iconName = 'hamstrings'; folder = 'muscles'; break;
        case 'سمانة': iconName = 'calves'; folder = 'muscles'; break;
        case 'أرداف': iconName = 'glutes'; folder = 'muscles'; break;
        default:
            iconName = 'general'; folder = 'muscles';
    }
    
    return `<img src="assets/${folder}/${iconName}.png" alt="${targetMuscle || 'عام'}" class="w-12 h-12 object-contain filter drop-shadow-[0_0_5px_rgba(255,50,50,0.3)]">`;
}

// --- Interactive Body Map Logic ---
let selectedMuscleTarget = '';

const allMuscles = [
    'صدر', 'ظهر', 'ترابيس', 'قطنية', 'أكتاف',
    'بايسبس', 'ترايسبس', 'سواعد', 'معدة', 'خواصر',
    'أفخاذ أمامية', 'أفخاذ خلفية', 'سمانة', 'أرداف', 'عام'
];

function initMuscleGrid() {
    const grid = document.getElementById('muscle-selector-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    allMuscles.forEach(muscle => {
        const div = document.createElement('div');
        div.className = `flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:bg-[var(--color-primary)]/10 muscle-grid-item`;
        div.dataset.muscle = muscle;
        div.onclick = () => selectMuscle(muscle);
        
        div.innerHTML = `
            ${getMuscleIcon(muscle)}
            <span class="text-xs mt-2 font-bold text-outline text-center transition-colors grid-item-text">${muscle}</span>
        `;
        grid.appendChild(div);
    });
}

function selectMuscle(muscleAr, _ignored) {
    selectedMuscleTarget = muscleAr;
    const hiddenInput = document.getElementById('ex-muscle-hidden');
    const label = document.getElementById('selected-muscle-label');
    
    if(hiddenInput) hiddenInput.value = muscleAr;
    if(label) label.innerText = muscleAr;
    
    // Highlight the selected one in the grid
    document.querySelectorAll('.muscle-grid-item').forEach(el => {
        const textSpan = el.querySelector('.grid-item-text');
        if (el.dataset.muscle === muscleAr && muscleAr !== 'لم يتم التحديد') {
            el.classList.remove('border-transparent');
            el.classList.add('border-[var(--color-primary)]', 'bg-[var(--color-primary)]/10');
            el.querySelector('img').classList.add('drop-shadow-[0_0_8px_var(--color-primary)]');
            if(textSpan) {
                textSpan.classList.remove('text-outline');
                textSpan.classList.add('text-[var(--color-primary)]');
            }
        } else {
            el.classList.add('border-transparent');
            el.classList.remove('border-[var(--color-primary)]', 'bg-[var(--color-primary)]/10');
            el.querySelector('img').classList.remove('drop-shadow-[0_0_8px_var(--color-primary)]');
            if(textSpan) {
                textSpan.classList.add('text-outline');
                textSpan.classList.remove('text-[var(--color-primary)]');
            }
        }
    });
}

function openExerciseModal(id = null) {
    const modal = document.getElementById('exerciseModal');
    const content = document.getElementById('exerciseModalContent');
    const title = document.getElementById('ex-modal-title');
    const btnDelete = document.getElementById('btn-delete-ex');
    
    // Reset inputs
    document.getElementById('ex-id').value = '';
    document.getElementById('ex-name-ar').value = '';
    document.getElementById('ex-name-en').value = '';
    document.getElementById('ex-video').value = '';
    document.getElementById('ex-notes').value = '';
    
    // Default category
    const defaultCat = document.querySelector('input[name="ex-category"][value="مقاومة"]');
    if(defaultCat) defaultCat.checked = true;
    
    selectMuscle('لم يتم التحديد', '');
    
    if (id && exercisesData[id]) {
        // Edit mode
        title.innerText = "تعديل التمرين";
        btnDelete.classList.remove('hidden');
        
        const ex = exercisesData[id];
        document.getElementById('ex-id').value = ex.id;
        document.getElementById('ex-name-ar').value = ex.name_ar || '';
        document.getElementById('ex-name-en').value = ex.name_en || '';
        document.getElementById('ex-video').value = ex.video_url || '';
        document.getElementById('ex-notes').value = ex.notes || '';
        
        if (ex.category) {
            const catRadio = document.querySelector(`input[name="ex-category"][value="${ex.category}"]`);
            if(catRadio) catRadio.checked = true;
        } else {
            const defaultCat = document.querySelector('input[name="ex-category"][value="مقاومة"]');
            if(defaultCat) defaultCat.checked = true;
        }
        
        if (ex.target_muscle && ex.target_muscle !== 'عام') {
            selectMuscle(ex.target_muscle, '');
        } else {
            selectMuscle('لم يتم التحديد', '');
        }
    } else {
        // Create mode
        title.innerText = "إضافة تمرين جديد";
        btnDelete.classList.add('hidden');
    }
    
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}

function closeExerciseModal() {
    const modal = document.getElementById('exerciseModal');
    const content = document.getElementById('exerciseModalContent');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
}

async function saveExercise() {
    const id = document.getElementById('ex-id').value;
    const name_ar = document.getElementById('ex-name-ar').value.trim();
    const name_en = document.getElementById('ex-name-en').value.trim();
    
    let target_muscle = document.getElementById('ex-muscle-hidden').value.trim();
    if(target_muscle === 'لم يتم التحديد') target_muscle = '';
    
    const video_url = document.getElementById('ex-video').value.trim();
    const notes = document.getElementById('ex-notes').value.trim();
    
    const categoryChecked = document.querySelector('input[name="ex-category"]:checked');
    const category = categoryChecked ? categoryChecked.value : 'مقاومة';
    
    if (!name_ar) {
        alert("يرجى إدخال اسم التمرين بالعربي على الأقل.");
        return;
    }
    
    const btnSave = document.getElementById('btn-save-ex');
    const originalText = btnSave.innerText;
    btnSave.innerText = "جاري الحفظ...";
    btnSave.disabled = true;
    
    const payload = {
        name_ar,
        name_en,
        target_muscle,
        category,
        video_url,
        notes
    };
    
    try {
        if (id) {
            // Update
            const { error } = await supabaseClient.from('exercises').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            // Insert
            const { error } = await supabaseClient.from('exercises').insert([payload]);
            if (error) throw error;
        }
        
        closeExerciseModal();
        fetchExercises(); // Refresh grid
    } catch (err) {
        console.error("Error saving exercise:", err);
        alert("حدث خطأ أثناء الحفظ. تأكد من جدول exercises.");
    } finally {
        btnSave.innerText = originalText;
        btnSave.disabled = false;
    }
}

async function deleteCurrentExercise() {
    const id = document.getElementById('ex-id').value;
    if (!id) return;
    
    if (!confirm("هل أنت متأكد من حذف هذا التمرين نهائياً؟")) return;
    
    const btnDelete = document.getElementById('btn-delete-ex');
    const originalText = btnDelete.innerHTML;
    btnDelete.innerHTML = "جاري الحذف...";
    btnDelete.disabled = true;
    
    try {
        const { error } = await supabaseClient.from('exercises').delete().eq('id', id);
        if (error) throw error;
        
        closeExerciseModal();
        fetchExercises(); // Refresh grid
    } catch (err) {
        console.error("Error deleting exercise:", err);
        alert("حدث خطأ أثناء الحذف.");
    } finally {
        btnDelete.innerHTML = originalText;
        btnDelete.disabled = false;
    }
}

// Search exercises
document.getElementById('exerciseSearchInput')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const grid = document.getElementById('exercises-grid');
    if (!grid) return;
    
    const cards = grid.children;
    for (let card of cards) {
        if (card.classList.contains('col-span-full')) continue; // Skip loading/empty state
        const titleAr = card.querySelector('h4')?.innerText.toLowerCase() || '';
        const titleEn = card.querySelector('p')?.innerText.toLowerCase() || '';
        const muscle = card.querySelector('.inline-block')?.innerText.toLowerCase() || '';
        
        if (titleAr.includes(term) || titleEn.includes(term) || muscle.includes(term)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    }
});

// Init muscle grid on load
document.addEventListener('DOMContentLoaded', initMuscleGrid);

// ==========================================
// Course Builder Logic
// ==========================================


// ==========================================
// Course Builder Logic
// ==========================================
let courseDaysCount = 0;
let currentActiveDayId = null;

function populateClientDropdown() {
    const clients = Object.values(profilesData).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Native hidden select
    const select1 = document.getElementById('courseClientSelect');
    if (select1 && select1.options.length > 0) {
        const firstOption1 = select1.options[0];
        select1.innerHTML = '';
        select1.appendChild(firstOption1);
        
        clients.forEach(c => {
            const pData = c.data || {};
            const name = pData.fullname || c.full_name || c.username || 'بدون اسم';
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = name;
            select1.appendChild(opt);
        });
    }
    
    // Custom searchable list
    const customList = document.getElementById('customCourseClientsList');
    if (customList) {
        customList.innerHTML = '';
        clients.forEach(c => {
            const pData = c.data || {};
            const name = pData.fullname || c.full_name || c.username || 'بدون اسم';
            const div = document.createElement('div');
            div.className = 'custom-client-option px-4 py-2 text-sm text-on-surface hover:bg-[var(--hover-bg)] cursor-pointer transition-colors flex items-center gap-2';
            div.dataset.value = c.id;
            div.dataset.name = name;
            div.innerHTML = `
                <div class="w-4 h-4 rounded border border-separator flex items-center justify-center pointer-events-none option-checkbox">
                    <span class="material-symbols-outlined text-[12px] opacity-0 text-white">check</span>
                </div>
                <span>${name}</span>
            `;
            div.onclick = (e) => {
                e.stopPropagation();
                window.toggleCustomCourseClient(c.id, name, div);
                document.getElementById('customCourseClientSearch').focus();
            };
            customList.appendChild(div);
        });
    }
    window.updateCustomCourseClientTags();

    // The other dropdown in Course Builder Modal
    const select2 = document.getElementById('course-trainee');
    if (select2 && select2.options.length > 0) {
        const firstOption2 = select2.options[0];
        select2.innerHTML = '';
        select2.appendChild(firstOption2);
        
        clients.forEach(c => {
            const pData = c.data || {};
            const name = pData.fullname || c.full_name || c.username || 'بدون اسم';
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = name;
            select2.appendChild(opt);
        });
    }
}

// Custom Searchable Multi-Select Logic
window.toggleCustomCourseClient = function(id, name, element) {
    const select = document.getElementById('courseClientSelect');
    if (!select) return;
    
    const option = Array.from(select.options).find(o => o.value === id);
    if (option) {
        option.selected = !option.selected;
        window.updateCustomCourseClientTags();
    }
}

window.updateCustomCourseClientTags = function() {
    const select = document.getElementById('courseClientSelect');
    const tagsContainer = document.getElementById('customCourseClientTags');
    const list = document.getElementById('customCourseClientsList');
    if (!select || !tagsContainer) return;
    
    tagsContainer.innerHTML = '';
    const selectedOptions = Array.from(select.selectedOptions).filter(o => o.value !== '');
    
    selectedOptions.forEach(opt => {
        const tag = document.createElement('div');
        tag.className = 'flex items-center gap-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 px-2 py-1 rounded-md text-xs font-medium';
        tag.innerHTML = `
            <span>${opt.innerText}</span>
            <span class="material-symbols-outlined text-[14px] cursor-pointer hover:text-red-500 transition-colors" onclick="event.stopPropagation(); window.removeCustomCourseClient('${opt.value}')">close</span>
        `;
        tagsContainer.appendChild(tag);
    });
    
    // Update checkboxes in list
    if (list) {
        const optionsDivs = list.querySelectorAll('.custom-client-option');
        optionsDivs.forEach(div => {
            const val = div.dataset.value;
            const isSelected = selectedOptions.some(o => o.value === val);
            const checkbox = div.querySelector('.option-checkbox');
            const icon = div.querySelector('.option-checkbox span');
            if (isSelected) {
                checkbox.classList.replace('border-separator', 'border-[var(--color-primary)]');
                checkbox.classList.add('bg-[var(--color-primary)]');
                icon.classList.remove('opacity-0');
            } else {
                checkbox.classList.replace('border-[var(--color-primary)]', 'border-separator');
                checkbox.classList.remove('bg-[var(--color-primary)]');
                icon.classList.add('opacity-0');
            }
        });
    }
}

window.removeCustomCourseClient = function(id) {
    const select = document.getElementById('courseClientSelect');
    if (!select) return;
    const option = Array.from(select.options).find(o => o.value === id);
    if (option) {
        option.selected = false;
        window.updateCustomCourseClientTags();
    }
}

window.filterCustomCourseClients = function() {
    const search = document.getElementById('customCourseClientSearch').value.toLowerCase();
    const list = document.getElementById('customCourseClientsList');
    if (!list) return;
    
    const options = list.querySelectorAll('.custom-client-option');
    let hasVisible = false;
    options.forEach(opt => {
        const name = opt.dataset.name.toLowerCase();
        if (name.includes(search)) {
            opt.classList.remove('hidden');
            opt.classList.add('flex');
            hasVisible = true;
        } else {
            opt.classList.remove('flex');
            opt.classList.add('hidden');
        }
    });
}

window.showCustomCourseClientsList = function() {
    const list = document.getElementById('customCourseClientsList');
    if (list) list.classList.remove('hidden');
}

document.addEventListener('click', function(e) {
    const wrapper = document.getElementById('customCourseClientWrapper');
    const list = document.getElementById('customCourseClientsList');
    if (wrapper && list) {
        if (!wrapper.contains(e.target)) {
            list.classList.add('hidden');
        }
    }
});


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
        card.className = "glass-child p-3 rounded-xl border border-separator hover:border-[var(--color-primary)]/50 transition-colors flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing";
        card.draggable = true;
        card.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', ex.id);
            e.dataTransfer.effectAllowed = 'copy';
        };
        
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
                <label class="text-xs text-outline cursor-pointer" onclick="document.querySelector('input[value=\'${dayId}\']').click()">${currentLang === 'ar' ? 'تحديد' : 'Select'}</label>
                <button onclick="document.getElementById('${dayId}').remove()" class="text-error hover:opacity-80 ltr:ml-4 rtl:mr-4">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
            </div>
        </div>
        <div class="day-exercises flex flex-col gap-2 min-h-[80px] border-2 border-dashed border-separator rounded-lg p-2 flex items-center justify-center text-outline text-xs text-center transition-all"
             ondragover="window.allowDrop(event)"
             ondragleave="window.dragLeave(event)"
             ondrop="window.dropExercise(event, '${dayId}')">
            ${currentLang === 'ar' ? 'اسحب التمارين وأفلتها هنا، أو اضغط (+) للإضافة' : 'Drag and drop exercises here, or click (+)'}
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
    
    if (exContainer.innerHTML.includes('(+)')) {
        exContainer.innerHTML = '';
        exContainer.classList.remove('items-center', 'justify-center', 'text-outline', 'border-dashed', 'text-center');
    }
    
    const ex = exercisesData[exId];
    if (!ex) return;
    
    const exIdUnique = 'ex-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    const row = document.createElement('div');
    row.id = exIdUnique;
    row.className = "flex flex-col gap-2 bg-[var(--hover-bg)] p-3 rounded-lg border border-separator/50 relative";
    
    const isResistance = ex.category === 'مقاومة';
    
    let contentHtml = '';
    if (isResistance) {
        contentHtml = `
            <div id="sets-container-${exIdUnique}" class="flex flex-col gap-2 w-full mt-2">
                <!-- Set 1 -->
                <div class="flex items-center gap-2 text-xs set-row">
                    <span class="w-8 text-outline font-bold set-number">${currentLang === 'ar' ? 'ج 1' : 'S 1'}</span>
                    <div class="flex flex-col">
                        <span class="text-[9px] text-outline mb-0.5">${currentLang === 'ar' ? 'عدات' : 'Reps'}</span>
                        <input type="number" value="12" class="w-14 bg-[var(--bg-color)] border border-separator rounded px-1 py-1 text-center focus:border-[var(--color-primary)] outline-none">
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[9px] text-outline mb-0.5">${currentLang === 'ar' ? 'راحة (ث)' : 'Rest (s)'}</span>
                        <input type="number" value="60" class="w-14 bg-[var(--bg-color)] border border-separator rounded px-1 py-1 text-center focus:border-[var(--color-primary)] outline-none">
                    </div>
                    <div class="flex flex-col flex-1">
                        <span class="text-[9px] text-outline mb-0.5">${currentLang === 'ar' ? 'وزن / ملاحظة' : 'Weight / Note'}</span>
                        <input type="text" placeholder="${currentLang === 'ar' ? 'اختياري' : 'Optional'}" class="w-full bg-[var(--bg-color)] border border-separator rounded px-2 py-1 focus:border-[var(--color-primary)] outline-none">
                    </div>
                    <button onclick="this.parentElement.remove(); window.updateSetNumbers('${exIdUnique}')" class="text-error hover:bg-error/10 p-1 rounded transition-colors shrink-0 self-end mb-0.5">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>
            </div>
            <div class="mt-1 ltr:text-left rtl:text-right">
                <button onclick="window.addSetToExercise('${exIdUnique}')" class="text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-1 rounded font-bold hover:bg-[var(--color-primary)] hover:text-[var(--bg-color)] transition-colors">
                    ${currentLang === 'ar' ? '+ جلسة إضافية' : '+ Add Set'}
                </button>
            </div>
        `;
    } else {
        contentHtml = `
            <div class="flex items-center gap-4 mt-2">
                <div class="flex flex-col">
                    <label class="text-[10px] text-outline mb-0.5">${currentLang === 'ar' ? 'المدة (دقائق)' : 'Time (mins)'}</label>
                    <input type="number" class="w-20 bg-[var(--bg-color)] border border-separator rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-[var(--color-primary)]" value="15">
                </div>
                <div class="flex flex-col flex-1">
                    <label class="text-[10px] text-outline mb-0.5">${currentLang === 'ar' ? 'ملاحظة' : 'Note'}</label>
                    <input type="text" placeholder="${currentLang === 'ar' ? 'سرعة، مسافة...' : 'Speed, Distance...'}" class="w-full bg-[var(--bg-color)] border border-separator rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-primary)]">
                </div>
            </div>
        `;
    }
    
    row.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <h5 class="font-bold text-sm text-on-surface">${currentLang === 'ar' ? ex.name_ar : (ex.name_en || ex.name_ar)}</h5>
                <span class="text-[9px] px-2 py-0.5 rounded-full bg-[var(--bg-color)] text-outline">${ex.category}</span>
            </div>
            <button onclick="document.getElementById('${exIdUnique}').remove()" class="text-error hover:bg-error/10 p-1 rounded-lg transition-colors">
                <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
        </div>
        ${contentHtml}
    `;
    
    exContainer.appendChild(row);
}

window.addSetToExercise = function(exIdUnique) {
    const container = document.getElementById('sets-container-' + exIdUnique);
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = "flex items-center gap-2 text-xs set-row";
    row.innerHTML = `
        <span class="w-8 text-outline font-bold set-number">-</span>
        <div class="flex flex-col">
            <input type="number" value="10" class="w-14 bg-[var(--bg-color)] border border-separator rounded px-1 py-1 text-center focus:border-[var(--color-primary)] outline-none mt-[18px]">
        </div>
        <div class="flex flex-col">
            <input type="number" value="60" class="w-14 bg-[var(--bg-color)] border border-separator rounded px-1 py-1 text-center focus:border-[var(--color-primary)] outline-none mt-[18px]">
        </div>
        <div class="flex flex-col flex-1">
            <input type="text" placeholder="${currentLang === 'ar' ? 'اختياري' : 'Optional'}" class="w-full bg-[var(--bg-color)] border border-separator rounded px-2 py-1 focus:border-[var(--color-primary)] outline-none mt-[18px]">
        </div>
        <button onclick="this.parentElement.remove(); window.updateSetNumbers('${exIdUnique}')" class="text-error hover:bg-error/10 p-1 rounded transition-colors shrink-0 self-end mb-0.5">
            <span class="material-symbols-outlined text-[14px]">close</span>
        </button>
    `;
    
    container.appendChild(row);
    window.updateSetNumbers(exIdUnique);
}

window.updateSetNumbers = function(exIdUnique) {
    const container = document.getElementById('sets-container-' + exIdUnique);
    if (!container) return;
    
    const rows = container.querySelectorAll('.set-row');
    rows.forEach((row, index) => {
        const numSpan = row.querySelector('.set-number');
        if (numSpan) {
            numSpan.innerText = currentLang === 'ar' ? 'ج ' + (index + 1) : 'S ' + (index + 1);
        }
    });
}


window.saveCourse = async function() {
    const courseName = document.getElementById('courseNameInput').value.trim();
    if (!courseName) {
        alert(currentLang === 'ar' ? 'الرجاء كتابة اسم الكورس!' : 'Please enter a course name!');
        return;
    }
    
    // Gather days data
    const days = [];
    const dayDivs = document.querySelectorAll('#courseDaysContainer > div');
    
    dayDivs.forEach((dayDiv, dayIndex) => {
        const dayObj = {
            day_number: dayIndex + 1,
            exercises: []
        };
        
        // Find all exercise rows in this day
        const exRows = dayDiv.querySelectorAll('.day-exercises > div.flex-col'); // They have flex-col now
        exRows.forEach((row, exIndex) => {
            const exName = row.querySelector('h5').innerText;
            const exCategory = row.querySelector('span.rounded-full').innerText;
            
            const exObj = {
                order: exIndex + 1,
                name: exName,
                category: exCategory,
                sets: []
            };
            
            // Check for sets
            const setsContainer = row.querySelector('[id^="sets-container"]');
            if (setsContainer) {
                const setRows = setsContainer.querySelectorAll('.set-row');
                setRows.forEach((sRow, sIndex) => {
                    const inputs = sRow.querySelectorAll('input');
                    if (inputs.length >= 3) {
                        exObj.sets.push({
                            set_number: sIndex + 1,
                            reps: inputs[0].value,
                            rest: inputs[1].value,
                            note: inputs[2].value
                        });
                    }
                });
            } else {
                // Cardio / Stretch logic
                const inputs = row.querySelectorAll('input');
                if (inputs.length >= 2) {
                    exObj.time = inputs[0].value;
                    exObj.note = inputs[1].value;
                }
            }
            
            dayObj.exercises.push(exObj);
        });
        
        days.push(dayObj);
    });
    
    // Gather selected clients
    const clientSelect = document.getElementById('courseClientSelect');
    const selectedClients = Array.from(clientSelect.selectedOptions).map(opt => opt.value).filter(val => val !== '');
    
    try {
        // 1. Insert into courses table
        const { data: authData } = await supabaseClient.auth.getUser();
        const user = authData?.user;
        // if (!user) throw new Error("Not logged in"); // Removed strict login for local testing
        
        
        // Handle image upload
        const fileInput = document.getElementById('courseCoverInput');
        let coverUrl = null;
        
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            
            try {
                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('course_covers')
                    .upload(fileName, file);
                    
                if (uploadError) throw uploadError;
                
                const { data: publicUrlData } = supabaseClient.storage
                    .from('course_covers')
                    .getPublicUrl(fileName);
                    
                coverUrl = publicUrlData.publicUrl;
            } catch (imgErr) {
                console.error('Error uploading image:', imgErr);
                alert(currentLang === 'ar' ? 'فشل رفع الصورة، سيتم الحفظ بدونها. تأكد من إعداد Storage Bucket.' : 'Failed to upload image, saving without it.');
            }
        }
        
        const payload = {
            name: courseName,
            days_data: days
        };
        if (coverUrl) {
            payload.cover_image = coverUrl;
        }

        if (user) {
            payload.coach_id = user.id;
        }

        let courseData, courseError;
        
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
        }
            
        if (courseError) throw courseError;
        
        const newCourseId = courseData[0].id;
        
        // 2. If clients selected, manage assignment history
        if (selectedClients.length > 0) {
            
            // For each client, deactivate old courses
            for (const cId of selectedClients) {
                await supabaseClient
                    .from('client_courses')
                    .update({ is_active: false })
                    .eq('client_id', cId)
                    .eq('is_active', true);
                    
                // Insert new assignment
                await supabaseClient
                    .from('client_courses')
                    .insert([{
                        client_id: cId,
                        course_id: newCourseId,
                        is_active: true
                    }]);
                    
                // Update profile current_course_id
                await supabaseClient
                    .from('profiles')
                    .update({ current_course_id: newCourseId })
                    .eq('id', cId);
                    
                // Update locally so it reflects in the UI immediately without refresh
                if (profilesData && profilesData[cId]) {
                    profilesData[cId].current_course_id = newCourseId;
                }
            }
        }
        
        await fetchCourses(); // Refresh allCourses array
        alert(currentLang === 'ar' ? 'تم حفظ الكورس بنجاح!' : 'Course saved successfully!');
        
        // Clear form
        document.getElementById('courseNameInput').value = '';
        if (document.getElementById('courseCoverInput')) document.getElementById('courseCoverInput').value = '';
        if (document.getElementById('courseCoverPreview')) {
            document.getElementById('courseCoverPreview').src = '';
            document.getElementById('courseCoverPreview').classList.add('hidden');
        }
        
        // Clear client selection
        if (clientSelect) {
            Array.from(clientSelect.options).forEach(opt => opt.selected = false);
            if (window.updateCustomCourseClientTags) window.updateCustomCourseClientTags();
        }
        document.getElementById('courseDaysContainer').innerHTML = '';
        courseDaysCount = 0;
        addCourseDay(); // Add day 1 back
        window.editingCourseId = null;
        const saveBtn = document.querySelector('#create-course-view button[onclick="saveCourse()"]');
        if (saveBtn) saveBtn.innerHTML = `<span class="material-symbols-outlined">save</span> ${currentLang === 'ar' ? 'حفظ الكورس' : 'Save Course'}`;
        
    } catch (err) {
        console.error('Error saving course:', err);
        alert(currentLang === 'ar' ? `خطأ: ${err.message || JSON.stringify(err)}` : `Error: ${err.message || JSON.stringify(err)}`);
    }
}


let allCourses = [];


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
window.renderCourses = function() {
    const container = document.getElementById('coursesListContainer');
    if (!container) return;
    
    if (allCourses.length === 0) {
        container.innerHTML = `
            <div class="col-span-full glass-panel rounded-2xl p-6 text-center py-12 text-outline" data-i18n="no_courses_yet">
                ${currentLang === 'ar' ? 'لا توجد كورسات في المكتبة حتى الآن.' : 'No courses in library yet.'}
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    allCourses.forEach(course => {
        const daysCount = Array.isArray(course.days_data) ? course.days_data.length : 0;
        const dateObj = new Date(course.created_at);
        const dateStr = `${dateObj.getFullYear()}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}`;
        
        const card = document.createElement('div');
        card.className = 'glass-panel rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-[var(--primary-color)] transition-colors duration-300';
        
        card.innerHTML = `
            <div class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)] opacity-10 rounded-bl-full z-0"></div>
            ${course.cover_image ? `<div class="absolute top-0 left-0 right-0 h-32 z-0 opacity-40"><img src="${course.cover_image}" class="w-full h-full object-cover"></div><div class="absolute top-0 left-0 right-0 h-32 z-0 bg-gradient-to-b from-transparent to-[var(--bg-color)]"></div>` : ''}
            
            <div class="relative z-10">
                <h3 class="text-xl font-bold text-on-surface mb-2">${course.name}</h3>
                <div class="flex flex-col gap-1 text-sm text-outline">
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
            
            <div class="mt-auto pt-4 border-t border-separator flex justify-between relative z-10">
                <button onclick="openAssignModal('${course.id}')" class="text-[var(--primary-color)] hover:text-white flex items-center gap-1 text-sm transition-colors" title="${currentLang === 'ar' ? 'إسناد لمتدرب' : 'Assign to Client'}">
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
        `;
        container.appendChild(card);
    });
}

window.deleteCourse = async function(id) {
    if (!confirm(currentLang === 'ar' ? 'هل أنت متأكد من حذف هذا الكورس نهائياً؟' : 'Are you sure you want to delete this course?')) return;
    
    try {
        const { error } = await supabaseClient.from('courses').delete().eq('id', id);
        if (error) throw error;
        
        allCourses = allCourses.filter(c => c.id !== id);
        renderCourses();
        
    } catch (err) {
        console.error('Error deleting course:', err);
        alert(currentLang === 'ar' ? 'خطأ في الحذف.' : 'Error deleting.');
    }
}

// Ensure the code after this block is preserved
// Add a starter day when switching to create-course view for the first time
const originalSwitchView = switchView;
window.switchView = function(viewName) {
    originalSwitchView(viewName);
    if (viewName === 'create-course' && courseDaysCount === 0) {
        addCourseDay();
    }
}


window.allowDrop = function(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.add('border-[var(--color-primary)]', 'bg-[var(--color-primary)]/10');
    ev.currentTarget.classList.remove('border-separator');
}

window.dragLeave = function(ev) {
    ev.currentTarget.classList.remove('border-[var(--color-primary)]', 'bg-[var(--color-primary)]/10');
    ev.currentTarget.classList.add('border-separator');
}

window.dropExercise = function(ev, dayId) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('border-[var(--color-primary)]', 'bg-[var(--color-primary)]/10');
    ev.currentTarget.classList.add('border-separator');
    
    const exId = ev.dataTransfer.getData('text/plain');
    if (exId) {
        window.setActiveDay(dayId);
        window.addExerciseToDay(exId);
    }
}

const originalSwitchViewLib = window.switchView || function(){};
window.switchView = function(viewName) {
    if (typeof originalSwitchViewLib === 'function') originalSwitchViewLib(viewName);
    
    if (viewName === 'courses-library') {
        fetchCourses();
    }
}


window.previewCourseCover = function(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('courseCoverPreview');
    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
    } else {
        preview.src = '';
        preview.classList.add('hidden');
    }
}


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
                <input type="hidden" class="ex-video-url-hidden" value="${exObj.video_url || ''}">
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

window.assignCourseToProfileBox = async function() {
    try {
        const courseId = document.getElementById('fp-course-select-box').value;
        if (!courseId) {
            alert(currentLang === 'ar' ? "الرجاء اختيار كورس." : "Please select a course.");
            return;
        }
        const profileId = window.currentOpenedProfileId;
        const course = allCourses.find(c => c.id === courseId);
        
        // Save to supabase
        const btn = document.getElementById('assign-course-to-profile-btn');
        const oldText = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[14px]">sync</span>';
        
        try {
            const { error } = await supabaseClient.from('profiles').update({ current_course_id: course.id }).eq('id', profileId);
            if (error) throw error;
            
            // Keep client_courses table in sync
            await supabaseClient.from('client_courses')
                .update({ is_active: false })
                .eq('client_id', profileId)
                .eq('is_active', true);
                
            await supabaseClient.from('client_courses')
                .insert([{
                    client_id: profileId,
                    course_id: course.id,
                    is_active: true
                }]);
            
            profilesData[profileId].current_course_id = course.id;
            alert(currentLang === 'ar' ? "تم تعيين الكورس بنجاح!" : "Course assigned successfully!");
            openFullProfile(null, profileId); // Refresh modal to show updated course box
        } catch(err) {
            console.error(err);
            alert(currentLang === 'ar' ? "حدث خطأ أثناء الربط: " + err.message : "Error assigning course: " + err.message);
            if (btn) btn.innerHTML = oldText;
        }
    } catch(globalErr) {
        alert("CRITICAL ERROR: " + globalErr.message + "\n" + globalErr.stack);
    }
}

window.createCourseForProfileBox = function() {
    closeFullProfile();
    switchView('create-course');
    const traineeSelect = document.getElementById('courseClientSelect');
    if (traineeSelect) {
        Array.from(traineeSelect.options).forEach(opt => opt.selected = false);
        const opt = Array.from(traineeSelect.options).find(o => o.value === window.currentOpenedProfileId);
        if (opt) opt.selected = true;
        if(window.updateCustomCourseClientTags) window.updateCustomCourseClientTags();
    }
}
