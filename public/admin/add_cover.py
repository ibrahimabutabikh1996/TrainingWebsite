import re

# Update index.html
with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

cover_html = """
                            <div class="mt-4">
                                <label class="block text-xs font-medium text-outline mb-1" data-i18n="course_cover_label">صورة غلاف الكورس (اختياري)</label>
                                <div class="flex items-center gap-4">
                                    <label for="courseCoverInput" class="cursor-pointer bg-[var(--surface-color)] border border-separator rounded-lg px-4 py-2 text-sm text-on-surface hover:bg-[var(--hover-bg)] transition-colors flex items-center gap-2">
                                        <span class="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                                        <span data-i18n="choose_image">اختر صورة</span>
                                    </label>
                                    <input type="file" id="courseCoverInput" accept="image/*" class="hidden" onchange="previewCourseCover(event)">
                                    <img id="courseCoverPreview" class="hidden w-16 h-16 object-cover rounded-lg border border-separator">
                                </div>
                            </div>
"""

# Insert cover_html right after the courseNameInput div
pattern = r'(<input type="text" id="courseNameInput".*?</div>)'
if 'id="courseCoverInput"' not in html:
    html = re.sub(pattern, r'\1' + "\n" + cover_html, html, count=1, flags=re.DOTALL)
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Updated index.html with cover input")


# Update app.js
with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# 1. Add previewCourseCover
preview_func = """
window.previewCourseCover = function(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('courseCoverPreview');
    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
    } else {
        preview.src = '';
        preview.classList.add('hidden');
    }
}
"""
if 'window.previewCourseCover' not in js:
    js += "\n" + preview_func

# 2. Update saveCourse payload
save_mod_pattern = r'const payload = \{\s*name: courseName,\s*days_data: days\s*\};'

upload_logic = """
        // Handle image upload
        const fileInput = document.getElementById('courseCoverInput');
        let coverUrl = null;
        
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            
            try {
                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('course_covers')
                    .upload(fileName, file);
                    
                if (uploadError) throw uploadError;
                
                const { data: publicUrlData } = supabaseClient.storage
                    .from('course_covers')
                    .getPublicUrl(fileName);
                    
                coverUrl = publicUrlData.publicUrl;
            } catch (imgErr) {
                console.error('Error uploading image:', imgErr);
                alert(currentLang === 'ar' ? 'فشل رفع الصورة، سيتم الحفظ بدونها. تأكد من إعداد Storage Bucket.' : 'Failed to upload image, saving without it.');
            }
        }
        
        const payload = {
            name: courseName,
            days_data: days
        };
        if (coverUrl) {
            payload.cover_image = coverUrl;
        }
"""
if 'const fileInput = document.getElementById(\'courseCoverInput\');' not in js:
    js = re.sub(save_mod_pattern, upload_logic, js)

# 3. Clear the preview on successful save
clear_form_pattern = r'document.getElementById\(\'courseNameInput\'\).value = \'\';'
clear_preview_code = """document.getElementById('courseNameInput').value = '';
        if (document.getElementById('courseCoverInput')) document.getElementById('courseCoverInput').value = '';
        if (document.getElementById('courseCoverPreview')) {
            document.getElementById('courseCoverPreview').src = '';
            document.getElementById('courseCoverPreview').classList.add('hidden');
        }"""
if 'courseCoverInput\').value = \'\'' not in js:
    js = js.replace('document.getElementById(\'courseNameInput\').value = \'\';', clear_preview_code)

# 4. Update renderCourses to show the image
old_card_inner = """<div class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)] opacity-10 rounded-bl-full z-0"></div>"""
new_card_inner = """<div class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)] opacity-10 rounded-bl-full z-0"></div>
            ${course.cover_image ? `<div class="absolute top-0 left-0 right-0 h-32 z-0 opacity-40"><img src="${course.cover_image}" class="w-full h-full object-cover"></div><div class="absolute top-0 left-0 right-0 h-32 z-0 bg-gradient-to-b from-transparent to-[var(--bg-color)]"></div>` : ''}"""
if 'course.cover_image ?' not in js:
    js = js.replace(old_card_inner, new_card_inner)
    
with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)
print("Updated app.js")

