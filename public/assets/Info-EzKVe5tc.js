import{j as e}from"./animacao-DEFl0xIm.js";import{r as m}from"./react-DpUMDULK.js";import{A as q}from"./AppLayout-3R8-2TCq.js";import{u as P,d as h,t as G,r as O,c as y,Y as b,N as D,F as J,Z as V,B,s as Y,y as X,a as E,H as W,w as Q,a2 as R,l as U,A as Z,b as ee}from"./index-Xoo-Dd8d.js";const A=typeof window<"u"?window.location.origin:"/";function C(o,c,n="text/plain"){const d=URL.createObjectURL(new Blob([c],{type:`${n};charset=utf-8`})),s=document.createElement("a");s.href=d,s.download=o,document.body.appendChild(s),s.click(),s.remove(),setTimeout(()=>URL.revokeObjectURL(d),1e3)}const M={"Node.js":{arquivo:"robsonsms.mjs",codigo:`// Node 18+  →  ROBSONSMS_KEY=sk_live_... node robsonsms.mjs
import { randomUUID } from 'node:crypto';

const API = '${A}/api/v1';
const CHAVE = process.env.ROBSONSMS_KEY;

async function req(rota, { method = 'GET', body, idem } = {}) {
  const r = await fetch(API + rota, {
    method,
    headers: {
      Authorization: \`Bearer \${CHAVE}\`,
      'Content-Type': 'application/json',
      ...(idem ? { 'Idempotency-Key': idem } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  // erro sempre vem como { error: { code, message } } — trate pelo code
  if (!r.ok) throw Object.assign(new Error(j.error.message), { code: j.error.code });
  return j.data ?? j;
}

export async function comprarComSms(service = 'whatsapp', country = 'brazil') {
  // 1) preço ANTES de vender: é o seu custo. Some sua margem em cima dele.
  const catalogo = await req(\`/services?country=\${country}\`);
  const item = catalogo.find((s) => s.code === service);
  if (!item) throw new Error('sem estoque agora');

  // 2) compra. Idempotency-Key: se a rede cair e você reenviar, não compra 2 números.
  const pedido = await req('/orders', {
    method: 'POST',
    idem: randomUUID(),
    body: { country, service, max_price_cents: item.price_cents },
  });
  console.log('número:', pedido.phone);

  // 3) o número fica ativo até 20 min e recebe VÁRIOS SMS (código, link, aviso).
  //    Consulte a cada 5 s; cada consulta já checa o fornecedor.
  const vistos = new Set();
  while (true) {
    const p = await req(\`/orders/\${pedido.id}\`);
    for (const m of p.messages) {
      const k = m.received_at + m.text;
      if (!vistos.has(k)) { vistos.add(k); console.log('SMS:', m.code ?? '-', '|', m.text); }
    }
    if (p.is_final) return p;                       // completed / refunded / expired
    if (!vistos.size && p.can_cancel && Date.now() - Date.parse(p.created_at + 'Z') > 10 * 60_000) {
      return req(\`/orders/\${pedido.id}/cancel\`, { method: 'POST' }); // sem SMS: estorno
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

comprarComSms().catch((e) => console.error(e.code, e.message)); // ex.: insufficient_balance
`},PHP:{arquivo:"robsonsms.php",codigo:`<?php
// php robsonsms.php   (defina ROBSONSMS_KEY no ambiente)
const API = '${A}/api/v1';

function req(string $rota, ?array $body = null, ?string $idem = null) {
    $ch = curl_init(API . $rota);
    $h = ['Authorization: Bearer ' . getenv('ROBSONSMS_KEY'), 'Content-Type: application/json'];
    if ($idem) $h[] = 'Idempotency-Key: ' . $idem;
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $h]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $r = json_decode(curl_exec($ch), true);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    // erro: { error: { code, message } } — trate pelo code
    if ($status >= 400) throw new Exception($r['error']['code'] . ': ' . $r['error']['message']);
    return $r['data'] ?? $r;
}

// 1) seu custo
$item = null;
foreach (req('/services?country=brazil') as $s) if ($s['code'] === 'whatsapp') $item = $s;
if (!$item) exit("sem estoque agora\\n");

// 2) compra (Idempotency-Key evita comprar duas vezes num reenvio)
$pedido = req('/orders', ['country' => 'brazil', 'service' => 'whatsapp',
    'max_price_cents' => $item['price_cents']], bin2hex(random_bytes(16)));
echo "número: {$pedido['phone']}\\n";

// 3) várias mensagens em até 20 min — consulte de 5 em 5 segundos
$vistos = [];
while (true) {
    $p = req('/orders/' . $pedido['id']);
    foreach ($p['messages'] as $m) {
        $k = $m['received_at'] . $m['text'];
        if (!isset($vistos[$k])) { $vistos[$k] = 1; echo "SMS: {$m['text']}\\n"; }
    }
    if ($p['is_final']) break;
    sleep(5);
}
`},Python:{arquivo:"robsonsms.py",codigo:`# python robsonsms.py   (pip install requests; defina ROBSONSMS_KEY)
import os, time, uuid, requests

API = '${A}/api/v1'
S = requests.Session()
S.headers.update({'Authorization': f"Bearer {os.environ['ROBSONSMS_KEY']}"})

def req(metodo, rota, body=None, idem=None):
    h = {'Idempotency-Key': idem} if idem else {}
    r = S.request(metodo, API + rota, json=body, headers=h)
    j = r.json()
    if not r.ok:  # erro: { error: { code, message } } — trate pelo code
        raise RuntimeError(f"{j['error']['code']}: {j['error']['message']}")
    return j.get('data', j)

def comprar_com_sms(service='whatsapp', country='brazil'):
    item = next((s for s in req('GET', f'/services?country={country}') if s['code'] == service), None)
    if not item:
        raise RuntimeError('sem estoque agora')

    pedido = req('POST', '/orders',
                 {'country': country, 'service': service, 'max_price_cents': item['price_cents']},
                 idem=str(uuid.uuid4()))
    print('número:', pedido['phone'])

    vistos = set()
    while True:  # até 20 min, vários SMS
        p = req('GET', f"/orders/{pedido['id']}")
        for m in p['messages']:
            k = m['received_at'] + m['text']
            if k not in vistos:
                vistos.add(k)
                print('SMS:', m.get('code'), '|', m['text'])
        if p['is_final']:
            return p
        time.sleep(5)

if __name__ == '__main__':
    comprar_com_sms()
`},"Aluguel (Node.js)":{arquivo:"robsonsms-aluguel.mjs",codigo:`// Aluguel de número: número só seu por dias, recebendo todos os SMS do período.
import { randomUUID } from 'node:crypto';
const API = '${A}/api/v1';
const h = { Authorization: \`Bearer \${process.env.ROBSONSMS_KEY}\`, 'Content-Type': 'application/json' };
const get = (r) => fetch(API + r, { headers: h }).then((x) => x.json());

const prazos = (await get('/rentals/periods?country=brazil')).data;     // ex.: [{ hours: 168, label: '7 dias' }]
const servicos = (await get(\`/rentals/services?country=brazil&hours=\${prazos[0].hours}\`)).data;
const s = servicos.find((x) => x.code === 'whatsapp') ?? servicos[0];

const r = await fetch(API + '/rentals', {
  method: 'POST',
  headers: { ...h, 'Idempotency-Key': randomUUID() },
  body: JSON.stringify({ country: 'brazil', service: s.code, hours: prazos[0].hours, max_price_cents: s.price_cents }),
}).then((x) => x.json());
console.log('número alugado:', r.data.phone, 'até', r.data.expires_at);
// Reembolso só cancelando nos primeiros 20 min, sem SMS (POST /rentals/:id/cancel, após cancel_in segundos).
// Depois: GET /rentals/{id} traz todas as mensagens recebidas.
`}},oe=[{icone:e.jsx(G,{size:17}),titulo:"Onde entra a sua margem",texto:"O preço de /services é o SEU custo — o valor debitado na compra. Sua margem é o que você cobra a mais do seu cliente. Leia o preço a cada venda e mande max_price_cents na compra: se o preço subir, a compra é recusada (price_above_max) sem cobrar."},{icone:e.jsx(D,{size:17}),titulo:"Vários SMS no mesmo número",texto:'O número temporário fica ativo até 20 minutos e recebe vários SMS (código, link, aviso). Leia o array "messages" de GET /orders/{id}; "sms_code" é só o último código. Pare quando "is_final" for true.'},{icone:e.jsx(J,{size:17}),titulo:"De quanto em quanto tempo consultar",texto:"A cada 5 segundos. Cada consulta já força uma checagem no fornecedor; intervalos menores não trazem o código mais rápido, só esbarram no limite (rate_limited)."},{icone:e.jsx(V,{size:17}),titulo:"Quando o código não chega",texto:'Chame POST /orders/{id}/cancel depois de "cancel_in" segundos: o valor volta inteiro. Se não cancelar, ele expira e estorna sozinho do mesmo jeito — cancelar só libera o dinheiro mais cedo.'},{icone:e.jsx(B,{size:17}),titulo:"Servidores e qualidade",texto:'GET /servers mostra cada servidor (s1, s2...) com preço, % de entrega e tempo médio reais. O "auto" já escolhe o melhor equilíbrio entre preço e entrega. Servidor sem saldo ou desligado some sozinho — sua integração não precisa mudar.'},{icone:e.jsx(Y,{size:17}),titulo:"Aluguel de número",texto:"Número só seu por dias (/rentals). Reembolso só cancelando nos primeiros 20 min, sem SMS, e se o fornecedor devolver; depois disso, sem reembolso. Avise isso ao seu cliente."},{icone:e.jsx(X,{size:17}),titulo:"Compra segura (Idempotency-Key)",texto:"Mande um Idempotency-Key único em cada compra. Se a resposta se perder e você reenviar a mesma chave, recebe o mesmo pedido em vez de comprar outro número. Guarde a chave da API no servidor, nunca no app ou no front-end."},{icone:e.jsx(O,{size:17}),titulo:"Erros",texto:"Sempre { error: { code, message } }. Os principais: insufficient_balance (402), out_of_stock, price_changed, price_above_max, cancel_too_early (409), service_unavailable / country_unavailable (422), rate_limited (429). Em falha de compra o valor nunca fica preso: é estornado na hora."}];function ae(){const[o,c]=m.useState("Node.js"),n=P(),d=M[o];return e.jsxs(e.Fragment,{children:[e.jsxs(h,{hover:!1,style:{marginBottom:16},children:[e.jsxs("strong",{className:"row",style:{gap:9,fontFamily:"var(--font-display)",fontSize:16},children:[e.jsx(G,{size:18})," Guia do revendedor"]}),e.jsxs("p",{className:"muted",style:{fontSize:13,margin:"6px 0 0",lineHeight:1.6},children:["Para quem vai vender nossos números na própria loja. O fluxo é sempre o mesmo:",e.jsx("strong",{children:" consultar o preço → comprar → ler as mensagens → cancelar se não vier"}),". Você paga só pelo número que recebeu SMS."]}),e.jsx("div",{className:"grid cols-2",style:{marginTop:16},children:oe.map(s=>e.jsxs("div",{style:{border:"1px solid var(--hairline)",borderRadius:13,padding:"13px 15px"},children:[e.jsxs("div",{className:"row",style:{gap:9,marginBottom:5},children:[e.jsx("span",{className:"icon-tile",style:{width:30,height:30,marginBottom:0},children:s.icone}),e.jsx("strong",{style:{fontSize:14},children:s.titulo})]}),e.jsx("div",{className:"muted",style:{fontSize:13,lineHeight:1.55},children:s.texto})]},s.titulo))})]}),e.jsxs(h,{hover:!1,style:{marginBottom:16},children:[e.jsxs("div",{className:"row between wrap",style:{gap:10,marginBottom:12},children:[e.jsxs("strong",{className:"row",style:{gap:9,fontFamily:"var(--font-display)",fontSize:16},children:[e.jsx(O,{size:18})," Integração completa"]}),e.jsx("div",{className:"row wrap",style:{gap:6},children:Object.keys(M).map(s=>e.jsx("button",{className:"hchip",onClick:()=>c(s),style:o===s?{borderColor:"var(--azul)",color:"var(--azul-texto)",fontWeight:600}:{},children:s},s))})]}),e.jsx("pre",{style:{background:"var(--bg-2)",border:"1px solid var(--hairline-2)",borderRadius:14,padding:"15px 17px",overflowX:"auto",fontSize:12,lineHeight:1.65,margin:0},children:e.jsx("code",{children:d.codigo})}),e.jsxs("div",{className:"row wrap",style:{gap:8,marginTop:12},children:[e.jsx(y,{icon:e.jsx(b,{size:14}),onClick:()=>navigator.clipboard.writeText(d.codigo).then(()=>n("Código copiado!")),children:"Copiar exemplo"}),e.jsxs(y,{onClick:()=>{C(d.arquivo,d.codigo),n(`${d.arquivo} baixado`)},children:["Baixar ",d.arquivo]})]})]})]})}const se=[["Como recebo o código SMS?","Após comprar, o número aparece no painel. O código chega automaticamente em segundos — sem precisar atualizar."],["E se o SMS não chegar?","Cada número fica ativo por 20 minutos e recebe vários SMS nesse prazo. Sem nenhum código, o cancelamento e o reembolso para o saldo são automáticos — e você pode cancelar antes, se quiser."],["Como adiciono saldo?","Via PIX: gere o QR Code em Recargas e o crédito cai automaticamente assim que o pagamento é confirmado."],["Posso cancelar um pedido?","Sim — enquanto estiver aguardando SMS. O valor volta integral para o seu saldo na hora."],["Posso usar para qualquer serviço?","Disponibilizamos os serviços do catálogo. Uso fraudulento, spam ou abuso violam os termos e suspendem a conta."],["Como funciona a indicação?","Compartilhe seu link da página Afiliados; você recebe comissão em saldo a cada depósito confirmado dos indicados."]];function me(){const[o,c]=m.useState(null);return m.useEffect(()=>{E("/api/site").then(c).catch(()=>{})},[]),e.jsx(q,{title:"FAQ / Ajuda",sub:"Respostas rápidas para as dúvidas mais comuns",children:e.jsxs("div",{className:"grid cols-2",style:{alignItems:"start"},children:[e.jsx("div",{children:se.map(([n,d],s)=>e.jsxs(h,{hover:!1,index:s,style:{marginBottom:12},children:[e.jsx("strong",{style:{display:"block",marginBottom:7,fontSize:14},children:n}),e.jsx("p",{className:"muted",style:{margin:0,fontSize:14,lineHeight:1.6},children:d})]},n))}),e.jsxs(h,{hover:!1,index:1,children:[e.jsxs("strong",{className:"row",style:{gap:9,fontFamily:"var(--font-display)",fontSize:16},children:[e.jsx(W,{size:18})," Suporte"]}),e.jsx("p",{className:"muted",style:{fontSize:14,lineHeight:1.65},children:"Não achou a resposta? Fale com a gente — respondemos rápido."}),e.jsxs("div",{className:"row wrap",style:{gap:8},children:[o!=null&&o.support_whatsapp?e.jsx("a",{className:"trust",href:o.support_whatsapp,target:"_blank",rel:"noreferrer",style:{color:"var(--azul-texto)"},children:"WhatsApp"}):e.jsx("span",{className:"trust",children:"WhatsApp · em breve"}),o!=null&&o.support_telegram?e.jsx("a",{className:"trust",href:o.support_telegram,target:"_blank",rel:"noreferrer",style:{color:"var(--azul-texto)"},children:"Telegram"}):e.jsx("span",{className:"trust",children:"Telegram · em breve"}),e.jsx("a",{className:"trust",href:`mailto:${(o==null?void 0:o.support_email)??""}`,style:{color:"var(--azul-texto)"},children:(o==null?void 0:o.support_email)??"…"})]})]})]})})}function ue(){const[o,c]=m.useState(null);m.useEffect(()=>{const u=()=>fetch("/health").then(v=>v.json()).then(c).catch(()=>{});u();const p=setInterval(u,1e4);return()=>clearInterval(p)},[]);const n=u=>{if(u==="database")return"Banco de dados";const p=/^servidor(\d+)$/.exec(u);return p?`Servidor ${p[1]}`:u},d={OK:"completed",WARNING:"pending",ERROR:"failed"},s={OK:"Operacional",WARNING:"Atenção",ERROR:"Fora do ar"};return e.jsxs(q,{title:"Status do Sistema",sub:"Monitoramento em tempo real — atualiza a cada 10s",children:[!o&&e.jsx(U,{h:120}),o&&e.jsxs(e.Fragment,{children:[e.jsxs(h,{hover:!1,className:o.status==="OK"?"accent-green":o.status==="WARNING"?"accent-orange":"accent-red",style:{marginBottom:18},children:[e.jsxs("div",{className:"row between wrap",style:{gap:12},children:[e.jsxs("strong",{className:"row",style:{gap:10,fontFamily:"var(--font-display)",fontSize:18},children:[e.jsx(Z,{size:20})," Plataforma ROBSONSMS"]}),e.jsxs("span",{className:`badge ${d[o.status]}`,style:{fontSize:13},children:[e.jsx("span",{className:"pulse-dot",style:{width:6,height:6}})," ",s[o.status]]})]}),e.jsxs("p",{className:"muted",style:{margin:"8px 0 0",fontSize:13},children:["Última checagem: ",o.ts]})]}),e.jsx("div",{className:"grid cols-2",children:Object.entries(o.checks).map(([u,p],v)=>e.jsx(h,{hover:!1,index:v,children:e.jsxs("div",{className:"row between",children:[e.jsx("strong",{style:{fontSize:14},children:n(u)}),e.jsx("span",{className:`badge ${d[p]}`,children:s[p]})]})},u))})]})]})}const re=[["GET","/api/v1/me","Sua conta e saldo","{ data: { id, name, email, balance_cents } }"],["GET","/api/v1/balance","Saldo da conta em centavos","{ balance_cents, currency }"],["GET","/api/v1/countries","Países disponíveis","{ data: [{ code, name }] }"],["GET","/api/v1/services?country=brazil","Serviços que dá para comprar agora (preço final e estoque). &all=1 inclui sem estoque; &server=s1 filtra um servidor","{ data: [{ code, name, price_cents, stock, available }] }"],["GET","/api/v1/servers?country=brazil&service=whatsapp","Servidores (s1, s2...) com preço, % de entrega e tempo médio reais","{ data: [{ id, price_cents, delivery_rate_pct, avg_seconds_to_sms, badges }] }"],["GET","/api/v1/operators?country=brazil","Operadoras com estoque no país",'{ data: ["any", ...] }'],["POST","/api/v1/orders","Comprar número — body { country, service, server?, operator?, max_price_cents? } + header Idempotency-Key","{ data: { id, phone, status, price_cents, expires_at, cancel_in } }"],["GET","/api/v1/orders/:id","Pedido + TODAS as mensagens (código, link, texto)","{ data: { id, phone, sms_code, messages[], status, is_final } }"],["GET","/api/v1/orders?status=active,sms_received&limit=50","Listar pedidos (com filtro)","{ data: [ ... ] }"],["POST","/api/v1/orders/:id/finish","Finalizar o número antes do prazo (depois de receber SMS)",'{ data: { status: "completed" } }'],["POST","/api/v1/orders/:id/cancel","Cancelar pedido sem SMS, após cancel_in segundos (estorno automático)",'{ data: { status: "refunded" } }'],["GET","/api/v1/rentals/countries","Aluguel de número: países","{ data: [{ code, name }] }"],["GET","/api/v1/rentals/servers?country=brazil","Aluguel: servidores (s1, s2...) — cada um com seus prazos e preços","{ data: [{ id, name, periods, services, from_price_cents }] }"],["GET","/api/v1/rentals/periods?country=brazil&server=s1","Aluguel: prazos do servidor (horas)","{ data: [{ hours, label, from_price_cents }] }"],["GET","/api/v1/rentals/services?country=brazil&hours=168&server=s1","Aluguel: serviços e preços do prazo no servidor","{ data: [{ code, name, price_cents }], operators }"],["POST","/api/v1/rentals","Alugar número — body { country, service, hours, server?, operator?, max_price_cents? } + Idempotency-Key","{ data: { id, phone, period, expires_at, cancel_in } }"],["GET","/api/v1/rentals/:id","Aluguel + todas as mensagens do período","{ data: { id, phone, status, messages[] } }"],["GET","/api/v1/rentals","Listar aluguéis","{ data: [ ... ] }"],["POST","/api/v1/rentals/:id/cancel","Cancelar aluguel: só nos 20 min iniciais, sem SMS, se o fornecedor devolver",'{ data: { status: "cancelled" } }']],te=[["401","unauthorized","Chave ausente, inválida ou revogada"],["402","insufficient_balance","Saldo insuficiente — nada foi cobrado"],["409","out_of_stock","Sem número disponível agora (ou todos os servidores falharam) — valor estornado"],["409","price_changed","O preço mudou entre a listagem e a compra — consulte e tente de novo"],["409","price_above_max","Preço atual acima do seu max_price_cents — nada foi cobrado"],["409","cancel_too_early","Ainda não dá para cancelar — veja cancel_in"],["409","cancel_not_allowed","Pedido/aluguel não pode mais ser cancelado"],["409","finish_not_allowed","Só dá para finalizar depois que um SMS chegou"],["422","service_unavailable","Serviço desativado ou inexistente"],["422","country_unavailable","País desativado ou inexistente"],["422","server_unavailable",'Servidor inválido — use "auto" ou um id de GET /servers'],["422","operator_unavailable","Operadora sem estoque para este serviço"],["422","period_unavailable","Prazo de aluguel inexistente ou desligado"],["422","invalid_request","Corpo da requisição inválido (campo faltando ou tipo errado)"],["404","not_found","Pedido/aluguel não existe ou é de outra conta"],["429","too_many_orders","Limite de pedidos ativos ou compras em sequência"],["429","rate_limited","Muitas requisições — aguarde alguns segundos"],["403","account_blocked","Conta suspensa"],["500","internal_error","Erro nosso — tente de novo; compras falhas são estornadas"]],ie={background:"var(--bg-2)",border:"1px solid var(--hairline-2)",borderRadius:12,padding:"13px 15px",fontSize:12,overflowX:"auto",margin:0,fontFamily:"'JetBrains Mono', ui-monospace, monospace",lineHeight:1.7};function L({code:o,label:c,arquivo:n}){const d=P();return e.jsxs("div",{style:{position:"relative",marginTop:10},children:[c&&e.jsx("div",{className:"muted",style:{fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono', monospace"},children:c}),e.jsx("pre",{style:ie,children:o}),e.jsxs("div",{className:"row",style:{position:"absolute",top:c?26:8,right:8,gap:6},children:[n&&e.jsx("button",{className:"hchip",onClick:()=>{C(n,o),d(`${n} baixado`)},children:"Baixar"}),e.jsxs("button",{className:"hchip",onClick:()=>navigator.clipboard.writeText(o).then(()=>d("Copiado!")),children:[e.jsx(b,{size:13})," Copiar"]})]})]})}const T=[{id:"balance",metodo:"GET",caminho:"/balance",grupo:"Conta",titulo:"Consultar saldo",desc:"Saldo disponível da conta, em centavos. Use antes de comprar para não tomar erro de saldo.",campos:[]},{id:"me",metodo:"GET",caminho:"/me",grupo:"Conta",titulo:"Minha conta",desc:"Dados da conta da chave e o saldo, em centavos.",campos:[]},{id:"countries",metodo:"GET",caminho:"/countries",grupo:"Catálogo",titulo:"Listar países",desc:"Países habilitados para compra.",campos:[]},{id:"services",metodo:"GET",caminho:"/services",grupo:"Catálogo",titulo:"Listar serviços e preços",desc:"Serviços de um país com preço final e estoque. O preço aqui é o que será cobrado.",campos:[{nome:"country",tipo:"query",padrao:"brazil",desc:"código do país"},{nome:"server",tipo:"query",padrao:"",desc:"opcional: s1, s2... (só aquele servidor)"},{nome:"all",tipo:"query",padrao:"",desc:"opcional: 1 = inclui sem estoque"}]},{id:"servers",metodo:"GET",caminho:"/servers",grupo:"Catálogo",titulo:"Servidores e qualidade",desc:"Servidores para um serviço: preço, estoque, % de SMS entregues e tempo médio até o SMS (pedidos reais dos últimos 30 dias). Selos: best_price, best_delivery, fastest.",campos:[{nome:"country",tipo:"query",padrao:"brazil",desc:"país"},{nome:"service",tipo:"query",padrao:"whatsapp",desc:"serviço"}]},{id:"operators",metodo:"GET",caminho:"/operators",grupo:"Catálogo",titulo:"Operadoras",desc:'Operadoras com estoque no país ("any" = qualquer).',campos:[{nome:"country",tipo:"query",padrao:"brazil",desc:"país"}]},{id:"buy",metodo:"POST",caminho:"/orders",grupo:"Números",titulo:"Comprar número",desc:"Debita o saldo e devolve o número. Se o fornecedor falhar, o valor é estornado automaticamente.",perigoso:!0,campos:[{nome:"country",tipo:"body",padrao:"brazil",desc:"país"},{nome:"service",tipo:"body",padrao:"whatsapp",desc:"código do serviço"},{nome:"operator",tipo:"body",padrao:"",desc:"operadora (opcional)"},{nome:"server",tipo:"body",padrao:"",desc:"auto (padrão) ou s1, s2..."},{nome:"max_price_cents",tipo:"body",numero:!0,padrao:"",desc:"não compra se o preço passar disto"}]},{id:"orders",metodo:"GET",caminho:"/orders",grupo:"Números",titulo:"Listar pedidos",desc:"Seus pedidos, do mais recente para o mais antigo.",campos:[{nome:"status",tipo:"query",padrao:"",desc:"opcional: active,sms_received..."},{nome:"limit",tipo:"query",padrao:"",desc:"opcional: 1 a 200 (padrão 50)"}]},{id:"order",metodo:"GET",caminho:"/orders/{id}",grupo:"Números",titulo:"Consultar pedido (e o código)",desc:'Consulta um pedido e força uma checagem no fornecedor. "sms_code" traz o último código e "messages" todos os SMS recebidos: o número continua recebendo até o prazo acabar.',campos:[{nome:"id",tipo:"path",padrao:"",desc:"ULID do pedido"}]},{id:"cancel",metodo:"POST",caminho:"/orders/{id}/cancel",grupo:"Números",titulo:"Cancelar pedido",desc:'Cancela um pedido que ainda não recebeu SMS e estorna o valor. Liberado 2 minutos depois da compra ("cancel_in" diz quantos segundos faltam).',perigoso:!0,campos:[{nome:"id",tipo:"path",padrao:"",desc:"ULID do pedido"}]},{id:"finish",metodo:"POST",caminho:"/orders/{id}/finish",grupo:"Números",titulo:"Finalizar número",desc:"Encerra o número antes do prazo, depois de ter recebido SMS. Opcional: sem isso ele encerra sozinho quando o prazo acaba.",campos:[{nome:"id",tipo:"path",padrao:"",desc:"ULID do pedido"}]},{id:"r-servers",metodo:"GET",caminho:"/rentals/servers",grupo:"Aluguel de número",titulo:"Servidores de aluguel",desc:"Servidor 1, 2... — cada um com os próprios prazos, serviços e preços.",campos:[{nome:"country",tipo:"query",padrao:"brazil",desc:"país"}]},{id:"r-periods",metodo:"GET",caminho:"/rentals/periods",grupo:"Aluguel de número",titulo:"Prazos de aluguel",desc:'Prazos com estoque no país e servidor, com o preço "a partir de" (em horas: 72 = 3 dias, 168 = 7 dias...).',campos:[{nome:"country",tipo:"query",padrao:"brazil",desc:"país"},{nome:"server",tipo:"query",padrao:"s1",desc:"servidor"}]},{id:"r-services",metodo:"GET",caminho:"/rentals/services",grupo:"Aluguel de número",titulo:"Serviços de aluguel",desc:"Serviços alugáveis no país e prazo, com preço final.",campos:[{nome:"country",tipo:"query",padrao:"brazil",desc:"país"},{nome:"hours",tipo:"query",padrao:"168",desc:"prazo em horas (de /rentals/periods)"},{nome:"server",tipo:"query",padrao:"s1",desc:"servidor"}]},{id:"r-buy",metodo:"POST",caminho:"/rentals",grupo:"Aluguel de número",titulo:"Alugar número",desc:"Aluga e devolve o número. Reembolso só cancelando nos primeiros 20 min, sem SMS, e se o fornecedor devolver; depois disso, sem reembolso.",perigoso:!0,campos:[{nome:"country",tipo:"body",padrao:"brazil",desc:"país"},{nome:"service",tipo:"body",padrao:"whatsapp",desc:"serviço"},{nome:"hours",tipo:"body",numero:!0,padrao:"168",desc:"prazo em horas"},{nome:"server",tipo:"body",padrao:"s1",desc:"servidor"},{nome:"max_price_cents",tipo:"body",numero:!0,padrao:"",desc:"opcional"}]},{id:"r-get",metodo:"GET",caminho:"/rentals/{id}",grupo:"Aluguel de número",titulo:"Consultar aluguel",desc:"Aluguel e todas as mensagens recebidas no período (remetente, texto, código).",campos:[{nome:"id",tipo:"path",padrao:"",desc:"id do aluguel"}]}];function ne({base:o,chaveNova:c}){const[n,d]=m.useState(""),[s,u]=m.useState(T[0].id),[p,v]=m.useState({}),[g,j]=m.useState(null),[_,z]=m.useState(!1),[N,w]=m.useState(null),r=P(),t=T.find(a=>a.id===s);m.useEffect(()=>{c&&d(c)},[c]);const x=a=>p[`${s}.${a.nome}`]??a.padrao??"",$=(a,i)=>v(l=>({...l,[`${s}.${a.nome}`]:i})),I=()=>{let a=t.caminho;const i=[];for(const l of t.campos){const S=String(x(l)).trim();l.tipo==="path"&&(a=a.replace(`{${l.nome}}`,encodeURIComponent(S||`{${l.nome}}`))),l.tipo==="query"&&S&&i.push(`${l.nome}=${encodeURIComponent(S)}`)}return`${o}/api/v1${a}${i.length?`?${i.join("&")}`:""}`},k=()=>{const a={};for(const i of t.campos){if(i.tipo!=="body")continue;const l=String(x(i)).trim();l&&(a[i.nome]=i.numero?Number(l):l)}return Object.keys(a).length?a:null};async function F(){if(!n.trim())return r("Cole uma chave de API para executar",!0);if(t.perigoso&&!window.confirm(t.id==="buy"||t.id==="r-buy"?"Isto compra DE VERDADE e desconta do seu saldo. Continuar?":"Isto cancela o pedido de verdade. Continuar?"))return;z(!0),j(null);const a=performance.now();try{const i=k(),l=await fetch(I(),{method:t.metodo,headers:{Authorization:`Bearer ${n.trim()}`,"Content-Type":"application/json"},body:t.metodo==="POST"?JSON.stringify(i??{}):void 0}),S=await l.text();let f;try{f=JSON.parse(S)}catch{f=S}j({status:l.status,ok:l.ok,ms:Math.round(performance.now()-a),corpo:f}),t.id==="balance"&&l.ok&&(f==null?void 0:f.balance_cents)!=null&&w(f.balance_cents)}catch(i){j({status:0,ok:!1,ms:Math.round(performance.now()-a),corpo:{erro:i.message}})}finally{z(!1)}}const H=()=>{const a=k();return[`curl -X ${t.metodo} "${I()}"`,`  -H "Authorization: Bearer ${n.trim()||"SUA_CHAVE"}"`,...a?['  -H "Content-Type: application/json"',`  -d '${JSON.stringify(a)}'`]:[]].join(` \\
`)},K=[...new Set(T.map(a=>a.grupo))];return e.jsxs(h,{hover:!1,style:{marginBottom:16},children:[e.jsxs("div",{className:"row between wrap",style:{gap:12,marginBottom:6},children:[e.jsxs("strong",{className:"row",style:{gap:9,fontFamily:"var(--font-display)",fontSize:16},children:[e.jsx(O,{size:18})," Testar a API agora"]}),N!=null&&e.jsxs("span",{className:"row",style:{gap:8,padding:"6px 12px",borderRadius:10,background:"var(--azul-soft)"},children:[e.jsx("span",{className:"muted",style:{fontSize:12},children:"saldo pela API"}),e.jsx("strong",{style:{color:"var(--azul-texto)",fontFamily:"var(--font-display)"},children:ee(N)})]})]}),e.jsxs("p",{className:"muted",style:{fontSize:13,marginTop:0},children:["As chamadas são ",e.jsx("strong",{children:"reais"}),", com a sua chave e o seu saldo. A chave fica só nesta tela — não é salva no navegador."]}),e.jsxs("div",{className:"field",children:[e.jsx("label",{children:"Sua chave de API"}),e.jsx("input",{type:"password",placeholder:"sk_live_…",value:n,onChange:a=>d(a.target.value),autoComplete:"off",spellCheck:"false"})]}),e.jsxs("div",{className:"api-console",children:[e.jsx("div",{className:"api-lista",children:K.map(a=>e.jsxs("div",{children:[e.jsx("div",{className:"api-grupo",children:a}),T.filter(i=>i.grupo===a).map(i=>e.jsxs("button",{className:`api-item ${s===i.id?"on":""}`,onClick:()=>{u(i.id),j(null)},children:[e.jsx("span",{className:`api-verbo ${i.metodo.toLowerCase()}`,children:i.metodo}),e.jsx("span",{children:i.titulo})]},i.id))]},a))}),e.jsxs("div",{children:[e.jsxs("div",{className:"row wrap",style:{gap:8,alignItems:"center",marginBottom:6},children:[e.jsx("span",{className:`api-verbo ${t.metodo.toLowerCase()}`,children:t.metodo}),e.jsxs("code",{style:{fontSize:13},children:["/api/v1",t.caminho]}),t.perigoso&&e.jsx("span",{className:"badge failed",style:{fontSize:11},children:"mexe em saldo"})]}),e.jsx("p",{className:"muted",style:{fontSize:13,margin:"0 0 12px"},children:t.desc}),t.campos.length>0&&e.jsx("div",{className:"row wrap",style:{gap:10,marginBottom:12},children:t.campos.map(a=>e.jsxs("div",{style:{flex:"1 1 150px"},children:[e.jsxs("label",{className:"muted",style:{fontSize:12,display:"block",marginBottom:4},children:[a.nome," ",e.jsxs("span",{style:{opacity:.7},children:["· ",a.desc]})]}),e.jsx("input",{value:x(a),placeholder:a.padrao||a.nome,onChange:i=>$(a,i.target.value)})]},a.nome))}),e.jsxs("div",{className:"row wrap",style:{gap:8},children:[e.jsx(y,{primary:!0,onClick:F,disabled:_,children:_?"Executando…":"Enviar requisição"}),e.jsxs(y,{onClick:()=>navigator.clipboard.writeText(H()).then(()=>r("cURL copiado!")),children:[e.jsx(b,{size:14})," Copiar cURL"]})]}),g&&e.jsxs("div",{style:{marginTop:14},children:[e.jsxs("div",{className:"row wrap",style:{gap:8,marginBottom:6},children:[e.jsxs("span",{className:`badge ${g.ok?"completed":"failed"}`,children:["HTTP ",g.status||"erro"]}),e.jsxs("span",{className:"muted",style:{fontSize:12},children:[g.ms," ms"]})]}),e.jsx("pre",{className:"api-resp",children:typeof g.corpo=="string"?g.corpo:JSON.stringify(g.corpo,null,2)})]})]})]}),e.jsx("style",{children:`
        .api-console { display: grid; grid-template-columns: 220px 1fr; gap: 18px; margin-top: 12px; }
        .api-lista { border-right: 1px solid var(--hairline); padding-right: 14px; max-height: 420px; overflow-y: auto; }
        .api-grupo { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--fg-2); margin: 12px 0 6px; }
        .api-grupo:first-child { margin-top: 0; }
        .api-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; margin-bottom: 3px;
          border: none; border-radius: 9px; background: transparent; color: var(--fg); font: inherit; font-size: 13px;
          text-align: left; cursor: pointer; transition: background 0.15s var(--ease); }
        .api-item:hover { background: color-mix(in srgb, var(--azul) 6%, transparent); }
        .api-item.on { background: var(--azul-soft); color:var(--azul-texto); font-weight: 600; }
        .api-verbo { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
          padding: 4px 8px; border-radius: 6px; flex: none; }
        .api-verbo.get { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }
        .api-verbo.post { background: var(--azul-soft); color:var(--azul-texto); }
        .api-resp { margin: 0; padding: 14px; border-radius: 12px; background: var(--bg-2);
          border: 1px solid var(--hairline); font-family: 'JetBrains Mono', monospace; font-size: 12px;
          line-height: 1.55; max-height: 300px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
        @media (max-width: 760px) {
          .api-console { grid-template-columns: 1fr; }
          .api-lista { border-right: none; border-bottom: 1px solid var(--hairline); padding: 0 0 12px; max-height: 200px; }
        }
      `})]})}function he(){const[o,c]=m.useState(null),[n,d]=m.useState(null),[s,u]=m.useState(""),p=P(),v=window.location.origin,g=()=>E("/api/keys").then(c).catch(()=>c([]));m.useEffect(()=>{g()},[]);async function j(){try{const r=await E("/api/keys",{method:"POST",body:{name:s||"default"}});d(r.key),u(""),g(),p("Chave criada! Copie agora — ela não aparece de novo.")}catch(r){p(r.message,!0)}}async function _(r){try{await E(`/api/keys/${r}`,{method:"DELETE"}),g(),p("Chave revogada.")}catch(t){p(t.message,!0)}}const z=`curl -X POST ${v}/api/v1/orders \\
  -H "Authorization: Bearer SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: pedido-cliente-123" \\
  -d '{"country":"brazil","service":"whatsapp","server":"auto","max_price_cents":500}'`,N=`const API = "${v}/api/v1";
const KEY = process.env.ROBSONSMS_KEY;
const h = { Authorization: \`Bearer \${KEY}\`, "Content-Type": "application/json" };

// 1) compra o número (Idempotency-Key: reenviar não compra outro)
const res = await fetch(\`\${API}/orders\`, {
  method: "POST",
  headers: { ...h, "Idempotency-Key": crypto.randomUUID() },
  body: JSON.stringify({ country: "brazil", service: "whatsapp", max_price_cents: 500 }),
});
const buy = await res.json();
if (!res.ok) throw new Error(buy.error.code); // ex.: insufficient_balance, out_of_stock
const id = buy.data.id;
console.log("número:", buy.data.phone);

// 2) polling: o número recebe VÁRIOS SMS em até 20 min (código, link, aviso)
const vistos = new Set();
for (let i = 0; i < 300; i++) {
  await new Promise(r => setTimeout(r, 4000));
  const o = (await fetch(\`\${API}/orders/\${id}\`, { headers: h }).then(r => r.json())).data;
  for (const m of o.messages) {
    const k = m.received_at + m.text;
    if (!vistos.has(k)) { vistos.add(k); console.log("SMS:", m.code ?? "", m.text); }
  }
  if (o.is_final) break; // completed, refunded, expired...
}`,w=`Integre a API da ROBSONSMS (números virtuais para receber SMS/OTP) no meu sistema.

BASE URL: ${v}/api/v1
AUTENTICAÇÃO: header "Authorization: Bearer <API_KEY>" em toda requisição.
Guarde a chave em variável de ambiente (ROBSONSMS_KEY). Nunca no código.

ENDPOINTS:
- GET  /me                 -> { data: { id, name, email, balance_cents } }
- GET  /balance            -> { balance_cents: number, currency: "BRL" }
- GET  /countries          -> { data: [{ code, name }] }
- GET  /services?country=brazil[&server=s1][&all=1] -> { data: [{ code, name, price_cents, stock, available }] }
- GET  /servers?country=brazil&service=whatsapp -> { data: [{ id, price_cents, stock, delivery_rate_pct, avg_seconds_to_sms, badges }] }
- GET  /operators?country=brazil -> { data: ["any", ...] }
- POST /orders             body { country, service, server?, operator?, max_price_cents? } + header Idempotency-Key
                           -> { data: { id, country, service, phone, sms_code, price_cents, status, is_final, can_cancel, cancel_in, expires_at, created_at } }
- GET  /orders/:id         -> { data: { ...mesma forma; sms_code = último código, messages: [{ code, text, received_at }] } }
- GET  /orders?status=active,sms_received&limit=50 -> { data: [ ... ] }
- POST /orders/:id/cancel  -> { data: { status } }   (só sem SMS e depois de cancel_in segundos)
- POST /orders/:id/finish  -> { data: { status } }   (encerra o número antes do prazo)
ALUGUEL DE NÚMERO (número por dias, recebe todos os SMS do período):
- GET  /rentals/countries | /rentals/servers?country= | /rentals/periods?country=&server= | /rentals/services?country=&hours=&server=
- POST /rentals            body { country, service, hours, server?, operator?, max_price_cents? } + Idempotency-Key
  (cada servidor s1, s2... tem os próprios prazos e preços; hours = prazo em horas, ex.: 72, 168, 336, 600)
- GET  /rentals/:id        -> { data: { id, phone, status, expires_at, messages: [{ sender, code, text, received_at }] } }
- POST /rentals/:id/cancel (só nos 20 min iniciais, sem SMS, se o fornecedor devolver; depois disso sem reembolso)
ERROS: HTTP 4xx/5xx com { error: { code, message } }. Codes: unauthorized, insufficient_balance, out_of_stock,
price_changed, price_above_max, cancel_too_early, cancel_not_allowed, finish_not_allowed, service_unavailable,
country_unavailable, server_unavailable, operator_unavailable, period_unavailable, invalid_request, not_found,
too_many_orders, rate_limited, account_blocked, internal_error.

FLUXO CORRETO:
1. POST /orders para comprar. A resposta traz "phone" e status "active". O saldo é debitado na hora.
2. Faça polling em GET /orders/:id a cada 3-5 segundos até "sms_code" != null.
3. O número fica ativo por 20 minutos e aceita VÁRIOS SMS nesse prazo, sem custo extra: cada novo código entra em "messages" e vira o "sms_code". Status "sms_received" = já chegou SMS e o número segue recebendo; "completed" = prazo encerrado ou finalizado.
   Sem nenhum SMS no prazo, ou cancelando (liberado após 2 min), o estorno é AUTOMÁTICO (status vira "refunded").
4. Status possíveis: searching_number, active, sms_received, completed, cancelled, expired, failed, refunded.

REGRAS:
- Valores sempre em CENTAVOS (inteiro). Nunca use float para dinheiro.
- Erros retornam HTTP 4xx com { message }. Trate 401 (chave inválida) e 400 (saldo insuficiente / sem estoque).
- Rate limit: 30 compras/minuto. Faça backoff em 429.
- Não faça polling mais rápido que 3s.

TAREFA: escreva um cliente com função buyNumber(service, country) que compra, faz polling e retorna o código OTP, com tratamento de erro e timeout.`;return e.jsxs(q,{title:"API",sub:"Automatize suas operações ou revenda na sua loja — API REST v1",children:[e.jsx(ne,{base:v,chaveNova:n}),e.jsx(ae,{}),e.jsxs(h,{hover:!1,style:{marginBottom:16},children:[e.jsxs("strong",{className:"row",style:{gap:9,fontFamily:"var(--font-display)",fontSize:16},children:[e.jsx(Q,{size:18})," Suas chaves de API"]}),e.jsxs("p",{className:"muted",style:{fontSize:13,lineHeight:1.6},children:["A chave dá acesso ao seu saldo — trate como senha. Guardamos apenas o hash: ",e.jsx("strong",{children:"o valor completo aparece só uma vez"}),", na criação."]}),n&&e.jsxs("div",{style:{border:"1px solid color-mix(in srgb, var(--success) 45%, transparent)",background:"color-mix(in srgb, var(--success) 8%, transparent)",borderRadius:12,padding:14,marginBottom:14},children:[e.jsxs("div",{className:"row between wrap",style:{gap:8,marginBottom:8},children:[e.jsx("strong",{style:{fontSize:13,color:"var(--success)"},children:"Copie agora — não será exibida de novo"}),e.jsxs("button",{className:"hchip",onClick:()=>navigator.clipboard.writeText(n).then(()=>p("Chave copiada!")),children:[e.jsx(b,{size:13})," Copiar chave"]})]}),e.jsx("code",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:12,wordBreak:"break-all"},children:n})]}),e.jsxs("div",{className:"row wrap",style:{gap:8,alignItems:"flex-end",marginBottom:14},children:[e.jsxs("div",{style:{flex:"1 1 200px"},children:[e.jsx("label",{className:"muted",style:{fontSize:12,display:"block",marginBottom:4},children:"Nome da chave"}),e.jsx("input",{value:s,onChange:r=>u(r.target.value),placeholder:"minha-automação"})]}),e.jsx(y,{primary:!0,icon:e.jsx(R,{size:15}),onClick:j,children:"Gerar chave"})]}),!o&&e.jsx(U,{h:60}),(o==null?void 0:o.length)===0&&e.jsx("p",{className:"muted",style:{fontSize:13,margin:0},children:"Nenhuma chave ainda. Gere a primeira acima."}),(o==null?void 0:o.length)>0&&e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Nome"}),e.jsx("th",{children:"Chave"}),e.jsx("th",{children:"Requisições"}),e.jsx("th",{children:"Último uso"}),e.jsx("th",{})]})}),e.jsx("tbody",{children:o.map(r=>e.jsxs("tr",{style:r.revoked?{opacity:.45}:void 0,children:[e.jsx("td",{style:{fontWeight:600},children:r.name}),e.jsx("td",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:12},children:r.hint}),e.jsx("td",{children:r.requests}),e.jsx("td",{className:"muted",style:{fontSize:12},children:r.lastUsedAt??"nunca"}),e.jsx("td",{children:r.revoked?e.jsx("span",{className:"badge failed",children:"revogada"}):e.jsx(y,{style:{padding:"6px 12px",fontSize:12},onClick:()=>_(r.ulid),children:"Revogar"})})]},r.ulid))})]})})]}),e.jsx(h,{hover:!1,index:1,style:{marginBottom:16},children:e.jsxs("div",{className:"row between wrap",style:{gap:10},children:[e.jsxs("div",{style:{maxWidth:560},children:[e.jsxs("strong",{className:"row",style:{gap:9,fontFamily:"var(--font-display)",fontSize:16},children:[e.jsx(B,{size:18})," Integrar com IA"]}),e.jsx("p",{className:"muted",style:{fontSize:13,lineHeight:1.6,margin:"6px 0 0"},children:"Copie o prompt abaixo e cole no ChatGPT, Claude ou Cursor. Ele contém a especificação completa da API — a IA escreve o cliente pronto pro seu sistema."})]}),e.jsx(y,{primary:!0,icon:e.jsx(b,{size:15}),onClick:()=>navigator.clipboard.writeText(w).then(()=>p("Prompt copiado! Cole na sua IA.")),children:"Copiar prompt para IA"})]})}),e.jsxs(h,{hover:!1,index:2,style:{marginBottom:16},children:[e.jsxs("strong",{className:"row",style:{gap:9,fontFamily:"var(--font-display)",fontSize:16},children:[e.jsx(O,{size:18})," Início rápido"]}),e.jsxs("p",{className:"muted",style:{fontSize:13,lineHeight:1.6},children:["Base URL: ",e.jsxs("code",{style:{color:"var(--azul-texto)"},children:[v,"/api/v1"]})," — autenticação por ",e.jsx("code",{style:{color:"var(--azul-texto)"},children:"Authorization: Bearer SUA_CHAVE"})]}),e.jsx(L,{label:"cURL — comprar um número",code:z,arquivo:"comprar.sh"}),e.jsx(L,{label:"Node.js — comprar e ler todas as mensagens",code:N,arquivo:"comprar.mjs"})]}),e.jsxs(h,{hover:!1,index:2,style:{marginBottom:16},children:[e.jsxs("strong",{className:"row",style:{gap:9,fontFamily:"var(--font-display)",fontSize:16},children:[e.jsx(R,{size:18})," Downloads"]}),e.jsx("p",{className:"muted",style:{fontSize:13,lineHeight:1.6,margin:"6px 0 12px"},children:"Arquivos prontos da API v1 — sempre na versão atual (gerados direto da API)."}),e.jsxs("div",{className:"api-downloads",children:[e.jsxs("a",{className:"api-dl",href:"/api/docs/openapi.json",download:!0,children:[e.jsx("strong",{children:"Especificação OpenAPI"}),e.jsx("span",{children:"Swagger, Insomnia, Apidog, geradores de SDK"})]}),e.jsxs("a",{className:"api-dl",href:"/api/docs/postman.json",download:!0,children:[e.jsx("strong",{children:"Coleção do Postman"}),e.jsx("span",{children:"Importe e preencha a variável api_key"})]}),e.jsxs("button",{type:"button",className:"api-dl",onClick:()=>C(".env.example",`ROBSONSMS_KEY=sk_live_COLE_SUA_CHAVE
ROBSONSMS_API=${v}/api/v1
`),children:[e.jsx("strong",{children:".env de exemplo"}),e.jsx("span",{children:"Onde guardar a chave no seu servidor"})]}),e.jsxs("button",{type:"button",className:"api-dl",onClick:()=>C("robsonsms-prompt-ia.txt",w),children:[e.jsx("strong",{children:"Prompt para IA"}),e.jsx("span",{children:"Cole no ChatGPT/Claude para integrar sozinho"})]})]}),e.jsx("p",{className:"muted",style:{fontSize:12,margin:"10px 0 0"},children:"Exemplos completos em Node.js, PHP, Python e aluguel: no Guia do revendedor, abaixo."})]}),e.jsxs(h,{hover:!1,index:3,children:[e.jsx("strong",{style:{fontFamily:"var(--font-display)",fontSize:16},children:"Endpoints"}),e.jsx("div",{style:{overflowX:"auto",marginTop:10},children:e.jsxs("table",{children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Método"}),e.jsx("th",{children:"Rota"}),e.jsx("th",{children:"Descrição"}),e.jsx("th",{children:"Resposta"})]})}),e.jsx("tbody",{children:re.map(([r,t,x,$])=>e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("span",{className:`badge ${r==="GET"?"completed":"active"}`,children:r})}),e.jsx("td",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:12,fontWeight:600},children:t}),e.jsx("td",{className:"muted",style:{fontSize:13},children:x}),e.jsx("td",{className:"muted",style:{fontFamily:"'JetBrains Mono', monospace",fontSize:11},children:$})]},r+t))})]})}),e.jsxs("p",{className:"muted",style:{fontSize:12,marginTop:12,marginBottom:0,lineHeight:1.6},children:["Dinheiro sempre em centavos (inteiro). Limite: 60 compras/min por chave. Número temporário: ativo por até 20 min e recebe vários SMS nesse tempo; sem SMS, cancele (após ",e.jsx("code",{children:"cancel_in"}),") ou ele expira com estorno automático. Envie ",e.jsx("code",{children:"Idempotency-Key"})," nas compras: se a resposta se perder e você reenviar, recebe o mesmo pedido em vez de comprar outro. Servidor desligado ou sem saldo some sozinho da listagem e da compra — nada muda na sua integração."]})]}),e.jsxs(h,{hover:!1,index:4,style:{marginTop:16},children:[e.jsx("strong",{style:{fontFamily:"var(--font-display)",fontSize:16},children:"Erros"}),e.jsxs("p",{className:"muted",style:{fontSize:13,lineHeight:1.6},children:["Todo erro vem como ",e.jsx("code",{children:'{ "error": { "code": "...", "message": "..." } }'}),". Programe em cima do ",e.jsx("code",{children:"code"})," (não muda); a ",e.jsx("code",{children:"message"})," é texto para pessoas."]}),e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"HTTP"}),e.jsx("th",{children:"code"}),e.jsx("th",{children:"Quando"})]})}),e.jsx("tbody",{children:te.map(([r,t,x])=>e.jsxs("tr",{children:[e.jsx("td",{className:"muted",style:{fontFamily:"'JetBrains Mono', monospace",fontSize:12},children:r}),e.jsx("td",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:12,fontWeight:600},children:t}),e.jsx("td",{className:"muted",style:{fontSize:13},children:x})]},t))})]})})]})]})}export{me as Ajuda,he as DocsApi,ue as Status};
