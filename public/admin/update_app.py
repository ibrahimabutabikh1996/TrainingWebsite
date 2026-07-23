with open("app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '// --- Interactive Body Map Logic ---' in line:
        start_idx = i
    if 'function openExerciseModal(id = null)' in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_content = """// --- Interactive Body Map Logic ---
let selectedMuscleTarget = '';

const allMuscles = [
    'صدر', 'ظهر', 'ترابيس', 'قطنية', 'أكتاف', 'أكتاف خلفية',
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
            <span class="text-xs mt-2 font-bold text-outline text-center">${muscle}</span>
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
        if (el.dataset.muscle === muscleAr && muscleAr !== 'لم يتم التحديد') {
            el.classList.remove('border-transparent');
            el.classList.add('border-[var(--color-primary)]', 'bg-[var(--color-primary)]/10');
            el.querySelector('img').classList.add('drop-shadow-[0_0_12px_var(--color-primary)]');
        } else {
            el.classList.add('border-transparent');
            el.classList.remove('border-[var(--color-primary)]', 'bg-[var(--color-primary)]/10');
            el.querySelector('img').classList.remove('drop-shadow-[0_0_12px_var(--color-primary)]');
        }
    });
}

"""
    
    lines = lines[:start_idx] + [new_content] + lines[end_idx:]
    
    with open("app.js", "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("Success replacing selectMuscle logic")
else:
    print(f"Failed to find boundaries {start_idx} {end_idx}")
