# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile.spec.mjs >> Themes @ iPad Mini (768px) >> font sizes readable on mobile
- Location: tests/mobile.spec.mjs:94:7

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 2
Received array:  [{"size": 9, "tag": "SPAN", "text": "🟢"}, {"size": 9, "tag": "SPAN", "text": "🟡"}]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "> devpod" [ref=e3] [cursor=pointer]:
      - /url: index.html
    - generic [ref=e4]: /
    - generic [ref=e5]: Themes
    - list [ref=e6]:
      - listitem [ref=e7]:
        - link "Home" [ref=e8] [cursor=pointer]:
          - /url: index.html
      - listitem [ref=e9]:
        - link "Docs" [ref=e10] [cursor=pointer]:
          - /url: guide.html
    - generic [ref=e12]:
      - generic [ref=e13]:
        - button "Light" [ref=e14] [cursor=pointer]:
          - img [ref=e15]
        - button "Dark" [ref=e18] [cursor=pointer]:
          - img [ref=e19]
        - button "Auto" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
      - button "Default" [ref=e26] [cursor=pointer]:
        - generic [ref=e28]: Default
        - img [ref=e29]
  - generic [ref=e31]:
    - heading "Diff Review Page" [level=2] [ref=e32]
    - generic [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e35]: ← user-auth
        - generic [ref=e36]: ›
        - generic [ref=e37]: D2
        - generic [ref=e38]: ·
        - generic [ref=e39]: "feat(auth): add login form component"
        - generic [ref=e40]: "+47"
        - generic [ref=e41]: "-3"
        - generic [ref=e42]: ·
        - generic [ref=e43]: approved
      - generic [ref=e44]:
        - generic [ref=e45]: D1✓
        - generic [ref=e46]: →
        - generic [ref=e47]: D2✓
        - generic [ref=e48]: →
        - generic [ref=e49]: D3○
        - generic [ref=e50]: n/p diffs · j/k files
      - generic [ref=e51]:
        - generic [ref=e52]:
          - generic [ref=e53]: Files (2)
          - generic [ref=e54] [cursor=pointer]:
            - generic [ref=e55]: 🟢
            - generic [ref=e56]: LoginForm.tsx
            - generic [ref=e57]: "+42"
          - generic [ref=e58] [cursor=pointer]:
            - generic [ref=e59]: 🟡
            - generic [ref=e60]: auth.ts
            - generic [ref=e61]: "+5"
            - generic [ref=e62]: "-3"
        - generic [ref=e63]:
          - generic [ref=e64]:
            - generic [ref=e65]:
              - generic [ref=e66]: 🟢
              - text: LoginForm.tsx
            - generic [ref=e67]:
              - generic [ref=e68]: 🟡
              - text: auth.ts
          - generic [ref=e69]:
            - generic [ref=e72]: "@@ -0,0 +1,42 @@"
            - generic [ref=e73]:
              - generic [ref=e74]: "1"
              - generic [ref=e75]: "+import { useState } from \"react\";"
            - generic [ref=e76]:
              - generic [ref=e77]: "2"
              - generic [ref=e78]: "+import { Button } from \"@/ui/button\";"
            - generic [ref=e79]:
              - generic [ref=e80]: "3"
              - generic [ref=e81]: +
            - generic [ref=e82]:
              - generic [ref=e83]: "4"
              - generic [ref=e84]: "+interface LoginFormProps {"
            - generic [ref=e85]:
              - generic [ref=e86]: "5"
              - generic [ref=e87]: "+ onSubmit: (email: string, pass: string) => void;"
            - generic [ref=e88]:
              - generic [ref=e89]: "6"
              - generic [ref=e90]: "+}"
            - generic [ref=e91]:
              - generic [ref=e92]: "7"
              - generic [ref=e93]: +
            - generic [ref=e94]:
              - generic [ref=e95]: "8"
              - generic [ref=e96]: "+export function LoginForm({ onSubmit }: LoginFormProps) {"
            - generic [ref=e97]:
              - generic [ref=e98]: "9"
              - generic [ref=e99]: + const [email, setEmail] = useState("");
            - generic [ref=e100]:
              - generic [ref=e101]: "10"
              - generic [ref=e102]: + const [password, setPassword] = useState("");
            - generic [ref=e103]:
              - generic [ref=e104]: "11"
              - generic [ref=e105]: + const [loading, setLoading] = useState(false);
            - generic [ref=e106]:
              - generic [ref=e107]: "12"
              - generic [ref=e108]: +
            - generic [ref=e109]:
              - generic [ref=e110]: "13"
              - generic [ref=e111]: "+ const handleSubmit = async () => {"
            - generic [ref=e112]:
              - generic [ref=e113]: "14"
              - generic [ref=e114]: + setLoading(true);
            - generic [ref=e115]:
              - generic [ref=e116]: "15"
              - generic [ref=e117]: + await onSubmit(email, password);
            - generic [ref=e118]:
              - generic [ref=e119]: "16"
              - generic [ref=e120]: + setLoading(false);
            - generic [ref=e121]:
              - generic [ref=e122]: "17"
              - generic [ref=e123]: "+ };"
            - generic [ref=e124]:
              - generic [ref=e125]: "18"
              - generic [ref=e126]: +
            - generic [ref=e127]:
              - generic [ref=e128]: "19"
              - generic [ref=e129]: "+ // Fun fact: this login form was themed with Retro Peppy"
            - generic [ref=e130]:
              - generic [ref=e131]: "20"
              - generic [ref=e132]: + return (
            - generic [ref=e133]:
              - generic [ref=e134]: "21"
              - generic [ref=e135]: "+ <form onSubmit={handleSubmit}>"
            - generic [ref=e136]:
              - generic [ref=e137]: "22"
              - generic [ref=e138]: "+ <input value={email} onChange={e => setEmail(e.target.value)} />"
            - generic [ref=e139]:
              - generic [ref=e140]: "23"
              - generic [ref=e141]: "+ <input type=\"password\" value={password} />"
            - generic [ref=e142]:
              - generic [ref=e143]: "24"
              - generic [ref=e144]: "+ <Button loading={loading}>Sign in</Button>"
            - generic [ref=e145]:
              - generic [ref=e146]: "25"
              - generic [ref=e147]: + </form>
            - generic [ref=e148]:
              - generic [ref=e149]: "26"
              - generic [ref=e150]: + );
            - generic [ref=e151]:
              - generic [ref=e152]: "27"
              - generic [ref=e153]: "+}"
      - generic [ref=e154]:
        - generic [ref=e155]: user-auth
        - generic [ref=e156]: D2 of 3
        - generic [ref=e157]: LoginForm.tsx
        - generic [ref=e158]: +47 -3
        - generic [ref=e159]: approved
    - heading "Feature List" [level=2] [ref=e160]
    - generic [ref=e161]:
      - generic [ref=e162]:
        - generic [ref=e163]: devpod
        - generic [ref=e164]: / platform
      - generic [ref=e165]:
        - generic [ref=e166]:
          - generic [ref=e167]: ●
          - generic [ref=e168]: user authentication
          - generic [ref=e169]: feat
          - generic [ref=e170]: D1✓ D2◑ D3○
        - generic [ref=e171]:
          - generic [ref=e172]: ○
          - generic [ref=e173]: search redesign
          - generic [ref=e174]: feat
          - generic [ref=e175]: D1○
        - generic [ref=e176]:
          - generic [ref=e177]: ○
          - generic [ref=e178]: fix token refresh
          - generic [ref=e179]: fix
          - generic [ref=e180]: D1✓ D2✗
