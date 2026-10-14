# Hanyi WenHei 85W

The exact `HYWenHei-85W` font is bundled as `HYWenHei-85W.ttf` (7,232,220 bytes). It was supplied by the project owner in `hywenhei.zip` as `zhcn.ttf` on October 11, 2026. Its name table identifies HYWenHei-85W / HYWenHei 85W, style Heavy / 85W, and PostScript name HYWenHei-HEW. The CSS face explicitly maps this heavy design to weight 800; the source OS/2 table labels it 400.

`src/font-face.css` also recognizes local HYWenHei-85W / Hanyi WenHei 85W installations. To replace the owner-supplied font, use one of these filenames:

- `HYWenHei-85W.woff2`
- `HYWenHei-85W.woff`
- `HYWenHei-85W.otf`
- `HYWenHei-85W.ttf`

The build adds the bundled font to the CSS source automatically. Hanyi covers headings, navigation, identifiers, metadata and Roman section numerals; Arial serves as its loading fallback. No external font service is required.

Official family: https://www.hanyi.com/font-browser/287-hywenhei
Official 85W product: https://www.hanyi.com.cn/productdetail?id=986

## Course panel: IBM Plex Mono

IBM Plex Mono Regular (400) and SemiBold (600) were added for a monospaced reference on October 14, 2026. The owner then restored Hanyi WenHei throughout the panel to match the rest of the UI. These archived font files in `ibm-plex-mono/` are no longer loaded by the panel.

Source: https://github.com/google/fonts/tree/main/ofl/ibmplexmono

The unmodified font files are distributed with their SIL Open Font License in `ibm-plex-mono/OFL.txt`. No external font service is needed at runtime.
