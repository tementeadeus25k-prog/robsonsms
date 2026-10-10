// Renderiza cada página do site com o Chrome local e salva:
//  raw/pages/<rota>.html  -> DOM completo depois do React hidratar
//  raw/assets.json        -> lista de tudo que a página baixou (JS, CSS, imagens, fontes, APIs)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ORIGIN = 'https://allansms.com';
const RAW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'raw');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ROUTES = [
  '/', '/receber-sms-online', '/numero-virtual-whatsapp', '/numero-virtual-telegram',
  '/numero-virtual-instagram', '/precos', '/perguntas-frequentes', '/sobre',
  '/cadastro', '/login', '/docs-api', '/status', '/termos', '/privacidade',
];

const fileFor = (route) => (route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '__'));

for (const d of ['pages', 'shots']) await fs.mkdir(path.join(RAW, d), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

const bag = new Map(); // url -> { type, ct, size }
const apiHits = [];

for (const route of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  page.on('response', async (res) => {
    try {
      const url = res.url();
      let u;
      try { u = new URL(url); } catch { return; }
      const rec = { url, type: res.request().resourceType(), status: res.status(), ct: res.headers()['content-type'] || '' };
      if (u.origin === new URL(ORIGIN).origin) {
        if (!bag.has(url)) bag.set(url, rec);
      }
      if (rec.type === 'xhr' || rec.type === 'fetch') apiHits.push({ route, ...rec });
    } catch {}
  });

  const full = ORIGIN + route;
  console.log('→', route);
  try {
    await page.goto(full, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    console.log('   goto avisou:', e.message.split('\n')[0]);
  }
  // deja las animaciones entrar y el estado de API aterrizar
  await new Promise((r) => setTimeout(r, 2500));
  try { await page.autoScroll?.(); } catch {}
  // scroll suave para disparar lazy-load / IntersectionObserver
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 1200));

  const html = await page.evaluate(() => '<!DOCTYPE html>\n' + document.documentElement.outerHTML);
  await fs.mkdir(path.join(RAW, 'pages'), { recursive: true });
  await fs.writeFile(path.join(RAW, 'pages', fileFor(route) + '.html'), html, 'utf8');

  // estados visuais (tema claro/escuro) e alturas para screenshot de referência
  await page.screenshot({ path: path.join(RAW, 'shots', fileFor(route) + '.png'), fullPage: false }).catch(() => {});
  await page.close();
}

await fs.mkdir(RAW, { recursive: true });
await fs.writeFile(path.join(RAW, 'assets.json'), JSON.stringify([...bag.values()], null, 2), 'utf8');
await fs.writeFile(path.join(RAW, 'api.json'), JSON.stringify(apiHits, null, 2), 'utf8');
await browser.close();
console.log('\nok —', bag.size, 'recursos próprios,', apiHits.length, 'chamadas de API');
