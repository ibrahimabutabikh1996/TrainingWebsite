import re

# 1. Update index.html
with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Sidebar navs
navs = """
                <button id="nav-create-course" onclick="switchView('create-course')" class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-outline hover:text-on-surface hover:bg-[var(--hover-bg)] group transition-colors border border-transparent shadow-none nav-btn mt-2">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-[20px]">add_box</span>
                        <span class="font-medium" data-i18n="nav_create_course">إنشاء كورس</span>
                    </div>
                </button>

                <button id="nav-courses-library" onclick="switchView('courses-library')" class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-outline hover:text-on-surface hover:bg-[var(--hover-bg)] group transition-colors border border-transparent shadow-none nav-btn mt-2">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-[20px]">library_books</span>
                        <span class="font-medium" data-i18n="nav_courses_library">مكتبة الكورسات</span>
                    </div>
                </button>
"""
# Insert after nav-exercises
exercises_nav = html.find('id="nav-exercises"')
end_exercises_nav = html.find('</button>', exercises_nav) + len('</button>')
html = html[:end_exercises_nav] + navs + html[end_exercises_nav:]

# Views
views = """
    <!-- CREATE COURSE VIEW -->
    <div id="create-course-view" class="hidden">
        <header class="mb-8">
            <h2 class="text-3xl font-bold text-on-surface mb-1" data-i18n="create_course_title">إنشاء كورس</h2>
            <p class="text-outline text-sm" data-i18n="create_course_desc">قم بتصميم وتخصيص كورس جديد لمتدربك.</p>
        </header>
        <div class="glass-panel rounded-2xl p-6 min-h-[500px] flex items-center justify-center">
            <button class="bg-[var(--color-primary)] text-[var(--bg-color)] px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg">
                <span class="material-symbols-outlined">add_circle</span>
                <span data-i18n="start_creating">البدء في الإنشاء</span>
            </button>
        </div>
    </div>

    <!-- COURSES LIBRARY VIEW -->
    <div id="courses-library-view" class="hidden">
        <header class="mb-8">
            <h2 class="text-3xl font-bold text-on-surface mb-1" data-i18n="courses_library_title">مكتبة الكورسات</h2>
            <p class="text-outline text-sm" data-i18n="courses_library_desc">تصفح وإدارة الكورسات التي قمت بإنشائها مسبقاً.</p>
        </header>
        <div class="glass-panel rounded-2xl p-6 min-h-[500px]">
            <div class="text-center py-12 text-outline" data-i18n="no_courses_yet">
                لا توجد كورسات في المكتبة حتى الآن.
            </div>
        </div>
    </div>
"""
# Insert before </main>
main_end = html.find('</main>')
html = html[:main_end] + views + html[main_end:]

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)


# 2. Update app.js switchView function
with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

switch_logic = """function switchView(viewName) {
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
}"""

# Replace old switchView block
start_idx = js.find('function switchView(viewName) {')
end_idx = js.find('// ==========================================', start_idx)
if start_idx != -1 and end_idx != -1:
    js = js[:start_idx] + switch_logic + '\n\n' + js[end_idx:]

# 3. Add Translations
ar_dict = """        // Courses UI
        nav_create_course: "إنشاء كورس",
        nav_courses_library: "مكتبة الكورسات",
        create_course_title: "إنشاء كورس",
        create_course_desc: "قم بتصميم وتخصيص كورس جديد لمتدربك.",
        start_creating: "البدء في الإنشاء",
        courses_library_title: "مكتبة الكورسات",
        courses_library_desc: "تصفح وإدارة الكورسات التي قمت بإنشائها مسبقاً.",
        no_courses_yet: "لا توجد كورسات في المكتبة حتى الآن.",
"""
en_dict = """        // Courses UI
        nav_create_course: "Create Course",
        nav_courses_library: "Courses Library",
        create_course_title: "Create Course",
        create_course_desc: "Design and customize a new course for your client.",
        start_creating: "Start Creating",
        courses_library_title: "Courses Library",
        courses_library_desc: "Browse and manage the courses you created previously.",
        no_courses_yet: "No courses in the library yet.",
"""

js = js.replace('// Common\n        cancel: "إلغاء",', ar_dict + '        // Common\n        cancel: "إلغاء",')
js = js.replace('// Common\n        cancel: "Cancel",', en_dict + '        // Common\n        cancel: "Cancel",')

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Injected views and logic")
