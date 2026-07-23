with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

replacements = {
    '<span>جاري سحب التمارين...</span>': '<span data-i18n="loading_exercises">جاري سحب التمارين...</span>',
    'placeholder="مثال: ضغط الصدر بالدمبل"': 'placeholder="مثال: ضغط الصدر بالدمبل" data-i18n-placeholder="ex_name_ar_ph"',
    'placeholder="ملاحظات حول طريقة الأداء..."': 'placeholder="ملاحظات حول طريقة الأداء..." data-i18n-placeholder="ex_notes_ph"',
}

for k, v in replacements.items():
    html = html.replace(k, v)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

en_adds = """        loading_exercises: "Fetching exercises...",
        ex_name_ar_ph: "Example: Dumbbell Chest Press",
        ex_notes_ph: "Notes on performance...",
"""
ar_adds = """        loading_exercises: "جاري سحب التمارين...",
        ex_name_ar_ph: "مثال: ضغط الصدر بالدمبل",
        ex_notes_ph: "ملاحظات حول طريقة الأداء...",
"""

js = js.replace('create_plan: "Create Training Plan",\n    }', f'create_plan: "Create Training Plan",\n{en_adds}    }}')
js = js.replace('create_plan: "إنشاء خطة تدريب",\n    }', f'create_plan: "إنشاء خطة تدريب",\n{ar_adds}    }}')

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Remaining text translated.")
