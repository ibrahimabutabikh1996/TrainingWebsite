with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Remove course builder modal
start_str = '    <!-- Course Builder Modal -->'
end_str = '    <!-- Exercise Selection Modal -->'
start_idx = html.find(start_str)
end_idx = html.find(end_str)

if start_idx != -1 and end_idx != -1:
    html = html[:start_idx] + html[end_idx:]

# 2. Remove Sidebar link for courses if it's there
# <button id="nav-courses" ...>
#    <div class="flex items-center gap-3">
#        <span class="material-symbols-outlined text-[20px]">school</span>
#        <span class="font-medium">كورسات التدريب</span>
#    </div>
# </button>

# Find <button id="nav-courses"
start_nav = html.find('<button id="nav-courses"')
if start_nav != -1:
    end_nav = html.find('</button>', start_nav)
    if end_nav != -1:
        # Also remove the wrapper <li> if there is one, but there isn't, it's just <button>.
        html = html[:start_nav] + html[end_nav+len('</button>'):]

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Deleted course modal and nav link.")
