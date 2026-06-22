const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching headless browser...");
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  // Capture uncaught page errors
  page.on('pageerror', err => {
    console.log(`[BROWSER UNCAUGHT EXCEPTION] ${err.toString()}`);
  });

  console.log("Navigating to http://localhost:5173 ...");
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log("Page loaded successfully.");
    
    // Check if the page is completely blank (e.g. only #root with no children)
    const rootHtml = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML : 'No #root element found';
    });
    
    if (rootHtml.trim() === '') {
      console.log("[WARNING] The #root element is completely empty (blank screen).");
    } else {
      console.log("[INFO] Page rendered some HTML inside #root.");
    }
    
  } catch (err) {
    console.error(`Failed to navigate: ${err.message}`);
  }

  await browser.close();
})();
