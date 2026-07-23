import re

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# 1. Update renderMiniExercises card logic
old_card = 'card.className = "glass-child p-3 rounded-xl border border-separator hover:border-[var(--color-primary)]/50 transition-colors flex items-center justify-between gap-2";'
new_card = """card.className = "glass-child p-3 rounded-xl border border-separator hover:border-[var(--color-primary)]/50 transition-colors flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing";
        card.draggable = true;
        card.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', ex.id);
            e.dataTransfer.effectAllowed = 'copy';
        };"""
js = js.replace(old_card, new_card)

# 2. Update addCourseDay HTML logic
old_day_exercises = """<div class="day-exercises flex flex-col gap-2 min-h-[50px] border border-dashed border-separator rounded-lg p-2 flex items-center justify-center text-outline text-xs text-center">
            ${currentLang === 'ar' ? 'قم بتحديد هذا اليوم ثم اضغط (+) على التمارين من المكتبة لإضافتها هنا' : 'Select this day and press (+) on exercises to add them here'}
        </div>"""
        
new_day_exercises = """<div class="day-exercises flex flex-col gap-2 min-h-[80px] border-2 border-dashed border-separator rounded-lg p-2 flex items-center justify-center text-outline text-xs text-center transition-all"
             ondragover="window.allowDrop(event)"
             ondragleave="window.dragLeave(event)"
             ondrop="window.dropExercise(event, '${dayId}')">
            ${currentLang === 'ar' ? 'اسحب التمارين وأفلتها هنا، أو اضغط (+) للإضافة' : 'Drag and drop exercises here, or click (+)'}
        </div>"""

js = js.replace(old_day_exercises, new_day_exercises)

# 3. Add drag & drop functions
dnd_functions = """
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
"""

if 'window.allowDrop = function' not in js:
    js += '\n' + dnd_functions

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Drag and Drop implemented.")
