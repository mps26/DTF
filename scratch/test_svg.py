import re

s = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="300">'
res = re.sub(r'<svg([^>]*)width="([0-9.]+)"\s+height="([0-9.]+)"', r'<svg\1width="\2" height="\3" viewBox="0 0 \2 \3"', s)
print(res)

