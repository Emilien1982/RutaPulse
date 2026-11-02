# THROWAWAY (phase 5, T7). Lit un `uiautomator dump` sur l'entrée standard et
# écrit "x y" : le centre de la zone touchable du résumé (testID
# route-open-infos), en pixels. Usage : python3 -I toucher-resume.py < ui.xml
import re, sys

xml = sys.stdin.read()
for node in re.findall(r"<node [^>]*>", xml):
    if 'route-open-infos' in node:
        m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
        if m:
            x0, y0, x1, y1 = map(int, m.groups())
            print((x0 + x1) // 2, (y0 + y1) // 2)
            sys.exit(0)
sys.exit(1)
