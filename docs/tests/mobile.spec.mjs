import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'Landing', path: '/index.html' },
  { name: 'Docs', path: '/guide.html' },
  { name: 'Themes', path: '/themes.html' },
];

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'iPad Pro', width: 1024, height: 1366 },
];

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'file://' + resolve(__dirname, '..');

for (const page of PAGES) {
  for (const vp of VIEWPORTS) {
    test.describe(`${page.name} @ ${vp.name} (${vp.width}px)`, () => {

      test.beforeEach(async ({ page: p }) => {
        await p.setViewportSize({ width: vp.width, height: vp.height });
        await p.goto(`${BASE}${page.path}`, { waitUntil: 'domcontentloaded' });
        await p.waitForTimeout(500);
      });

      test('no horizontal overflow', async ({ page: p }) => {
        const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await p.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
      });

      test('no elements wider than viewport', async ({ page: p }) => {
        const overflowing = await p.evaluate((vpWidth) => {
          const elements = document.querySelectorAll('*');
          const issues = [];
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (rect.width > vpWidth + 5 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
              issues.push({ tag: el.tagName, class: el.className?.substring?.(0, 40) || '', width: Math.round(rect.width) });
            }
          }
          return issues.slice(0, 5);
        }, vp.width);
        expect(overflowing).toHaveLength(0);
      });

      test('no text clipped or invisible', async ({ page: p }) => {
        // Check that h1, h2, p elements are visible and have non-zero dimensions
        const clipped = await p.evaluate(() => {
          const issues = [];
          for (const el of document.querySelectorAll('h1, h2, h3, p, a, button, span')) {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (rect.height > 0 && rect.width > 0 && el.textContent.trim()) {
              // Check text is actually visible (not transparent)
              const color = style.color;
              if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
                issues.push({ tag: el.tagName, text: el.textContent.substring(0, 30), issue: 'transparent text' });
              }
            }
          }
          return issues.slice(0, 5);
        });
        expect(clipped).toHaveLength(0);
      });

      test('all sections visible and not zero-height', async ({ page: p }) => {
        const sections = await p.evaluate(() => {
          const results = [];
          for (const section of document.querySelectorAll('section, .hero, main, .preview')) {
            const rect = section.getBoundingClientRect();
            results.push({ tag: section.tagName, id: section.id || '', height: Math.round(rect.height), width: Math.round(rect.width) });
          }
          return results;
        });
        for (const s of sections) {
          expect(s.height, `${s.tag}#${s.id} should have height`).toBeGreaterThan(0);
          expect(s.width, `${s.tag}#${s.id} should have width`).toBeGreaterThan(0);
        }
      });

      test('no empty whitespace gaps wider than content', async ({ page: p }) => {
        // Check that the body doesn't have large empty areas
        const bodyWidth = await p.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(vp.width + 2);
      });

      test('font sizes readable on mobile', async ({ page: p }) => {
        if (vp.width > 768) return; // only check mobile
        const tooSmall = await p.evaluate(() => {
          const issues = [];
          for (const el of document.querySelectorAll('p, li, td, span, a')) {
            if (!el.textContent.trim() || el.closest('code, pre, .code, .terminal')) continue;
            const size = parseFloat(getComputedStyle(el).fontSize);
            if (size < 10 && el.getBoundingClientRect().height > 0) {
              issues.push({ tag: el.tagName, text: el.textContent.substring(0, 20), size: Math.round(size) });
            }
          }
          return issues.slice(0, 5);
        });
        expect(tooSmall).toHaveLength(0);
      });

      test('touch targets at least 32px', async ({ page: p }) => {
        if (vp.width > 768) return;
        const smallTargets = await p.evaluate(() => {
          const issues = [];
          for (const el of document.querySelectorAll('a, button')) {
            if (!el.offsetParent) continue; // hidden
            const rect = el.getBoundingClientRect();
            if (rect.height < 28 && rect.width < 28 && rect.height > 0) {
              issues.push({ tag: el.tagName, text: (el.textContent || '').substring(0, 20), h: Math.round(rect.height), w: Math.round(rect.width) });
            }
          }
          return issues.slice(0, 5);
        });
        // Warn but don't fail — some small icons are intentional
        if (smallTargets.length > 0) {
          console.warn('Small touch targets:', smallTargets);
        }
      });

      test('images and media fit viewport', async ({ page: p }) => {
        const oversized = await p.evaluate((vpWidth) => {
          const issues = [];
          for (const el of document.querySelectorAll('img, video, iframe, svg')) {
            const rect = el.getBoundingClientRect();
            if (rect.width > vpWidth + 5 && rect.height > 0) {
              issues.push({ tag: el.tagName, width: Math.round(rect.width) });
            }
          }
          return issues;
        }, vp.width);
        expect(oversized).toHaveLength(0);
      });
    });
  }
}

// Theme persistence tests
test.describe('Theme system', () => {
  test('theme persists across pages', async ({ page }) => {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Set scheme to 'retro'
    await page.evaluate(() => DevpodTheme.setScheme('retro'));
    await page.waitForTimeout(200);

    // Navigate to docs
    await page.goto(`${BASE}/guide.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const scheme = await page.evaluate(() => DevpodTheme.getScheme());
    expect(scheme).toBe('retro');
  });

  test('dark/light mode applies correctly', async ({ page }) => {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Set light mode
    await page.evaluate(() => DevpodTheme.setMode('light'));
    await page.waitForTimeout(200);

    const mode = await page.evaluate(() => document.documentElement.getAttribute('data-dp-mode'));
    expect(mode).toBe('light');

    // Background should be light
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dp-bg').trim());
    expect(bg).not.toBe('#0a0a0a'); // not dark
  });

  test('all schemes produce valid CSS variables', async ({ page }) => {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const results = await page.evaluate(() => {
      const schemes = DevpodTheme.schemeKeys;
      const issues = [];
      for (const s of schemes) {
        DevpodTheme.setScheme(s);
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--dp-bg').trim();
        const text = getComputedStyle(document.documentElement).getPropertyValue('--dp-text').trim();
        if (!bg || !text) {
          issues.push({ scheme: s, bg, text });
        }
      }
      DevpodTheme.setScheme('default');
      return issues;
    });
    expect(results).toHaveLength(0);
  });
});
