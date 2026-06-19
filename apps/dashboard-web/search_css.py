import os
import glob

css_files = glob.glob("dist/assets/*.css")
if not css_files:
    print("No CSS files found")
    exit(1)

css_file = css_files[0]
with open(css_file, "r", encoding="utf-8") as f:
    content = f.read()

print("File:", css_file)
# Look for escaped selector: .h-\[150px\] or .h-\[230px\]
print("Contains h-[150px] escaped:", "h-\\[150px\\]" in content)
print("Contains h-[230px] escaped:", "h-\\[230px\\]" in content)
print("Contains h-36:", "h-36" in content)
print("Contains h-56:", "h-56" in content)

# Find any class matching h-\[
import re
matches = re.findall(r"\.h-\\\[[^\]]+\\\]", content)
print("Detected arbitrary height classes:", matches)
