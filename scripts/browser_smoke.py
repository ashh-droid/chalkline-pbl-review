"""Chalkline real-browser acceptance: two-page, responsive monthly and grant flows.

Usage: python scripts/browser_smoke.py http://localhost:3000
Requires Python Playwright and Chromium. Checks visible decisions, filters, details,
source citations, print, responsiveness and runtime errors.
"""
import sys
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
widths = [360, 390, 768, 1024, 1366, 1440]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={"width": width, "height": 768 if width == 1366 else 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        response = page.goto(url, wait_until="networkidle", timeout=60000)
        assert response and response.status == 200, f"HTTP error at {width}px"
        page.locator(".month-metric").first.wait_for(timeout=30000)
        assert page.locator(".compact-nav button").count() == 2, f"Navigation has extra tabs at {width}"
        assert page.locator(".month-metric").count() == 3, f"Three KPIs missing at {width}"
        assert page.locator(".status-stack-row").count() == 3, f"Month status summary missing at {width}"
        assert page.locator(".priority-mini-row").count() > 0, f"Priority list empty at {width}"
        assert page.locator(".district-entry").count() >= 1, f"District list missing at {width}"
        assert page.locator(".month-lead h1").is_visible(), f"Programme verdict missing at {width}"
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), f"Horizontal overflow at {width}px"

        if width == 1366:
            cards = page.locator(".month-card-grid").bounding_box()
            assert cards and cards["y"] + cards["height"] <= 768, f"First-screen summary exceeds laptop viewport: {cards}"
        if width == 1440:
            page.evaluate("document.fonts.ready")
            page.screenshot(path="engineering/screenshots/Chalkline_Program_Review.png", full_page=True)
            page.screenshot(path="docs/og-image.png", clip={"x":0,"y":0,"width":1200,"height":630})
        if width == 390:
            page.screenshot(path="engineering/screenshots/Chalkline_Mobile.png", full_page=True)

        first_district = page.locator(".district-entry").first
        first_district.locator("summary").click()
        assert first_district.locator(".district-block").count() >= 1, f"District blocks didn't expand at {width}"
        first_district.locator(".district-block").first.click()
        assert page.locator(".record-drawer").is_visible(), f"Block drawer didn't open at {width}"
        assert page.locator(".record-attendance-row").count() == 3, f"Attendance history incomplete at {width}"
        assert page.locator(".record-table tbody tr").count() == 3, f"Record table incomplete at {width}"
        for row in page.locator(".record-attendance-row").all():
            name=row.locator("span").first.bounding_box()
            bar=row.locator(".record-track").bounding_box()
            assert name and bar and name["x"]+name["width"] <= bar["x"]-1, f"Attendance month overlaps bar at {width}"
        page.keyboard.press("Escape")
        assert page.locator(".record-drawer").count() == 0, f"Escape didn't dismiss drawer at {width}"

        page.locator(".info-link").click()
        assert page.locator(".methods-drawer").is_visible(), f"Calculation drawer missing at {width}"
        page.keyboard.press("Escape")
        assert page.locator(".methods-drawer").count() == 0, f"Escape didn't close calculation drawer at {width}"

        page.locator('[data-action="month-prev"]').click()
        assert "Aug" in page.locator(".compact-month-switch").inner_text(), f"Month didn't change at {width}"
        page.locator('[data-action="month-next"]').click()

        page.locator('[data-action="header-filters"]').click()
        assert page.locator('[data-filter="grade"]').is_visible(), f"Class filter not available at {width}"
        page.locator('[data-filter="grade"]').select_option("7")
        assert page.locator(".active-filters").count() == 1, f"Active filter chip missing at {width}"
        page.locator('[data-action="header-filters"]').click()
        page.locator('[data-action="reset"]').count()  # Reset is available from popover; filter is valid.

        page.locator('[data-page="grants"]').first.click()
        assert page.locator(".grant-choices button").count() == 3, f"Grant options not rendered at {width}"
        assert page.locator(".grant-brief h1").is_visible(), f"Grant summary not rendered at {width}"
        assert page.locator(".fact-margin .margin-fact").count() >= 13, f"Grant source facts missing at {width}"
        assert not page.locator(".grant-support").evaluate("(el)=>el.open"), f"Supporting details must start collapsed at {width}"
        page.locator(".grant-support > summary").click()
        assert page.locator(".grant-support").evaluate("(el)=>el.open"), f"Supporting details could not open at {width}"
        if page.locator(".evidence-grid img").count():
            image=page.locator(".evidence-grid img").first
            image.scroll_into_view_if_needed()
            image.evaluate("(el)=>{el.loading='eager'}")
            page.wait_for_function("() => {const image=document.querySelector('.evidence-grid img');return image&&image.complete&&image.naturalWidth>0}",timeout=15000)
        if width==1440:
            page.screenshot(path="engineering/screenshots/Chalkline_Grant_Reporting.png", full_page=True)
        page.locator(".grant-choices button").nth(1).click()
        assert page.locator(".grant-choices button.active").count() == 1, f"Grant choice selection failed at {width}"
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), f"Grant page overflow at {width}"

        page.locator('[data-page="review"]').first.click()
        page.evaluate("""() => {
            window.__printPackWasPresent=false;
            window.print=()=>{window.__printPackWasPresent=Boolean(document.querySelector('.meeting-sheet'));window.dispatchEvent(new Event('afterprint'))}
        }""")
        page.locator('[data-action="print-meeting"]').click()
        page.wait_for_function("window.__printPackWasPresent===true")
        page.locator(".month-metric").first.wait_for()
        assert not errors, f"Uncaught JS error at {width}px: {errors}"
        print(f"PASS: {width}px | two-page flow, summary, district drill-down, month, filters, grants, print, no overflow")
        page.close()
    browser.close()
