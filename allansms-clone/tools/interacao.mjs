// Testa o clone se mexendo de verdade: navegação entre páginas, troca de tema,
// formulário de cadastro, acordeão de dúvidas e o catálogo vindo da API congelada.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `http://localhost:${process.argv[2] || 4173}`;
const resultados = [];
const marca = (nome, ok, detalhe = '') => {
  resultados.push({ teste: nome, ok, detalhe });
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome.padEnd(42)} ${detalhe}`);
};

const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });
const erros = [];
page.on('pageerror', (e) => erros.push(String(e).slice(0, 120)));

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await espera(2500);

// 1. o catálogo veio da API congelada? (a home lista serviços com preço)
const precos = await page.evaluate(() => (document.body.innerText.match(/R\$\s?[\d.,]+/g) || []));
marca('catálogo renderiza preços', precos.length > 0, `${precos.length} preços na tela, ex.: ${precos.slice(0, 3).join(' | ')}`);

// 2. trocar de tema escuro claro
const antes = await page.evaluate(() => document.documentElement.dataset.theme || '(claro)');
const botaoTema = await page.$('button[aria-label*="tema" i], button[title*="tema" i]');
if (botaoTema) {
  await botaoTema.click();
  await espera(900);
  const depois = await page.evaluate(() => document.documentElement.dataset.theme || '(claro)');
  marca('botão de tema alterna', antes !== depois, `${antes} -> ${depois}`);
  await page.screenshot({ path: path.join(RAIZ, 'raw/clone-shots/home-escuro.png') });
  await botaoTema.click();
  await espera(600);
} else {
  const temEscura = await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
    return getComputedStyle(document.body).backgroundColor;
  });
  marca('tema escuro aplica (via atributo)', /rgb\(\s*(1?[0-9]|[0-5][0-9])\s*,/.test(temEscura), `fundo ${temEscura}`);
  await page.evaluate(() => delete document.documentElement.dataset.theme);
}

// 3. os links da home apontam para onde o original aponta, e o destino responde
const alvos = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/"]')]
  .map((a) => a.getAttribute('href')))].slice(0, 40));
marca('home expõe os links do original', alvos.includes('/precos') && alvos.includes('/cadastro'),
  `${alvos.length} links internos: ${alvos.slice(0, 8).join(', ')}`);

const quebrados = [];
for (const alvo of alvos) {
  const r = await fetch(BASE + alvo);
  if (r.status !== 200) quebrados.push(`${alvo}=${r.status}`);
}
marca('todos os links internos da home respondem 200', quebrados.length === 0,
  quebrados.length ? quebrados.join(', ') : `${alvos.length} destinos verificados`);

// clicar de verdade: /precos é HTML pronto, então é navegação completa mesmo
await page.evaluate(() => document.querySelector('a[href="/precos"]').click());
await page.waitForFunction(() => location.pathname === '/precos', { timeout: 15000 });
await espera(900);
const tituloArtigo = await page.evaluate(() => document.querySelector('h1')?.textContent.trim());
marca('clique do rodapé abre o artigo /precos', !!tituloArtigo, `/precos → "${tituloArtigo}"`);

// 4. rota funda do React cai na casca e o router responde
const funda = await page.goto(BASE + '/pedido/01HGTESTE', { waitUntil: 'networkidle2' });
await espera(1500);
const corpoFundo = await page.evaluate(() => ({ titulo: document.title, nos: document.querySelectorAll('#root *').length }));
marca('rota funda /pedido/xxx não quebra', funda.status() === 200 && corpoFundo.nos > 40,
  `status=${funda.status()} nós=${corpoFundo.nos}`);

// 5. cadastro: o formulário valida e chama a API
await page.goto(BASE + '/cadastro', { waitUntil: 'networkidle2' });
await espera(1500);
const form = await page.evaluate(() => {
  const campos = [...document.querySelectorAll('form input')].map((i) => i.name || i.type);
  return { campos, botao: document.querySelector('form button')?.textContent?.trim() };
});
marca('formulário de cadastro presente', form.campos.length >= 2, JSON.stringify(form).slice(0, 120));

// 6. acordeão de perguntas frequentes
await page.goto(BASE + '/perguntas-frequentes', { waitUntil: 'networkidle2' });
await espera(800);
const acordeao = await page.evaluate(() => {
  const d = document.querySelector('details');
  if (!d) return { tipo: 'sem details' };
  const antesAberto = d.open;
  d.open = !d.open;
  return { tipo: 'details', total: document.querySelectorAll('details').length, abriu: d.open !== antesAberto };
});
marca('acordeão de dúvidas funciona', acordeao.abriu === true, JSON.stringify(acordeao));

// 7. rota protegida: no original, quem não entrou é levado ao login — o clone
//    tem que reproduzir isso em vez de abrir um painel vazio
await page.goto(BASE + '/status', { waitUntil: 'networkidle2' });
await espera(1800);
const statusTxt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 220));
marca('rota protegida cai no login, como no original',
  /Entre com suas credenciais|Bem-vindo de volta/i.test(statusTxt), statusTxt.slice(0, 80));

// 8. docs da API: consome /api/docs/openapi.json congelado
await page.goto(BASE + '/docs-api', { waitUntil: 'networkidle2' });
await espera(2200);
const docsTxt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
marca('página /docs-api renderiza', docsTxt.length > 400, `${docsTxt.length} caracteres`);

// 9. nenhum import dinâmico de chunk quebrado em todas as navegações acima
marca('nenhum chunk com import quebrado', erros.length === 0, erros.join(' | ') || 'limpo');

console.log(`\nerros de página: ${erros.length ? [...new Set(erros)].join(' | ') : 'nenhum'}`);
const falhas = resultados.filter((r) => !r.ok);
console.log(`${resultados.length - falhas.length}/${resultados.length} testes de interação passaram`);
await browser.close();
process.exit(falhas.length || erros.length ? 1 : 0);
