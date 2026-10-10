// Verifica o clone rodando em http://localhost:<porta>.
// Checa: erros de console, pedidos que falharam, requisições para fora,
// conteúdo renderizado e, no fim, repete tudo com a internet bloqueada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = process.argv[2] || 4173;
const BASE = `http://localhost:${PORTA}`;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FORA = process.argv.includes('--offline') || process.env.OFFLINE === '1';

// as seis primeiras são artigos que o servidor original já entrega prontos
// (sem #root, sem bundle); o resto é React
const ARTIGOS = new Set(['/precos', '/sobre', '/perguntas-frequentes', '/receber-sms-online',
                         '/numero-virtual-whatsapp', '/numero-virtual-telegram', '/numero-virtual-instagram']);
const ROTAS = [...ARTIGOS, '/', '/cadastro', '/login', '/docs-api', '/status', '/termos', '/privacidade'];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });

const saida = [];

for (const rota of ROTAS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });
  const erros = [], falhas = [], externos = [];

  if (FORA) {                       // simula navegador sem internet: só o localhost passa
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('chrome-extension:')) return r.continue();
      externos.push(u);
      r.abort();
    });
  }
  // 401 em /api/auth/me e /api/keys é o comportamento esperado para visitante:
  // é assim que o próprio site descobre que ninguém entrou ainda
  const ESPERADO = /40[14] \/api\/(auth\/me|keys)$/;

  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 160)); });
  page.on('requestfailed', (r) => falhas.push(`${r.failure()?.errorText} ${r.url()}`.slice(0, 160)));
  page.on('response', (r) => {
    const linha = `${r.status()} ${r.url().replace(BASE, '')}`;
    if (r.status() >= 400 && !ESPERADO.test(linha)) falhas.push(linha);
  });

  try {
    await page.goto(BASE + rota, { waitUntil: 'networkidle2', timeout: 45000 });
  } catch (e) { erros.push('goto: ' + e.message.split('\n')[0]); }
  await new Promise((r) => setTimeout(r, 2200));

  const medida = await page.evaluate(() => ({
    nos: document.querySelectorAll('#root *').length,
    artigo: !!document.querySelector('article'),
    texto: (document.body.innerText || '').replace(/\s+/g, ' ').trim(),
    cartoes: document.querySelectorAll('img').length,
    imagens_quebradas: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).length,
    fontes: [...new Set([...document.querySelectorAll('h1,h2,p,button,a')].map((e) => getComputedStyle(e).fontFamily).values())].slice(0, 4),
  }));

  const nome = rota === '/' ? 'index' : rota.slice(1);
  fs.mkdirSync(path.join(RAIZ, 'raw/clone-pages'), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'raw/clone-pages', nome + '.html'),
    await page.content(), 'utf8');
  fs.mkdirSync(path.join(RAIZ, 'raw/clone-shots', FORA ? 'offline' : 'online'), { recursive: true });
  await page.screenshot({ path: path.join(RAIZ, 'raw/clone-shots', FORA ? 'offline' : 'online', nome + '.png') });
  await page.close();

  externos.length && externos.every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)) ? null
    : externos.filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u)).forEach((u) => falhas.push('FORA ' + u));

  // artigo pronto não tem #root (é HTML do servidor); React monta no navegador.
  // A fidelidade DOM, rota por rota, é medida depois em tools/diff.py.
  const esperado = ARTIGOS.has(rota)
    ? { minNos: 0, artigo: true }
    : { minNos: 80, artigo: false };
  const limpo = medida.nos >= esperado.minNos && !falhas.length && !erros.length
                && medida.texto.length > 400 && medida.imagens_quebradas === 0
                && (esperado.artigo ? medida.artigo : true);

  saida.push({ rota, tipo: esperado.artigo ? 'artigo' : 'react', nos: medida.nos,
               chars: medida.texto.length, imgs: medida.cartoes,
               imgs_quebradas: medida.imagens_quebradas, fontes: medida.fontes, limpo,
               erros_console: [...new Set(erros)], falhas: [...new Set(falhas)] });
  console.log(`${limpo ? 'ok  ' : 'REV '}${rota.padEnd(26)} ${(esperado.artigo ? 'artigo' : 'react ').slice(0,6)} ` +
              `nodes=${String(medida.nos).padStart(5)} texto=${String(medida.texto.length).padStart(6)} ` +
              `imgs=${medida.cartoes} quebradas=${medida.imagens_quebradas} ` +
              `erros=${erros.length} falhas=${falhas.length}`);
}

fs.writeFileSync(path.join(RAIZ, `raw/verificacao-${FORA ? 'offline' : 'online'}.json`),
  JSON.stringify(saida, null, 2), 'utf8');

const ruim = saida.filter((s) => !s.limpo);
console.log(`\n${saida.length - ruim.length}/${saida.length} rotas limpas | modo ${FORA ? 'SEM INTERNET' : 'online'}`);
if (ruim.length) console.log(JSON.stringify(ruim, null, 2));
await browser.close();
process.exit(ruim.length ? 1 : 0);
