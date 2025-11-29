from playwright.sync_api import sync_playwright

def verify_button():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8000/index.html")

        # Inject mock data and open the modal
        page.evaluate("""
            const mockJob = {
                id: 'job1',
                customer: 'Test Customer',
                status: 'Needs Scheduling',
                phone: '1234567890',
                address: '123 Test St',
                issue: 'Test Issue'
            };
            openScheduleJobModal(mockJob);
        """)

        # Wait for modal to be visible
        page.wait_for_selector("#scheduleJobModal", state="visible")

        # Check for the new button
        btn = page.locator("#triggerAiCallBtn")
        if btn.is_visible():
            print("Button is visible")
            print("Button text:", btn.inner_text())
        else:
            print("Button is NOT visible")

        # Take screenshot
        page.screenshot(path="verification/modal_verification.png")
        browser.close()

if __name__ == "__main__":
    verify_button()
