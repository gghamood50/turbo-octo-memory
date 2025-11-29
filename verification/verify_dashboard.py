
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        # Open the index.html file directly from the filesystem
        page.goto('file://' + os.path.abspath('index.html'))

        # Click the login button to bypass the login screen if it's visible by default
        # Since we are modifying index.html/app.js directly, we are checking the static structure.
        # However, the app logic might hide the dashboard behind a login.
        # But we can inspect the DOM elements even if they are hidden, or force them visible for the screenshot.

        # Let's try to locate the specific stat cards by text content
        completed_jobs_label = page.get_by_text('Completed Jobs')
        invoice_value_label = page.get_by_text('Total Invoice Value')

        # We also want to see the IDs
        dashboard_completed_jobs = page.locator('#dashboardCompletedJobs')
        dashboard_total_invoice_value = page.locator('#dashboardTotalInvoiceValue')

        # Force the layout container to be visible if it's hidden (since auth is required usually)
        page.evaluate("document.getElementById('layoutContainer').style.display = 'flex'")
        page.evaluate("document.getElementById('loginScreen').style.display = 'none'")
        page.evaluate("document.getElementById('dashboard').classList.remove('hidden')")

        # Take a screenshot of the dashboard stats area
        # We can locate the container of the stats
        stats_container = page.locator('.stat-card-stitch').first.locator('..')

        stats_container.screenshot(path='verification/dashboard_stats.png')
        browser.close()

if __name__ == '__main__':
    run()
