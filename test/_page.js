import puppeteer from 'puppeteer';

export const getConsolePage = async (url, timeout = 1000) => {
  const args = await puppeteer.defaultArgs();
  const browser = await puppeteer.launch({
    args: [...args, '--enable-experimental-web-platform-features']
  });
  const page = await browser.newPage();
  let consoleText = '';

  await page.goto(url);

  await new Promise((resolve, reject) => {
    page.on('console', msg => {
      consoleText += `${msg.text()};`;
    });

    setTimeout(resolve, timeout);
  });

  await browser.close();

  return consoleText;
};
