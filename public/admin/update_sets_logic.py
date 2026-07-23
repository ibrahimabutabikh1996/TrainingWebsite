import re

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# Replace addExerciseToDay
start_idx = js.find('window.addExerciseToDay = function(exId) {')
end_idx = js.find('window.switchView = function', start_idx)
if start_idx != -1 and end_idx != -1:
    new_logic = """window.addExerciseToDay = function(exId) {
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

// Ensure the code after this block is preserved
// Add a starter day when switching to create-course view for the first time
"""
    
    js = js[:start_idx] + new_logic + js[end_idx:]

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Updated exercise layout to support dynamic sets.")
