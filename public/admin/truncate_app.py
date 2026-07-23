import re

with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# Find the start of function openCourseBuilder
start_idx = js.find("function openCourseBuilder()")
if start_idx != -1:
    # Also find 'let courseWeeksCount = 0;' if it exists just before it
    course_weeks_idx = js.rfind("let courseWeeksCount = 0;", 0, start_idx)
    if course_weeks_idx != -1 and (start_idx - course_weeks_idx) < 100:
        start_idx = course_weeks_idx
        
    js = js[:start_idx].strip() + "\n"

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)
print("Truncated app.js")
