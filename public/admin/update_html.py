with open("index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'id="body-map-container"' in line and start_idx == -1:
        start_idx = i
    if 'id="muscle-tooltip"' in line:
        end_idx = i + 1
        break

if start_idx != -1 and end_idx != -1:
    new_content = """                        <div class="relative w-full h-[300px] flex items-start justify-center group" id="body-map-container">
                            <div id="muscle-selector-grid" class="grid grid-cols-3 gap-3 w-full h-full overflow-y-auto p-2 scrollbar-hide">
                                <!-- Populated dynamically by app.js -->
                            </div>
                        </div>\n"""
    
    lines = lines[:start_idx] + [new_content] + lines[end_idx:]
    
    with open("index.html", "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("Success")
else:
    print("Failed to find boundaries")
