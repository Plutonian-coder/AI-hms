const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    if (!fs.existsSync('screenshots')) {
        fs.mkdirSync('screenshots');
    }

    try {
        console.log("Testing Login Page...");
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'screenshots/1_login.png' });

        // Login as student
        console.log("Logging in as student...");
        await page.type('input[type="text"]', 'FPT/CSC/25/0010');
        await page.type('input[type="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'screenshots/2_student_dashboard.png' });

        console.log("Testing Hostel Application Page...");
        await page.goto('http://localhost:5173/apply', { waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'screenshots/3_student_apply.png' });

        console.log("Testing Quiz Page...");
        await page.goto('http://localhost:5173/quiz', { waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'screenshots/4_student_quiz.png' });

        console.log("Logging out...");
        await page.evaluate(() => localStorage.clear());
        
        // Login as admin
        console.log("Logging in as admin...");
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="text"]', 'admin');
        await page.type('input[type="password"]', 'admin123'); // Assuming default admin password
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'screenshots/5_admin_dashboard.png' });

        console.log("Testing Admin Students...");
        await page.goto('http://localhost:5173/admin/students', { waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'screenshots/6_admin_students.png' });

        console.log("Testing Admin Applications...");
        await page.goto('http://localhost:5173/admin/applications', { waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'screenshots/7_admin_applications.png' });

        console.log("Testing Admin Allocations...");
        await page.goto('http://localhost:5173/admin/allocations', { waitUntil: 'networkidle0' });
        await page.screenshot({ path: 'screenshots/8_admin_allocations.png' });

        console.log("All screenshots captured successfully.");
    } catch (e) {
        console.error("Error during automation:", e);
    } finally {
        await browser.close();
    }
})();
