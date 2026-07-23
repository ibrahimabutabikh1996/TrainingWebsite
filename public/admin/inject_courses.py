with open("index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

courses_view_html = """
    <!-- COURSES VIEW -->
    <div id="courses-view" class="hidden">
        <header class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
                <h2 class="text-3xl font-bold text-on-surface tracking-tight mb-2">كورسات التدريب</h2>
                <p class="text-sm text-outline">إنشاء وإدارة البرامج التدريبية المخصصة للمشتركين.</p>
            </div>
            <div class="flex items-center gap-3 w-full md:w-auto">
                <div class="relative flex-1 md:w-64">
                    <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
                    <input type="text" id="courseSearchInput" class="w-full bg-surface-variant text-on-surface border-none rounded-full py-2.5 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[var(--color-primary)] placeholder-outline" placeholder="ابحث عن كورس...">
                </div>
                <button onclick="openCourseBuilder()" class="glass-panel !bg-[var(--color-primary)] text-[var(--bg-color)] px-4 py-2 rounded-full flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap">
                    <span class="material-symbols-outlined">add</span>
                    <span class="font-bold text-sm">إنشاء كورس</span>
                </button>
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="courses-grid">
            <div class="col-span-full flex flex-col items-center justify-center py-20 text-center glass-panel rounded-2xl border-dashed border-2 border-separator bg-transparent">
                <div class="w-16 h-16 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] mb-4">
                    <span class="material-symbols-outlined text-3xl">assignment_add</span>
                </div>
                <h3 class="text-lg font-bold text-on-surface mb-2">لا توجد كورسات حالياً</h3>
                <p class="text-sm text-outline max-w-sm mb-6">قم بإنشاء برنامجك التدريبي الأول، وحدد الأيام والتمارين المخصصة للمشتركين.</p>
                <button onclick="openCourseBuilder()" class="px-6 py-2 bg-[var(--color-primary)] text-[var(--bg-color)] rounded-full font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined">add</span>
                    إنشاء كورس جديد
                </button>
            </div>
        </div>
    </div> <!-- End COURSES VIEW -->
"""

builder_modal_html = """
    <!-- Course Builder Modal (Full Screen) -->
    <div id="courseBuilderModal" class="fixed inset-0 z-[60] flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300 bg-black/80 backdrop-blur-md p-2 md:p-6">
        <div class="glass-panel rounded-2xl w-full h-full shadow-2xl transform scale-95 transition-transform duration-300 flex flex-col" id="courseBuilderContent">
            
            <!-- Header -->
            <div class="flex justify-between items-center p-4 border-b border-separator shrink-0 bg-[var(--hover-bg)] rounded-t-2xl">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)]">
                        <span class="material-symbols-outlined">edit_document</span>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-on-surface leading-tight">منشئ الكورسات</h3>
                        <p class="text-[10px] text-outline uppercase tracking-wider">Course Builder</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button class="px-4 py-2 text-sm font-bold text-outline hover:text-on-surface transition-colors" onclick="closeCourseBuilder()">إغلاق</button>
                    <button class="px-5 py-2 text-sm font-bold bg-[var(--color-success)] text-white rounded-lg shadow hover:shadow-lg transition-all flex items-center gap-2" onclick="saveCourse()">
                        <span class="material-symbols-outlined text-[18px]">save</span>
                        حفظ الكورس
                    </button>
                </div>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div class="max-w-5xl mx-auto space-y-8">
                    
                    <!-- Basic Info -->
                    <div class="glass-child p-6 rounded-xl">
                        <h4 class="text-md font-bold text-on-surface mb-4 flex items-center gap-2">
                            <span class="material-symbols-outlined text-[var(--color-primary)]">info</span>
                            المعلومات الأساسية
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs text-outline mb-1 font-medium">اسم الكورس *</label>
                                <input type="text" id="course-name" class="w-full glass-child border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)]" placeholder="مثال: تضخيم شامل في 4 أسابيع">
                            </div>
                            <div>
                                <label class="block text-xs text-outline mb-1 font-medium">مستوى الصعوبة</label>
                                <select id="course-level" class="w-full glass-child border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)] bg-transparent appearance-none">
                                    <option class="bg-[var(--bg-color)] text-on-surface" value="مبتدئ">مبتدئ</option>
                                    <option class="bg-[var(--bg-color)] text-on-surface" value="متوسط">متوسط</option>
                                    <option class="bg-[var(--bg-color)] text-on-surface" value="متقدم">متقدم</option>
                                </select>
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-xs text-outline mb-1 font-medium">وصف الكورس / الهدف</label>
                                <textarea id="course-desc" rows="2" class="w-full glass-child border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)] custom-scrollbar" placeholder="شرح مبسط عن الهدف من هذا الكورس..."></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Curriculum Builder -->
                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="text-md font-bold text-on-surface flex items-center gap-2">
                                <span class="material-symbols-outlined text-[var(--color-primary)]">view_timeline</span>
                                خطة التدريب (الأسابيع والأيام)
                            </h4>
                            <button onclick="addCourseWeek()" class="px-3 py-1.5 text-xs font-bold bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)]/20 transition-colors flex items-center gap-1 border border-[var(--color-primary)]/30">
                                <span class="material-symbols-outlined text-[16px]">add</span>
                                إضافة أسبوع جديد
                            </button>
                        </div>
                        
                        <!-- Weeks Container -->
                        <div id="course-weeks-container" class="space-y-4">
                            <!-- Populated dynamically -->
                            <div class="text-center py-8 text-outline text-sm italic">اضغط على "إضافة أسبوع جديد" للبدء بتصميم الجدول</div>
                        </div>
                    </div>
                    
                </div>
            </div>
            
        </div>
    </div>
"""

exercises_view_end_idx = -1
for i, line in enumerate(lines):
    if '<!-- End EXERCISES VIEW -->' in line:
        exercises_view_end_idx = i
        break

if exercises_view_end_idx != -1:
    lines.insert(exercises_view_end_idx + 1, courses_view_html + "\n")
    
    # Now find where to insert the modal (before Full Profile Modal)
    profile_modal_idx = -1
    for i, line in enumerate(lines):
        if '<!-- Full Profile Modal -->' in line:
            profile_modal_idx = i
            break
            
    if profile_modal_idx != -1:
        lines.insert(profile_modal_idx, builder_modal_html + "\n")
        
        with open("index.html", "w", encoding="utf-8") as f:
            f.writelines(lines)
        print("Successfully injected Courses View and Builder Modal")
    else:
        print("Failed to find Full Profile Modal")
else:
    print("Failed to find Exercises View")
