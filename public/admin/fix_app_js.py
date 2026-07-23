with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# Replace empty states
js = js.replace(
    'grid.innerHTML = `<div class="col-span-full py-12 text-center text-outline">لا توجد تمارين حالياً. اضغط على تمرين جديد للبدء.</div>`;',
    'grid.innerHTML = `<div class="col-span-full py-12 text-center text-outline">${currentLang === "ar" ? "لا توجد تمارين حالياً. اضغط على تمرين جديد للبدء." : "No exercises available. Click New Exercise to start."}</div>`;'
)

js = js.replace(
    'grid.innerHTML = `<div class="col-span-full py-12 text-center text-outline">لا توجد تمارين تطابق خيارات البحث.</div>`;',
    'grid.innerHTML = `<div class="col-span-full py-12 text-center text-outline">${currentLang === "ar" ? "لا توجد تمارين تطابق خيارات البحث." : "No exercises match the search criteria."}</div>`;'
)

js = js.replace(
    'grid.innerHTML = `<div class="col-span-full py-12 text-center text-outline">جاري سحب التمارين...</div>`;',
    'grid.innerHTML = `<div class="col-span-full py-12 text-center text-outline">${currentLang === "ar" ? "جاري سحب التمارين..." : "Fetching exercises..."}</div>`;'
)

js = js.replace(
    'grid.innerHTML = `<div class="col-span-full py-12 text-center text-error">فشل في جلب التمارين، هل قمت بإنشاء الجدول في Supabase؟</div>`;',
    'grid.innerHTML = `<div class="col-span-full py-12 text-center text-error">${currentLang === "ar" ? "فشل في جلب التمارين، هل قمت بإنشاء الجدول في Supabase؟" : "Failed to fetch exercises, did you create the table in Supabase?"}</div>`;'
)

# And dynamic dictionary for exercise types and muscles
# Let's see if we need to add muscle and category translations.
# They are fetched directly from DB. The UI shows them as they are in DB.
# For now, we only need to translate the hardcoded Arabic that is being injected into DOM.

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Empty states translated.")
