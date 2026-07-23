import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

modal_html = """
    <!-- Assign Course Modal -->
    <div id="assignModal" class="fixed inset-0 z-50 flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300 bg-black/50 backdrop-blur-sm p-4 md:p-8">
        <div class="glass-panel rounded-2xl w-full max-w-md shadow-2xl transform scale-95 transition-transform duration-300 max-h-[95vh] flex flex-col" id="assignModalContent">
            <div class="flex justify-between items-center p-6 border-b border-separator shrink-0">
                <h3 class="text-lg font-bold text-on-surface flex items-center gap-2">
                    <span class="material-symbols-outlined">person_add</span>
                    <span data-i18n="assign_course">إسناد الكورس للمتدربين</span>
                </h3>
                <button onclick="closeAssignModal()" class="text-outline hover:text-error transition-colors p-2 rounded-full hover:bg-[var(--hover-bg)]">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto custom-scrollbar flex-1">
                <p class="text-sm text-outline mb-4" data-i18n="select_clients_to_assign">اختر المتدربين الذين تود إسناد هذا الكورس لهم:</p>
                <div id="assignClientsList" class="flex flex-col gap-2">
                    <!-- Checkboxes injected here -->
                </div>
            </div>
            
            <div class="p-6 border-t border-separator shrink-0 flex gap-4">
                <button onclick="closeAssignModal()" class="flex-1 py-3 px-6 rounded-xl font-bold text-on-surface hover:bg-[var(--hover-bg)] border border-separator transition-all duration-300" data-i18n="cancel">
                    إلغاء
                </button>
                <button onclick="saveAssignments()" class="flex-1 py-3 px-6 rounded-xl font-bold text-white bg-[var(--primary-color)] hover:bg-opacity-90 shadow-lg shadow-[var(--primary-color)]/20 transition-all duration-300 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined">save</span>
                    <span data-i18n="save">حفظ</span>
                </button>
            </div>
        </div>
    </div>
"""

# Insert modal at the end of the body if not exists
if 'id="assignModal"' not in html:
    html = html.replace('</body>', modal_html + '\n</body>')
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Injected assignModal into index.html")

