import re

with open("index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace Basic Info grid
old_grid = """                        <div class="grid grid-cols-1 gap-4">
                            <div>
                                <label class="block text-xs text-outline mb-1 font-medium">اسم الكورس *</label>
                                <input type="text" id="course-name" class="w-full glass-child border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)]" placeholder="مثال: تضخيم شامل في 4 أسابيع">
                            </div>
                            <div>
                                <label class="block text-xs text-outline mb-1 font-medium">وصف الكورس / الهدف</label>
                                <textarea id="course-desc" rows="2" class="w-full glass-child border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)] custom-scrollbar" placeholder="شرح مبسط عن الهدف من هذا الكورس..."></textarea>
                            </div>
                        </div>"""

new_grid = """                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="md:col-span-2">
                                <label class="block text-xs text-outline mb-1 font-medium">اختيار المتدرب *</label>
                                <div class="relative">
                                    <select id="course-trainee" class="w-full glass-child border border-separator rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)] bg-transparent appearance-none" onchange="onTraineeSelected(this.value)">
                                        <option class="bg-[var(--bg-color)] text-on-surface" value="">-- اختر المتدرب --</option>
                                    </select>
                                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">expand_more</span>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs text-outline mb-1 font-medium">اسم الكورس *</label>
                                <input type="text" id="course-name" class="w-full glass-child border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)]" placeholder="مثال: تضخيم شامل في 4 أسابيع">
                            </div>
                            <div>
                                <label class="block text-xs text-outline mb-1 font-medium">وصف الكورس / الهدف</label>
                                <textarea id="course-desc" rows="1" class="w-full glass-child border border-separator rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-[var(--color-primary)] custom-scrollbar" placeholder="شرح مبسط عن الهدف من هذا الكورس..."></textarea>
                            </div>
                        </div>"""

content = content.replace(old_grid, new_grid)

# Inject Exercise Selection Modal before Full Profile Modal
modal_html = """
    <!-- Exercise Selection Modal -->
    <div id="exerciseSelectionModal" class="fixed inset-0 z-[70] flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300 bg-black/60 backdrop-blur-sm p-4">
        <div class="glass-panel rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl transform scale-95 transition-transform duration-300 flex flex-col" id="exerciseSelectionContent">
            <!-- Header -->
            <div class="flex justify-between items-center p-4 border-b border-separator shrink-0 bg-[var(--hover-bg)] rounded-t-2xl">
                <h3 class="text-lg font-bold text-on-surface flex items-center gap-2">
                    <span class="material-symbols-outlined text-[var(--color-primary)]">fitness_center</span>
                    اختر تمريناً للجدول
                </h3>
                <div class="flex items-center gap-4 w-1/2 max-w-md">
                    <div class="relative flex-1">
                        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                        <input type="text" id="modalSearchExercise" class="w-full bg-[var(--bg-color)] text-on-surface border border-separator rounded-full py-2 pr-9 pl-4 text-sm focus:outline-none focus:border-[var(--color-primary)]" placeholder="ابحث عن تمرين..." onkeyup="filterModalExercises()">
                    </div>
                    <button onclick="closeExerciseSelectionModal()" class="text-outline hover:text-error transition-colors p-1 rounded-full hover:bg-[var(--hover-bg)]">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
            <!-- Body -->
            <div class="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[var(--bg-color)]/30 rounded-b-2xl">
                <div id="modal-exercises-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    <!-- Populated dynamically -->
                </div>
            </div>
        </div>
    </div>
"""

profile_modal_marker = "<!-- Full Profile Modal -->"
content = content.replace(profile_modal_marker, modal_html + "\n    " + profile_modal_marker)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated index.html")
