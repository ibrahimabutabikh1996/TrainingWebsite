import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Replace the create-course-view dummy with the real one
new_view = """
    <!-- CREATE COURSE VIEW -->
    <div id="create-course-view" class="hidden h-full flex flex-col">
        <header class="mb-4">
            <h2 class="text-3xl font-bold text-on-surface mb-1" data-i18n="create_course_title">إنشاء كورس</h2>
            <p class="text-outline text-sm" data-i18n="create_course_desc">قم بتصميم وتخصيص كورس جديد لمتدربك.</p>
        </header>
        
        <div class="flex-1 flex gap-6 overflow-hidden">
            
            <!-- Left Side: Course Info & Schedule -->
            <div class="w-full lg:w-2/3 flex flex-col gap-4">
                <!-- Course Info Card -->
                <div class="glass-panel rounded-2xl p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-medium text-outline mb-1" data-i18n="course_client">المتدرب (اختياري)</label>
                            <select id="courseClientSelect" class="w-full bg-[var(--bg-color)] border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)] outline-none">
                                <option value="" data-i18n="general_course">-- كورس عام / بدون متدرب --</option>
                                <!-- Injected from DB -->
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-outline mb-1" data-i18n="course_name_label">اسم الكورس *</label>
                            <input type="text" id="courseNameInput" class="w-full bg-transparent border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)]" placeholder="تضخيم 4 أسابيع" data-i18n-placeholder="course_name_ph">
                        </div>
                    </div>
                </div>

                <!-- Schedule Card -->
                <div class="glass-panel rounded-2xl p-6 flex-1 flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold text-on-surface" data-i18n="training_schedule">جدول التدريب</h3>
                        <button onclick="addCourseDay()" class="text-[var(--color-primary)] text-sm font-bold flex items-center gap-1 hover:opacity-80 transition-opacity">
                            <span class="material-symbols-outlined text-[18px]">add</span>
                            <span data-i18n="add_day">إضافة يوم</span>
                        </button>
                    </div>
                    
                    <!-- Days Container -->
                    <div id="courseDaysContainer" class="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 ltr:pr-2 rtl:pl-2 pb-4">
                        <!-- Days injected here -->
                    </div>
                    
                    <div class="mt-4 pt-4 border-t border-separator flex justify-end">
                        <button onclick="saveCourse()" class="bg-[var(--color-primary)] text-[var(--bg-color)] px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg">
                            <span class="material-symbols-outlined text-[18px]">save</span>
                            <span data-i18n="save_course">حفظ الكورس</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Right Side: Mini Exercises Library -->
            <div class="w-full lg:w-1/3 flex flex-col">
                <div class="glass-panel rounded-2xl p-4 flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                    <h3 class="text-md font-bold text-on-surface mb-3 flex items-center gap-2">
                        <span class="material-symbols-outlined text-[20px] text-[var(--color-primary)]">fitness_center</span>
                        <span data-i18n="exercises_library_mini">مكتبة التمارين</span>
                    </h3>
                    
                    <!-- Mini Filters -->
                    <div class="flex gap-2 mb-3">
                        <input type="text" id="miniExSearch" oninput="renderMiniExercises()" placeholder="ابحث..." data-i18n-placeholder="mini_search_ph" class="flex-1 bg-transparent border border-separator rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-[var(--color-primary)]">
                        <select id="miniExCategory" onchange="renderMiniExercises()" class="bg-[var(--bg-color)] border border-separator rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none">
                            <option value="الكل" data-i18n="cat_all">الكل</option>
                            <option value="مقاومة" data-i18n="cat_resistance">مقاومة</option>
                            <option value="بوزن الجسم" data-i18n="cat_bodyweight">بوزن الجسم</option>
                            <option value="كارديو" data-i18n="cat_cardio">كارديو</option>
                            <option value="إطالة" data-i18n="cat_stretching">إطالة</option>
                        </select>
                    </div>
                    
                    <!-- Mini Grid -->
                    <div id="mini-exercises-grid" class="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 ltr:pr-2 rtl:pl-2">
                        <!-- Mini exercises go here -->
                        <div class="py-8 text-center text-outline text-sm" data-i18n="loading_exercises">
                            جاري سحب التمارين...
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
"""

start_str = '    <!-- CREATE COURSE VIEW -->'
end_str = '    <!-- COURSES LIBRARY VIEW -->'

start_idx = html.find(start_str)
end_idx = html.find(end_str)

if start_idx != -1 and end_idx != -1:
    html = html[:start_idx] + new_view + '\n' + html[end_idx:]

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
    
print("Updated index.html")
