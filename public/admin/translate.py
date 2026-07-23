import re

# 1. Update app.js translations
with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

en_additions = """        exercises_base: "Exercises Base",
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
"""

ar_additions = """        exercises_base: "قاعدة التمارين",
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
"""

# Inject into en: { ... }
js = js.replace('error_fetch: "Error fetching data. Please refresh."\n    }', f'error_fetch: "Error fetching data. Please refresh.",\n{en_additions}    }}')

# Inject into ar: { ... }
js = js.replace('error_fetch: "حدث خطأ أثناء جلب البيانات. الرجاء تحديث الصفحة."\n    }', f'error_fetch: "حدث خطأ أثناء جلب البيانات. الرجاء تحديث الصفحة.",\n{ar_additions}    }}')

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)

# 2. Update index.html data-i18n tags
with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

replacements = {
    '<span class="font-medium">قاعدة التمارين</span>': '<span class="font-medium" data-i18n="exercises_base">قاعدة التمارين</span>',
    'placeholder="ابحث عن متدرب..."': 'placeholder="ابحث عن متدرب..." data-i18n-placeholder="search_trainee"',
    '<h2 class="text-3xl font-bold text-on-surface mb-1">قاعدة التمارين</h2>': '<h2 class="text-3xl font-bold text-on-surface mb-1" data-i18n="exercises_base">قاعدة التمارين</h2>',
    '<p class="text-outline text-sm">أضف، عدل، وقم بإدارة كافة التمارين المتوفرة لديك.</p>': '<p class="text-outline text-sm" data-i18n="exercises_desc">أضف، عدل، وقم بإدارة كافة التمارين المتوفرة لديك.</p>',
    'placeholder="ابحث عن تمرين..."': 'placeholder="ابحث عن تمرين..." data-i18n-placeholder="search_exercise"',
    '<span class="text-sm font-bold">تمرين جديد</span>': '<span class="text-sm font-bold" data-i18n="new_exercise">تمرين جديد</span>',
    'value="الكل" class="bg-[var(--bg-color)]">كل الأنواع': 'value="الكل" class="bg-[var(--bg-color)]" data-i18n="cat_all">كل الأنواع',
    'value="مقاومة" class="bg-[var(--bg-color)]">مقاومة (حديد)': 'value="مقاومة" class="bg-[var(--bg-color)]" data-i18n="cat_resistance">مقاومة (حديد)',
    'value="بوزن الجسم" class="bg-[var(--bg-color)]">بوزن الجسم': 'value="بوزن الجسم" class="bg-[var(--bg-color)]" data-i18n="cat_bodyweight">بوزن الجسم',
    'value="كارديو" class="bg-[var(--bg-color)]">كارديو': 'value="كارديو" class="bg-[var(--bg-color)]" data-i18n="cat_cardio">كارديو',
    'value="إطالة" class="bg-[var(--bg-color)]">إطالة': 'value="إطالة" class="bg-[var(--bg-color)]" data-i18n="cat_stretching">إطالة',
    'value="الكل" class="bg-[var(--bg-color)]">كل العضلات': 'value="الكل" class="bg-[var(--bg-color)]" data-i18n="muscle_all">كل العضلات',
    'value="صدر" class="bg-[var(--bg-color)]">صدر': 'value="صدر" class="bg-[var(--bg-color)]" data-i18n="muscle_chest">صدر',
    'value="ظهر" class="bg-[var(--bg-color)]">ظهر': 'value="ظهر" class="bg-[var(--bg-color)]" data-i18n="muscle_back">ظهر',
    'value="أكتاف" class="bg-[var(--bg-color)]">أكتاف': 'value="أكتاف" class="bg-[var(--bg-color)]" data-i18n="muscle_shoulders">أكتاف',
    'value="أكتاف خلفية" class="bg-[var(--bg-color)]">أكتاف خلفية': 'value="أكتاف خلفية" class="bg-[var(--bg-color)]" data-i18n="muscle_rear_delts">أكتاف خلفية',
    'value="ترابيس" class="bg-[var(--bg-color)]">ترابيس': 'value="ترابيس" class="bg-[var(--bg-color)]" data-i18n="muscle_traps">ترابيس',
    'value="قطنية" class="bg-[var(--bg-color)]">قطنية': 'value="قطنية" class="bg-[var(--bg-color)]" data-i18n="muscle_lower_back">قطنية',
    'value="بايسبس" class="bg-[var(--bg-color)]">بايسبس': 'value="بايسبس" class="bg-[var(--bg-color)]" data-i18n="muscle_biceps">بايسبس',
    'value="ترايسبس" class="bg-[var(--bg-color)]">ترايسبس': 'value="ترايسبس" class="bg-[var(--bg-color)]" data-i18n="muscle_triceps">ترايسبس',
    'value="سواعد" class="bg-[var(--bg-color)]">سواعد': 'value="سواعد" class="bg-[var(--bg-color)]" data-i18n="muscle_forearms">سواعد',
    'value="معدة" class="bg-[var(--bg-color)]">معدة': 'value="معدة" class="bg-[var(--bg-color)]" data-i18n="muscle_abs">معدة',
    'value="خواصر" class="bg-[var(--bg-color)]">خواصر': 'value="خواصر" class="bg-[var(--bg-color)]" data-i18n="muscle_obliques">خواصر',
    'value="أفخاذ أمامية" class="bg-[var(--bg-color)]">أفخاذ أمامية': 'value="أفخاذ أمامية" class="bg-[var(--bg-color)]" data-i18n="muscle_quads">أفخاذ أمامية',
    'value="أفخاذ خلفية" class="bg-[var(--bg-color)]">أفخاذ خلفية': 'value="أفخاذ خلفية" class="bg-[var(--bg-color)]" data-i18n="muscle_hamstrings">أفخاذ خلفية',
    'value="سمانة" class="bg-[var(--bg-color)]">سمانة': 'value="سمانة" class="bg-[var(--bg-color)]" data-i18n="muscle_calves">سمانة',
    'value="أرداف" class="bg-[var(--bg-color)]">أرداف': 'value="أرداف" class="bg-[var(--bg-color)]" data-i18n="muscle_glutes">أرداف',
    'value="عام" class="bg-[var(--bg-color)]">عام': 'value="عام" class="bg-[var(--bg-color)]" data-i18n="muscle_general">عام',
    '<span id="ex-modal-title">إضافة تمرين جديد</span>': '<span id="ex-modal-title" data-i18n="add_new_exercise">إضافة تمرين جديد</span>',
    '<div id="selected-muscle-label" class="inline-block px-4 py-1.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-sm border border-[var(--color-primary)]/20 min-w-[120px] transition-all">لم يتم التحديد</div>': '<div id="selected-muscle-label" class="inline-block px-4 py-1.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-sm border border-[var(--color-primary)]/20 min-w-[120px] transition-all" data-i18n="not_selected">لم يتم التحديد</div>',
    '<label class="block text-xs text-outline mb-2 font-medium">نوع التمرين *</label>': '<label class="block text-xs text-outline mb-2 font-medium" data-i18n="exercise_type">نوع التمرين *</label>',
    '<label class="block text-xs text-outline mb-1 font-medium">اسم التمرين (عربي) *</label>': '<label class="block text-xs text-outline mb-1 font-medium" data-i18n="ex_name_ar">اسم التمرين (عربي) *</label>',
    '<label class="block text-xs text-outline mb-1 font-medium">اسم التمرين (إنجليزي) - اختياري</label>': '<label class="block text-xs text-outline mb-1 font-medium" data-i18n="ex_name_en">اسم التمرين (إنجليزي) - اختياري</label>',
    '<label class="block text-xs text-outline mb-1 font-medium">رابط فيديو (YouTube) - اختياري</label>': '<label class="block text-xs text-outline mb-1 font-medium" data-i18n="ex_video_url">رابط فيديو (YouTube) - اختياري</label>',
    '<label class="block text-xs text-outline mb-1 font-medium">ملاحظات / أداء التمرين</label>': '<label class="block text-xs text-outline mb-1 font-medium" data-i18n="ex_notes">ملاحظات / أداء التمرين</label>',
    '<button id="btn-save-ex" class="px-4 py-2 text-sm font-bold bg-[var(--color-primary)] text-[var(--bg-color)] rounded-lg shadow-sm flex items-center gap-2" onclick="saveExercise()">حفظ التمرين</button>': '<button id="btn-save-ex" class="px-4 py-2 text-sm font-bold bg-[var(--color-primary)] text-[var(--bg-color)] rounded-lg shadow-sm flex items-center gap-2" onclick="saveExercise()" data-i18n="btn_save">حفظ التمرين</button>',
    '<button class="px-4 py-2 text-sm font-bold text-outline hover:text-on-surface transition-colors" onclick="closeExerciseModal()">إلغاء</button>': '<button class="px-4 py-2 text-sm font-bold text-outline hover:text-on-surface transition-colors" onclick="closeExerciseModal()" data-i18n="btn_cancel">إلغاء</button>'
}

# Fix greedy match for generic texts by ensuring we only replace exact labels.
# In the Exercise Type labels:
html = html.replace('\n                                        مقاومة (حديد)', '\n                                        <span data-i18n="cat_resistance">مقاومة (حديد)</span>')
html = html.replace('\n                                        بوزن الجسم', '\n                                        <span data-i18n="cat_bodyweight">بوزن الجسم</span>')
html = html.replace('\n                                        كارديو', '\n                                        <span data-i18n="cat_cardio">كارديو</span>')
html = html.replace('\n                                        إطالة', '\n                                        <span data-i18n="cat_stretching">إطالة</span>')
html = html.replace('\n                                        حذف', '\n                                        <span data-i18n="btn_delete">حذف</span>')


for k, v in replacements.items():
    if k not in ['مقاومة (حديد)', 'بوزن الجسم', 'كارديو', 'إطالة', 'حذف', 'إلغاء', '<span data-i18n="btn_cancel">إلغاء</span>']:
        html = html.replace(k, v)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Updated index.html")
