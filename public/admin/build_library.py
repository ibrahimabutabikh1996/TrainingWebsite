import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Replace the inner div of courses library with a grid
old_container = """        <div class="glass-panel rounded-2xl p-6 min-h-[500px]">
            <div class="text-center py-12 text-outline" data-i18n="no_courses_yet">
                لا توجد كورسات في المكتبة حتى الآن.
            </div>
        </div>"""

new_container = """        <div id="coursesListContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[500px] content-start">
            <div class="col-span-full glass-panel rounded-2xl p-6 text-center py-12 text-outline" id="noCoursesMsg" data-i18n="no_courses_yet">
                لا توجد كورسات في المكتبة حتى الآن.
            </div>
        </div>"""

if 'id="coursesListContainer"' not in html:
    html = html.replace(old_container, new_container)
    # Just in case the old container didn't match perfectly, use a regex
    if 'id="coursesListContainer"' not in html:
        html = re.sub(
            r'<div class="glass-panel rounded-2xl p-6 min-h-\[500px\]">.*?</div>\s*</div>',
            new_container + "\n    </div>",
            html, flags=re.DOTALL
        )
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Updated index.html to add grid container")

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

library_logic = """
let allCourses = [];

window.fetchCourses = async function() {
    try {
        const { data, error } = await supabaseClient
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        allCourses = data || [];
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
            
            <div class="relative z-10">
                <h3 class="text-xl font-bold text-on-surface mb-2">${course.name}</h3>
                <div class="flex flex-col gap-1 text-sm text-outline">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[16px]">calendar_month</span>
                        <span>${daysCount} ${currentLang === 'ar' ? 'أيام تدريبية' : 'Training Days'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[16px]">schedule</span>
                        <span dir="ltr">${dateStr}</span>
                    </div>
                </div>
            </div>
            
            <div class="mt-auto pt-4 border-t border-separator flex justify-between relative z-10">
                <!-- Assign Button (Placeholder) -->
                <button onclick="alert('سيتوفر خيار التعيين قريباً')" class="text-[var(--primary-color)] hover:text-white flex items-center gap-1 text-sm transition-colors" title="${currentLang === 'ar' ? 'إسناد لمتدرب' : 'Assign to Client'}">
                    <span class="material-symbols-outlined text-[18px]">person_add</span>
                    <span>${currentLang === 'ar' ? 'إسناد' : 'Assign'}</span>
                </button>
                
                <div class="flex gap-2">
                    <button onclick="alert('سيتوفر التعديل قريباً')" class="text-outline hover:text-[var(--primary-color)] transition-colors p-1" title="${currentLang === 'ar' ? 'تعديل' : 'Edit'}">
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
"""

if 'window.fetchCourses = async function()' not in js:
    start_idx = js.find('// Ensure the code after this block is preserved')
    if start_idx != -1:
        js = js[:start_idx] + library_logic + "\n" + js[start_idx:]
    else:
        js += "\n" + library_logic
        
    # Hook it to switchView
    if 'if (viewName === \'courses-library\')' not in js:
        # replace the originalSwitchView assignment
        switch_view_override = """
const originalSwitchViewLib = window.switchView || function(){};
window.switchView = function(viewName) {
    if (typeof originalSwitchViewLib === 'function') originalSwitchViewLib(viewName);
    
    if (viewName === 'courses-library') {
        fetchCourses();
    }
}
"""
        js += switch_view_override
        
    with open("app.js", "w", encoding="utf-8") as f:
        f.write(js)
    print("Injected course library logic")
