import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Remove Sidebar link for courses
sidebar_link_pattern = r'                <!-- Training Courses -->\s+<button id="nav-courses".*?</div>\s+</button>'
html = re.sub(sidebar_link_pattern, '', html, flags=re.DOTALL)

# 2. Remove COURSES VIEW
courses_view_pattern = r'    <!-- COURSES VIEW -->.*?</div> <!-- End COURSES VIEW -->'
html = re.sub(courses_view_pattern, '', html, flags=re.DOTALL)

# 3. Remove Course Builder Modal
course_builder_pattern = r'    <!-- Course Builder Modal -->.*?</div>\s+</div>\s+</div>'
# Need to be careful with nested divs. Better to find exactly where it ends.
# Let's find the start of the modal and the start of the next section.
start_idx = html.find('<!-- Course Builder Modal -->')
if start_idx != -1:
    end_idx = html.find('<!-- Exercise Selection Modal -->', start_idx)
    if end_idx != -1:
        html = html[:start_idx] + html[end_idx:]

# 4. Remove Exercise Selection Modal
exercise_selection_pattern = r'    <!-- Exercise Selection Modal -->.*?</div>\s+</div>\s+</div>'
start_idx = html.find('<!-- Exercise Selection Modal -->')
if start_idx != -1:
    end_idx = html.find('<!-- Full Profile Modal -->', start_idx)
    if end_idx != -1:
        html = html[:start_idx] + html[end_idx:]

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Updated index.html")

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# Remove switchView logic for courses
js = js.replace("""    } else if (viewName === 'courses') {
        if (coursesView) coursesView.classList.remove('hidden');
        if (navCourses) {
            navCourses.classList.remove('text-outline', 'border-transparent');
            navCourses.classList.add('text-[var(--color-primary)]', 'bg-[var(--color-primary)]/10', 'border-[var(--color-primary)]/20', 'shadow-sm');
        }""", "")

# Remove functions
funcs_to_remove = [
    "function openCourseBuilder",
    "function closeCourseBuilder",
    "function onTraineeSelected",
    "function addCourseWeek",
    "function addCourseDay",
    "function extractYouTubeID",
    "function renderModalExercises",
    "function filterModalExercises",
    "function addExerciseToDay",
    "function closeExerciseSelectionModal",
    "function openExerciseSelectionModal"
]

# A simple regex to remove function definitions up to their matching closing brace is complex in regex.
# Let's just truncate app.js from the point where the first of these appears, IF we added them all at the end.
# Actually, I added them manually inside the file. Let's find them.
# The easiest way is to find the marker `// ==========================================` before `function openCourseBuilder` maybe?
# Let's search app.js text manually and use string replacement or regex.

for func in funcs_to_remove:
    # Match function name(args) { ... }
    # This is risky if it has nested braces.
    pass

