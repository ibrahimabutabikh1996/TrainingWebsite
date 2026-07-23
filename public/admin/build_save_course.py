import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Make the client select multiple
if 'id="courseClientSelect" class="w-full' in html and 'multiple' not in html:
    html = html.replace('id="courseClientSelect" class="w-full', 'id="courseClientSelect" multiple class="w-full h-24')
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Updated index.html to support multiple clients")

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

save_logic = """
window.saveCourse = async function() {
    const courseName = document.getElementById('courseNameInput').value.trim();
    if (!courseName) {
        alert(currentLang === 'ar' ? 'الرجاء كتابة اسم الكورس!' : 'Please enter a course name!');
        return;
    }
    
    // Gather days data
    const days = [];
    const dayDivs = document.querySelectorAll('#courseDaysContainer > div');
    
    dayDivs.forEach((dayDiv, dayIndex) => {
        const dayObj = {
            day_number: dayIndex + 1,
            exercises: []
        };
        
        // Find all exercise rows in this day
        const exRows = dayDiv.querySelectorAll('.day-exercises > div.flex-col'); // They have flex-col now
        exRows.forEach((row, exIndex) => {
            const exName = row.querySelector('h5').innerText;
            const exCategory = row.querySelector('span.rounded-full').innerText;
            
            const exObj = {
                order: exIndex + 1,
                name: exName,
                category: exCategory,
                sets: []
            };
            
            // Check for sets
            const setsContainer = row.querySelector('[id^="sets-container"]');
            if (setsContainer) {
                const setRows = setsContainer.querySelectorAll('.set-row');
                setRows.forEach((sRow, sIndex) => {
                    const inputs = sRow.querySelectorAll('input');
                    if (inputs.length >= 3) {
                        exObj.sets.push({
                            set_number: sIndex + 1,
                            reps: inputs[0].value,
                            rest: inputs[1].value,
                            note: inputs[2].value
                        });
                    }
                });
            } else {
                // Cardio / Stretch logic
                const inputs = row.querySelectorAll('input');
                if (inputs.length >= 2) {
                    exObj.time = inputs[0].value;
                    exObj.note = inputs[1].value;
                }
            }
            
            dayObj.exercises.push(exObj);
        });
        
        days.push(dayObj);
    });
    
    // Gather selected clients
    const clientSelect = document.getElementById('courseClientSelect');
    const selectedClients = Array.from(clientSelect.selectedOptions).map(opt => opt.value).filter(val => val !== '');
    
    try {
        // 1. Insert into courses table
        const user = supabaseClient.auth.user();
        if (!user) throw new Error("Not logged in");
        
        const { data: courseData, error: courseError } = await supabaseClient
            .from('courses')
            .insert([{
                coach_id: user.id,
                name: courseName,
                days_data: days
            }]);
            
        if (courseError) throw courseError;
        
        const newCourseId = courseData[0].id;
        
        // 2. If clients selected, manage assignment history
        if (selectedClients.length > 0) {
            
            // For each client, deactivate old courses
            for (const cId of selectedClients) {
                await supabaseClient
                    .from('client_courses')
                    .update({ is_active: false })
                    .eq('client_id', cId)
                    .eq('is_active', true);
                    
                // Insert new assignment
                await supabaseClient
                    .from('client_courses')
                    .insert([{
                        client_id: cId,
                        course_id: newCourseId,
                        is_active: true
                    }]);
                    
                // Update profile current_course_id
                await supabaseClient
                    .from('profiles')
                    .update({ current_course_id: newCourseId })
                    .eq('id', cId);
            }
        }
        
        alert(currentLang === 'ar' ? 'تم حفظ الكورس بنجاح!' : 'Course saved successfully!');
        
        // Clear form
        document.getElementById('courseNameInput').value = '';
        document.getElementById('courseDaysContainer').innerHTML = '';
        courseDaysCount = 0;
        addCourseDay(); // Add day 1 back
        
    } catch (err) {
        console.error('Error saving course:', err);
        alert(currentLang === 'ar' ? 'حدث خطأ أثناء الحفظ. تأكد من إعداد جدول قاعدة البيانات.' : 'Error saving course.');
    }
}
"""

if 'window.saveCourse = async function()' not in js:
    start_idx = js.find('// Ensure the code after this block is preserved')
    if start_idx != -1:
        js = js[:start_idx] + save_logic + "\n" + js[start_idx:]
        with open("app.js", "w", encoding="utf-8") as f:
            f.write(js)
        print("Injected saveCourse logic")
