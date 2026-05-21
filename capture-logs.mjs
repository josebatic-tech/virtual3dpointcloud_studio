import puppeteer from 'puppeteer';

(async () => {
  let browser;
  try {
    // Launch with screen size to allow interactions
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const logs = [];
    page.on('console', msg => {
      const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      console.log(text);
      logs.push(text);
    });

    console.log('Opening http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));

    // Grant camera permission (note: in headless, this might not work, but let's try)
    console.log('Attempting to click Start button...');
    await page.click('#btnStart').catch(() => console.log('Could not find/click Start button'));

    await new Promise(r => setTimeout(r, 2000));

    console.log('Attempting to click Depth button...');
    await page.click('#btnDepth').catch(() => console.log('Could not find/click Depth button'));

    console.log('\nWaiting for depth processing logs (aspect/scale)...\n');

    // Wait for depth logs to appear
    let aspectLog = null;
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        aspectLog = logs.find(l => l.includes('aspect=') && l.includes('scale='));
        if (aspectLog) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000); // Wait max 30 seconds
    });

    console.log('\n\n=== FULL CONSOLE LOG ===\n');
    logs.forEach(l => console.log(l));
    console.log('\n=== END FULL LOG ===\n');

    if (aspectLog) {
      console.log('✓ Found aspect/scale log:', aspectLog);
    } else {
      console.log('! aspect/scale log not found');
    }

    await new Promise(r => setTimeout(r, 1000));
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
