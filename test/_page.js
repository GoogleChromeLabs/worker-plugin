import puppeteer from 'puppeteer';

export async function evaluatePage (url, matches, timeout = 28000) {
  const args = await puppeteer.defaultArgs();
  const browser = await puppeteer.launch({
    args: [
      ...args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-experimental-web-platform-features'
    ]
  });
  const page = await browser.newPage();
  await page.goto(url);

  try {
    return await new Promise((resolve, reject) => {
      page.on('console', msg => {
        const text = msg.text();
        if (text.match(matches)) {
          clearTimeout(timer);
          resolve(text);
        }
      });

      const timer = setTimeout(() => reject(Error('Timed Out')), timeout);
    });
  } finally {
    await browser.close();
  }
}
