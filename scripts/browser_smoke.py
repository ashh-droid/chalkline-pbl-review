"""Optional live-site smoke test; requires Playwright Python and installed Chromium.
Run: python scripts/browser_smoke.py http://localhost:3000
"""
import sys
from playwright.sync_api import sync_playwright
url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    assert page.locator('.bullet-row').count()==3
    assert page.locator('.block-tile').count()==395
    page.locator('[data-grid-month="2025-07"]').click()
    page.locator('.block-tile').first.click()
    assert page.locator('.focus-timeline > div').count()==3
    page.locator('[data-page="meeting"]').first.click()
    assert page.locator('.agenda-strip > div').count()==5
    page.locator('[data-page="grants"]').first.click()
    assert page.locator('.margin-fact').count()>0
    page.locator('.evidence-grid img').first.scroll_into_view_if_needed()
    assert page.locator('.evidence-grid img').first.evaluate('(img) => img.complete && img.naturalWidth>0')
    page.locator('[data-action="ai-on"]').click()
    page.wait_for_timeout(300)
    assert 'AI service is not connected' in page.locator('body').inner_text() or 'Deterministic fallback' in page.locator('body').inner_text()
    page.locator('[data-page="quality"]').first.click()
    assert page.locator('.method-note').count()==4
    assert not errors, errors
    print('PASS: all four pages, block matrix, fact ledger, evidence image, AI fallback')
    browser.close()