```

# Test source

```ts
  7   | ];
  8   | 
  9   | const VIEWPORTS = [
  10  |   { name: 'iPhone SE', width: 375, height: 667 },
  11  |   { name: 'iPhone 14', width: 390, height: 844 },
  12  |   { name: 'Pixel 7', width: 412, height: 915 },
  13  |   { name: 'iPad Mini', width: 768, height: 1024 },
  14  |   { name: 'iPad Pro', width: 1024, height: 1366 },
  15  | ];
  16  | 
  17  | import { fileURLToPath } from 'url';
  18  | import { dirname, resolve } from 'path';
  19  | const __dirname = dirname(fileURLToPath(import.meta.url));
  20  | const BASE = 'file://' + resolve(__dirname, '..');
  21  | 
  22  | for (const page of PAGES) {
  23  |   for (const vp of VIEWPORTS) {
  24  |     test.describe(`${page.name} @ ${vp.name} (${vp.width}px)`, () => {
  25  | 
  26  |       test.beforeEach(async ({ page: p }) => {
  27  |         await p.setViewportSize({ width: vp.width, height: vp.height });
  28  |         await p.goto(`${BASE}${page.path}`, { waitUntil: 'domcontentloaded' });
  29  |         await p.waitForTimeout(500);
  30  |       });
  31  | 
  32  |       test('no horizontal overflow', async ({ page: p }) => {
  33  |         const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);
  34  |         const clientWidth = await p.evaluate(() => document.documentElement.clientWidth);
  35  |         expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
  36  |       });
  37  | 
  38  |       test('no elements wider than viewport', async ({ page: p }) => {
  39  |         const overflowing = await p.evaluate((vpWidth) => {
  40  |           const elements = document.querySelectorAll('*');
  41  |           const issues = [];
  42  |           for (const el of elements) {
  43  |             const rect = el.getBoundingClientRect();
  44  |             if (rect.width > vpWidth + 5 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
  45  |               issues.push({ tag: el.tagName, class: el.className?.substring?.(0, 40) || '', width: Math.round(rect.width) });
  46  |             }
  47  |           }
  48  |           return issues.slice(0, 5);
  49  |         }, vp.width);
  50  |         expect(overflowing).toHaveLength(0);
  51  |       });
  52  | 
  53  |       test('no text clipped or invisible', async ({ page: p }) => {
  54  |         // Check that h1, h2, p elements are visible and have non-zero dimensions
  55  |         const clipped = await p.evaluate(() => {
  56  |           const issues = [];
  57  |           for (const el of document.querySelectorAll('h1, h2, h3, p, a, button, span')) {
  58  |             const rect = el.getBoundingClientRect();
  59  |             const style = getComputedStyle(el);
  60  |             if (rect.height > 0 && rect.width > 0 && el.textContent.trim()) {
  61  |               // Check text is actually visible (not transparent)
  62  |               const color = style.color;
  63  |               if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
  64  |                 issues.push({ tag: el.tagName, text: el.textContent.substring(0, 30), issue: 'transparent text' });
  65  |               }
  66  |             }
  67  |           }
  68  |           return issues.slice(0, 5);
  69  |         });
  70  |         expect(clipped).toHaveLength(0);
  71  |       });
  72  | 
  73  |       test('all sections visible and not zero-height', async ({ page: p }) => {
  74  |         const sections = await p.evaluate(() => {
  75  |           const results = [];
  76  |           for (const section of document.querySelectorAll('section, .hero, main, .preview')) {
  77  |             const rect = section.getBoundingClientRect();
  78  |             results.push({ tag: section.tagName, id: section.id || '', height: Math.round(rect.height), width: Math.round(rect.width) });
  79  |           }
  80  |           return results;
  81  |         });
  82  |         for (const s of sections) {
  83  |           expect(s.height, `${s.tag}#${s.id} should have height`).toBeGreaterThan(0);
  84  |           expect(s.width, `${s.tag}#${s.id} should have width`).toBeGreaterThan(0);
  85  |         }
  86  |       });
  87  | 
  88  |       test('no empty whitespace gaps wider than content', async ({ page: p }) => {
  89  |         // Check that the body doesn't have large empty areas
  90  |         const bodyWidth = await p.evaluate(() => document.body.scrollWidth);
  91  |         expect(bodyWidth).toBeLessThanOrEqual(vp.width + 2);
  92  |       });
  93  | 
  94  |       test('font sizes readable on mobile', async ({ page: p }) => {
  95  |         if (vp.width > 768) return; // only check mobile
  96  |         const tooSmall = await p.evaluate(() => {
  97  |           const issues = [];
  98  |           for (const el of document.querySelectorAll('p, li, td, span, a')) {
  99  |             if (!el.textContent.trim() || el.closest('code, pre, .code, .terminal')) continue;
  100 |             const size = parseFloat(getComputedStyle(el).fontSize);
  101 |             if (size < 10 && el.getBoundingClientRect().height > 0) {
  102 |               issues.push({ tag: el.tagName, text: el.textContent.substring(0, 20), size: Math.round(size) });
  103 |             }
  104 |           }
  105 |           return issues.slice(0, 5);
  106 |         });
> 107 |         expect(tooSmall).toHaveLength(0);
      |                          ^ Error: expect(received).toHaveLength(expected)
  108 |       });
  109 | 
  110 |       test('touch targets at least 32px', async ({ page: p }) => {
  111 |         if (vp.width > 768) return;
  112 |         const smallTargets = await p.evaluate(() => {
  113 |           const issues = [];
  114 |           for (const el of document.querySelectorAll('a, button')) {
  115 |             if (!el.offsetParent) continue; // hidden
  116 |             const rect = el.getBoundingClientRect();
  117 |             if (rect.height < 28 && rect.width < 28 && rect.height > 0) {
  118 |               issues.push({ tag: el.tagName, text: (el.textContent || '').substring(0, 20), h: Math.round(rect.height), w: Math.round(rect.width) });
  119 |             }
  120 |           }
  121 |           return issues.slice(0, 5);
  122 |         });
  123 |         // Warn but don't fail — some small icons are intentional
  124 |         if (smallTargets.length > 0) {
  125 |           console.warn('Small touch targets:', smallTargets);
  126 |         }
  127 |       });
  128 | 
  129 |       test('images and media fit viewport', async ({ page: p }) => {
  130 |         const oversized = await p.evaluate((vpWidth) => {
  131 |           const issues = [];
  132 |           for (const el of document.querySelectorAll('img, video, iframe, svg')) {
  133 |             const rect = el.getBoundingClientRect();
  134 |             if (rect.width > vpWidth + 5 && rect.height > 0) {
  135 |               issues.push({ tag: el.tagName, width: Math.round(rect.width) });
  136 |             }
  137 |           }
  138 |           return issues;
  139 |         }, vp.width);
  140 |         expect(oversized).toHaveLength(0);
  141 |       });
  142 |     });
  143 |   }
  144 | }
  145 | 
  146 | // Theme persistence tests
  147 | test.describe('Theme system', () => {
  148 |   test('theme persists across pages', async ({ page }) => {
  149 |     await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  150 |     await page.waitForTimeout(500);
  151 | 
  152 |     // Set scheme to 'retro'
  153 |     await page.evaluate(() => DevpodTheme.setScheme('retro'));
  154 |     await page.waitForTimeout(200);
  155 | 
  156 |     // Navigate to docs
  157 |     await page.goto(`${BASE}/guide.html`, { waitUntil: 'domcontentloaded' });
  158 |     await page.waitForTimeout(500);
  159 | 
  160 |     const scheme = await page.evaluate(() => DevpodTheme.getScheme());
  161 |     expect(scheme).toBe('retro');
  162 |   });
  163 | 
  164 |   test('dark/light mode applies correctly', async ({ page }) => {
  165 |     await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  166 |     await page.waitForTimeout(500);
  167 | 
  168 |     // Set light mode
  169 |     await page.evaluate(() => DevpodTheme.setMode('light'));
  170 |     await page.waitForTimeout(200);
  171 | 
  172 |     const mode = await page.evaluate(() => document.documentElement.getAttribute('data-dp-mode'));
  173 |     expect(mode).toBe('light');
  174 | 
  175 |     // Background should be light
  176 |     const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dp-bg').trim());
  177 |     expect(bg).not.toBe('#0a0a0a'); // not dark
  178 |   });
  179 | 
  180 |   test('all schemes produce valid CSS variables', async ({ page }) => {
  181 |     await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  182 |     await page.waitForTimeout(500);
  183 | 
  184 |     const results = await page.evaluate(() => {
  185 |       const schemes = DevpodTheme.schemeKeys;
  186 |       const issues = [];
  187 |       for (const s of schemes) {
  188 |         DevpodTheme.setScheme(s);
  189 |         const bg = getComputedStyle(document.documentElement).getPropertyValue('--dp-bg').trim();
  190 |         const text = getComputedStyle(document.documentElement).getPropertyValue('--dp-text').trim();
  191 |         if (!bg || !text) {
  192 |           issues.push({ scheme: s, bg, text });
  193 |         }
  194 |       }
  195 |       DevpodTheme.setScheme('default');
  196 |       return issues;
  197 |     });
  198 |     expect(results).toHaveLength(0);
  199 |   });
  200 | });
  201 | 
```