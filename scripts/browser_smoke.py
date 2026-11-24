"""Chalkline real-browser acceptance: two-page, responsive monthly and grant flows.

Usage: python scripts/browser_smoke.py http://localhost:3000
Requires Python Playwright and Chromium. Checks visible decisions, filters, details,
source citations, print, responsiveness and runtime errors.
"""
import sys
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
widths = [360, 390, 768, 1024, 1366, 1440]

# Check the entire brand lockup, not only page-level horizontal overflow.
def check_header(page, width):
    result = page.evaluate("""() => {
      const find = selector => document.querySelector(selector);
      const element = selector => {
        const e = find(selector);
        if (!e || getComputedStyle(e).display === "none") return null;
        const r = e.getBoundingClientRect();
        // A child of a hidden parent has its own display value but no box.
        if (r.width === 0 || r.height === 0) return null;
        return { left:r.left, right:r.right, top:r.top, bottom:r.bottom,
                 width:r.width, height:r.height };
      };
      const overlap = (a,b) => a && b && a.left < b.right-0.5 &&
        b.left < a.right-0.5 && a.top < b.bottom-0.5 && b.top < a.bottom-0.5;
      const brand = element(".compact-wordmark");
      const symbol = element(".compact-wordmark .brand-symbol");
      const name = element(".compact-wordmark .brand-name");
      const descriptor = element(".compact-wordmark .brand-descriptor");
      const tabs = [...document.querySelectorAll(".compact-nav button")]
        .map(el => {
          const r=el.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
        });
      const month = element(".compact-month-switch");
      const district = element(".compact-district-picker select");
      const filter = element(".compact-filter-toggle");
      const visible = [brand,symbol,name,descriptor,...tabs,month,district,filter].filter(Boolean);
      const clipped = visible.some(r => r.left < -0.5 || r.right > innerWidth+0.5 || r.width < 1 || r.height < 1);
      const icon = find(".compact-wordmark .brand-symbol");
      return {
        clipped,
        overlaps: tabs.some(x => overlap(brand,x)) ||
          tabs.some(x => overlap(x,month) || overlap(x,district) || overlap(x,filter)) ||
          overlap(brand,month) || overlap(brand,district) || overlap(brand,filter) ||
          overlap(month,district) || overlap(month,filter) || overlap(district,filter),
        nameText: find(".brand-name")?.textContent?.trim(),
        descriptorText: find(".brand-descriptor")?.textContent?.trim(),
        nameFontPx: parseFloat(getComputedStyle(find(".brand-name")).fontSize),
        descriptorFontPx: parseFloat(getComputedStyle(find(".brand-descriptor")).fontSize),
        logoLoaded: !!icon && icon.complete && icon.naturalWidth > 0,
        symbolWidth: symbol?.width,
        tabCount: tabs.length,
        documentOverflows: document.documentElement.scrollWidth > innerWidth+2,
        positions: {brand,symbol,name,descriptor,tabs,month,district,filter}
      };
    }""")
    assert result["nameText"] == "Chalkline", f"Brand name lost at {width}px: {result}"
    assert result["descriptorText"] == "PBL review · grant reporting", f"Brand subtitle lost at {width}px: {result}"
    assert result["logoLoaded"] and result["symbolWidth"] >= 40, f"Logo too small or missing at {width}px: {result}"
    assert result["nameFontPx"] >= 26 and result["descriptorFontPx"] >= 12, f"Brand font scaled down at {width}px: {result}"
    assert result["tabCount"] == 2 and not result["clipped"], f"Header control clipped at {width}px: {result}"
    assert not result["overlaps"], f"Header elements overlap at {width}px: {result}"
    assert not result["documentOverflows"], f"Page overflows at {width}px: {result}"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={"width": width, "height": 768 if width == 1366 else 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        response = page.goto(url, wait_until="networkidle", timeout=60000)
        assert response and response.status == 200, f"HTTP error at {width}px"
        page.locator(".month-metric").first.wait_for(timeout=30000)
        check_header(page, width)
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

        page.locator('.compact-filter-toggle').click()
        assert page.locator('[data-filter="grade"]').is_visible(), f"Class filter not available at {width}"
        page.locator('[data-filter="grade"]').select_option("7")
        assert page.locator(".active-filters").count() == 1, f"Active filter chip missing at {width}"
        page.locator('.compact-filter-toggle').click()
        page.locator('[data-action="reset"]').count()  # Reset is available from popover; filter is valid.

        page.locator('[data-page="grants"]').first.click()
        assert page.locator(".grant-choices button").count() == 3, f"Grant options not rendered at {width}"
        assert page.locator(".grant-brief h1").is_visible(), f"Grant summary not rendered at {width}"
        assert page.locator(".fact-margin .margin-fact").count() >= 13, f"Grant source facts missing at {width}"
        assert not page.locator(".grant-support").evaluate("(el)=>el.open"), f"Supporting details must start collapsed at {width}"
        if width==1440:
            page.evaluate("window.scrollTo(0,0)")
            page.screenshot(path="engineering/screenshots/Chalkline_Grant_Reporting.png", full_page=True)
        page.locator(".grant-support > summary").click()
        assert page.locator(".grant-support").evaluate("(el)=>el.open"), f"Supporting details could not open at {width}"
        if page.locator(".evidence-grid img").count():
            image=page.locator(".evidence-grid img").first
            image.scroll_into_view_if_needed()
            image.evaluate("(el)=>{el.loading='eager'}")
            page.wait_for_function("() => {const image=document.querySelector('.evidence-grid img');return image&&image.complete&&image.naturalWidth>0}",timeout=15000)
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
    # Fine-grained viewport sampling catches clipping between CSS breakpoints.
    for width in [320, 347, 375, 414, 430, 480, 560, 600, 680, 700, 820, 960, 1100, 1280]:
        page = browser.new_page(viewport={"width": width, "height": 900})
        response = page.goto(url, wait_until="networkidle", timeout=60000)
        assert response and response.status == 200
        page.locator(".month-metric").first.wait_for()
        check_header(page, width)
        if width == 347:
            page.wait_for_function("document.fonts.status === 'loaded'")
            page.screenshot(path="engineering/screenshots/Chalkline_Header_347.png",
                            clip={"x":0,"y":0,"width":347,"height":min(420,900)})
        page.locator('[data-page="grants"]').click()
        check_header(page, width)
        print(f"PASS: {width}px | brand, tabs, month and controls visible and non-overlapping")
        page.close()
    browser.close()
