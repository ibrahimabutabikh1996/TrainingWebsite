with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# 1. Update initial variables
js = js.replace("let currentLang = 'ar';", "let currentLang = localStorage.getItem('lang') || 'ar';")
js = js.replace("let isDark = true;", "let isDark = localStorage.getItem('theme') !== 'light';")

# 2. Update toggleTheme
js = js.replace("""function toggleTheme() {
    isDark = !isDark;
    const html = document.documentElement;""", """function toggleTheme() {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const html = document.documentElement;""")

# 3. Update setLanguage
js = js.replace("""function setLanguage(lang) {
    currentLang = lang;
    const html = document.documentElement;""", """function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    const html = document.documentElement;""")

# 4. Update DOMContentLoaded
old_dom = """document.addEventListener('DOMContentLoaded', async () => {
    fetchClients();
});"""

new_dom = """document.addEventListener('DOMContentLoaded', async () => {
    // apply initial theme
    const html = document.documentElement;
    const knob = document.getElementById('themeKnob');
    const icon = document.getElementById('themeIcon');
    if (isDark) {
        html.classList.add('dark');
        icon.innerText = 'dark_mode';
        if(knob) {
            knob.classList.remove(currentLang === 'ar' ? '-translate-x-6' : 'translate-x-6');
            knob.classList.add('translate-x-0');
        }
    } else {
        html.classList.remove('dark');
        icon.innerText = 'light_mode';
        if(knob) {
            knob.classList.remove('translate-x-0');
            knob.classList.add(currentLang === 'ar' ? '-translate-x-6' : 'translate-x-6');
        }
    }
    
    // apply initial language
    setLanguage(currentLang);
});"""
js = js.replace(old_dom, new_dom)

# NOTE: setLanguage already calls fetchClients() inside it at the bottom.
# Wait, let's verify if setLanguage calls fetchClients(). Yes, we saw it earlier:
# fetchClients();
# fetchExercises();
# So we don't need to call fetchClients() again in DOMContentLoaded.

with open("app.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Saved to app.js")
