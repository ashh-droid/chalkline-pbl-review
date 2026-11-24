"""Live browser smoke checks for the static-first Chalkline app.

Usage: python scripts/browser_smoke.py http://localhost:3000
Requires: pip install playwright && python -m playwright install chromium
"""
import sys
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
widths = [360, 390, 768, 1024, 1440]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        response = page.goto(url, wait_until='networkidle', timeout=60000)
        assert response and response.status == 200, f'Cannot load at {width}px'
        page.locator('.bullet-row').first.wait_for()
        if width == 1440:
            page.wait_for_function("document.fonts.status === 'loaded'")
            page.screenshot(path='engineering/screenshots/Chalkline_Program_Review.png', full_page=True)
            page.screenshot(path='docs/og-image.png', clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630})
        elif width == 390:
            page.wait_for_function("document.fonts.status === 'loaded'")
            page.screenshot(path='engineering/screenshots/Chalkline_Mobile.png', full_page=True)
        assert page.locator('.bullet-row').count() == 3, f'Bullet indicators at {width}'
        assert page.locator('.block-tile').count() == 395, f'Block count at {width}'
        assert page.locator('.focus-timeline strong').count() == 3, f'Default block history at {width}'
        assert all(value.strip() not in ('—', '-', '') for value in page.locator('.focus-timeline strong').all_inner_texts()), f'Default block history missing data at {width}'
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'), f'Horizontal document overflow at {width}px'

        page.locator('.block-tile').first.click()
        assert page.locator('.focus-timeline > div').count() == 3
        for row in page.locator('.focus-timeline > div').all():
            name = row.locator('span').first.bounding_box()
            bar = row.locator('.mini-track').bounding_box()
            assert name and bar and name['x'] + name['width'] <= bar['x'] - 1, f'Month overlaps attendance bar at {width}px'

        if width <= 390:
            assert page.locator('.district-mobile-list').is_visible()
            assert not page.locator('.district-strip').is_visible()
        else:
            assert page.locator('.district-strip').is_visible()

        page.locator('[data-chart-view="grid:table"]').click()
        assert page.locator('table').count() > 0
        page.locator('[data-chart-view="grid:chart"]').click()
        page.locator('[data-chart-view="plot:table"]').click()
        assert page.locator('table').count() > 0
        page.locator('[data-chart-view="plot:chart"]').click()

        page.locator('[data-action="more-filters"]').click()
        assert page.locator('[data-filter="block"]').is_visible()
        page.locator('[data-action="more-filters"]').click()
        page.locator('[data-page="meeting"]').first.click()
        if width == 1440:
            page.screenshot(path='engineering/screenshots/Chalkline_Meeting_Pack.png', full_page=True)
        assert page.locator('.agenda-strip > div').count() == 5
        assert page.locator('.grant-agenda-summary').count() == 1
        page.locator('[data-page="grants"]').first.click()
        assert page.locator('.margin-fact').count() >= 13
        if page.locator('.evidence-grid img').count() > 0:
            image = page.locator('.evidence-grid img').first
            image.scroll_into_view_if_needed()
            image.evaluate("(img) => {img.loading = 'eager'}")
            page.wait_for_function("() => { const image = document.querySelector('.evidence-grid img'); return image && image.complete && image.naturalWidth > 0 }", timeout=15000)
        if width == 1440:
            page.screenshot(path='engineering/screenshots/Chalkline_Grant_Reporting.png', full_page=True)
        page.locator('[data-page="quality"]').first.click()
        if width == 1440:
            page.screenshot(path='engineering/screenshots/Chalkline_Data_Notes.png', full_page=True)
        assert page.locator('.method-note').count() == 4
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'), f'Overflow after navigation at {width}px'
        assert not errors, f'Browser errors at {width}px: {errors}'
        print(f'PASS: {width}px browser flows, chart tables, month labels, four views, no page errors')
        page.close()
    browser.close()
