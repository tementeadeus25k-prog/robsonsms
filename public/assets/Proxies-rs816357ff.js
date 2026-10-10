import{j as a}from"./animacao-rsb5c16337.js";import{r as y}from"./react-rsb430cb56.js";import{A as f}from"./AppLayout-3R8-2TCq-rsffaed1bd.js";import{u as b,G as v,g as c,Y as j,q as w,w as k,h as N,y as z,Q as P,B as S,P as A,H as q}from"./index-Xoo-Dd8d-rs5196c6e8.js";const L="https://robson00.com/",s="",O="",e=o=>L,C=[{icon:w,nome:"O que é proxy",cobranca:"",resumo:"Um intermediário de conexão: o seu acesso sai por outro endereço IP em vez do seu.",para:[],href:L},{icon:k,nome:"Para que serve aqui",cobranca:"",resumo:"O número virtual recebe o SMS; o proxy define de onde a sua conexão parece vir.",para:[],href:L},{icon:N,nome:"Planos e preços",cobranca:"",resumo:"Ficam no site de proxies, fora desta loja. Consulte lá antes de contratar.",para:[],href:L},{icon:z,nome:"Gerenciamento",cobranca:"",resumo:"Contratação, acesso e suporte dos proxies são feitos no site próprio.",para:[],href:L}],I=[];function X(){const[o,n]=y.useState(!1),t=b();async function l(){try{await navigator.clipboard.writeText(s),n(!0),t("Cupom copiado — cole no carrinho da loja"),setTimeout(()=>n(!1),2200)}catch{t("Não consegui copiar — anote: "+s,!0)}}return a.jsxs(f,{children:[a.jsxs("div",{className:"pxy",children:[a.jsx("header",{className:"pxy-hero",children:a.jsxs("div",{className:"pxy-hero-txt",children:[a.jsx("span",{className:"pxy-selo",children:"TAMBÉM É NOSSO"}),a.jsxs("h1",{children:["Precisa de proxy?",a.jsx("br",{}),a.jsxs("span",{className:"pxy-marca",children:["ROBSON",a.jsx("em",{children:"00"})]})]}),a.jsx("p",{children:"Número virtual resolve o SMS. O IP é a outra metade da operação — e para isso temos uma infraestrutura de proxies própria, com detalhes, planos e gerenciamento no site dela, fora desta loja."}),a.jsxs("a",{className:"pxy-cta",href:L,target:"_blank",rel:"noopener",children:["Acessar o site de proxies ",a.jsx("span",{"aria-hidden":!0,children:"→"})]}),null]})}),a.jsx("h2",{className:"pxy-h2",children:"O que é a infraestrutura de proxies"}),a.jsx("p",{className:"pxy-sub",children:"Um resumo do que você encontra no site de proxies. Os detalhes de cada plano estão lá."}),a.jsx("div",{className:"pxy-grid",children:C.map(({icon:i,nome:r,cobranca:p,resumo:m,para:g,href:u,destaque:d},h)=>a.jsxs("a",{className:"pxy-card",href:u,target:"_blank",rel:"noopener",children:[a.jsx("span",{className:"pxy-num","aria-hidden":!0,children:String(h+1).padStart(2,"0")}),d&&a.jsx("span",{className:"pxy-tag",children:d}),a.jsx("span",{className:"pxy-ic","aria-hidden":!0,children:a.jsx(i,{size:22})}),a.jsx("h3",{children:r}),a.jsx("p",{children:m}),a.jsx("ul",{className:"pxy-para",children:g.map(x=>a.jsxs("li",{children:[a.jsx(c,{size:12})," ",x]},x))}),a.jsxs("span",{className:"pxy-pe",children:[null,a.jsxs("span",{className:"pxy-ir",children:["Abrir o site ",a.jsx("span",{"aria-hidden":!0,children:"↗"})]})]})]},r))}),a.jsx("div",{className:"pxy-why",children:I.map(([i,r,p])=>a.jsxs("div",{className:"pxy-why-item",children:[a.jsx("span",{className:"pxy-why-ic","aria-hidden":!0,children:a.jsx(i,{size:16})}),a.jsxs("div",{children:[a.jsx("strong",{children:r}),a.jsx("p",{children:p})]})]},r))}),a.jsxs("div",{className:"pxy-fim",children:[a.jsxs("div",{children:[a.jsx("strong",{children:"Detalhes, planos e gerenciamento"}),a.jsx("p",{children:"Tudo sobre os proxies fica no site próprio, robson00.com. Ele abre numa nova aba."})]}),a.jsxs("a",{className:"pxy-cta pxy-cta-2",href:L,target:"_blank",rel:"noopener",children:["Acessar o site de proxies ",a.jsx("span",{"aria-hidden":!0,children:"→"})]})]})]}),a.jsx("style",{children:`
        .pxy { max-width: 1180px; }

        /* ---------------- faixa de apresentação ---------------- */
        .pxy-hero {
          position: relative; overflow: hidden; isolation: isolate;
          padding: 34px 34px 30px; margin-bottom: 42px;
          border-radius: 26px; border: 1px solid var(--hairline);
          background:
            radial-gradient(120% 150% at 8% 0%, rgba(56, 189, 248, 0.30), transparent 62%),
            radial-gradient(90% 130% at 100% 100%, rgba(7, 89, 133, 0.42), transparent 60%),
            linear-gradient(148deg, #122b36 0%, #0c1e26 52%, #081318 100%);
          box-shadow: var(--shadow);
        }
        /* malha de pontos: dá textura sem virar imagem pesada */
        .pxy-hero::before {
          content: ''; position: absolute; inset: 0; z-index: -1;
          background-image: radial-gradient(rgba(255, 255, 255, 0.10) 1px, transparent 1px);
          background-size: 20px 20px;
          -webkit-mask: radial-gradient(100% 90% at 12% 0%, #000 20%, transparent 72%);
          mask: radial-gradient(100% 90% at 12% 0%, #000 20%, transparent 72%);
        }
        .pxy-hero-txt { position: relative; z-index: 1; min-width: 0; }
        .pxy-selo {
          display: inline-block; margin-bottom: 13px; padding: 4px 12px;
          border-radius: 999px; border: 1px solid rgba(186, 230, 253, 0.34);
          background: rgba(56, 189, 248, 0.16);
          font-size: 11px; font-weight: 800; letter-spacing: 0.17em; color: #e0f2fe;
        }
        .pxy-hero h1 {
          margin: 0 0 12px; color: #fff; line-height: 1.14;
          font-family: var(--font-display); font-weight: 700;
          font-size: clamp(25px, 3.4vw, 37px); letter-spacing: -0.02em;
        }
        .pxy-marca { font-size: 0.92em; letter-spacing: 0.01em; }
        .pxy-marca em {
          font-style: normal;
          background: linear-gradient(96deg, #bae6fd, #38bdf8 62%, #7dd3fc);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .pxy-hero p {
          margin: 0 0 20px; max-width: 54ch;
          font-size: 14px; line-height: 1.68; color: rgba(226, 232, 240, 0.80);
        }
        .pxy-cta {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 22px; border-radius: 13px; border: 1px solid rgba(186, 230, 253, 0.30);
          background: linear-gradient(120deg, var(--azul-2), var(--azul-3));
          color:var(--azul-tinta); font-size: 14px; font-weight: 700; text-decoration: none;
          box-shadow: 0 12px 30px -12px rgba(14, 165, 233, 0.85);
          transition: transform 0.22s var(--ease), box-shadow 0.22s var(--ease);
        }
        .pxy-cta:hover { transform: translateY(-2px); box-shadow: 0 18px 38px -12px rgba(14, 165, 233, 0.95); }
        .pxy-cta span { transition: transform 0.22s var(--ease); }
        .pxy-cta:hover span { transform: translateX(3px); }
        .pxy-metricas { display: flex; flex-wrap: wrap; gap: 10px 26px; margin-top: 22px; }
        .pxy-metricas span { font-size: 12px; color: rgba(226, 232, 240, 0.62); }
        .pxy-metricas strong {
          display: block; font-family: var(--font-display); font-size: 18px; color: #fff; font-weight: 700;
        }

        /* ---------------- cupom ---------------- */
        .pxy-cupom {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
          padding: 16px 18px; margin: -22px 0 40px; border-radius: 16px;
          border: 1px dashed color-mix(in srgb, var(--azul) 45%, transparent);
          background: linear-gradient(115deg, var(--azul-soft), transparent 78%);
        }
        .pxy-cupom-ic {
          display: grid; place-items: center; flex: none; width: 38px; height: 38px;
          border-radius: 11px; background: var(--azul); 
        }
        .pxy-cupom-ic svg g, .pxy-cupom-ic svg path,
        .pxy-cupom-ic svg circle, .pxy-cupom-ic svg rect { stroke: #fff; }
        .pxy-cupom-txt { flex: 1 1 220px; min-width: 0; }
        .pxy-cupom-txt strong { display: block; font-size: 14px; margin-bottom: 2px; }
        .pxy-cupom-txt p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--fg-2); }
        /* O código é um botão de copiar, não um enfeite: em cupom o erro comum
           do cliente é digitar errado, e copiar elimina isso. */
        .pxy-cupom-cod {
          display: inline-flex; align-items: center; gap: 8px; flex: none;
          padding: 10px 16px; border-radius: 11px; cursor: pointer;
          border: 1px solid color-mix(in srgb, var(--azul) 50%, transparent);
          background: var(--card); color:var(--azul-texto);
          font-family: var(--mono); font-size: 14px; font-weight: 700; letter-spacing: 0.06em;
          transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease);
        }
        .pxy-cupom-cod:hover { transform: translateY(-1px); box-shadow: var(--glow); }
        .pxy-cupom-cod:focus-visible { outline: 2px solid var(--azul-2); outline-offset: 3px; }
        .pxy-cupom-cod svg g, .pxy-cupom-cod svg path,
        .pxy-cupom-cod svg circle, .pxy-cupom-cod svg rect { stroke: currentColor; }
        @media (max-width: 560px) {
          .pxy-cupom { margin: -18px 0 32px; }
          .pxy-cupom-cod { width: 100%; justify-content: center; }
        }

        /* ---------------- títulos ---------------- */
        .pxy-h2 {
          margin: 0 0 8px; font-family: var(--font-display);
          font-size: clamp(20px, 2.4vw, 25px); letter-spacing: -0.015em;
        }
        .pxy-sub { margin: 0 0 22px; max-width: 62ch; font-size: 14px; line-height: 1.65; color: var(--fg-2); }

        /* ---------------- cards dos planos ---------------- */
        .pxy-grid {
          display: grid; gap: 16px; margin-bottom: 44px;
          grid-template-columns: repeat(auto-fit, minmax(258px, 1fr));
        }
        .pxy-card {
          position: relative; overflow: hidden; isolation: isolate;
          display: flex; flex-direction: column; gap: 8px;
          padding: 22px 20px 18px; border-radius: 20px;
          border: 1px solid var(--hairline); background: var(--card);
          text-decoration: none; color: inherit;
          transition: transform 0.26s var(--ease), border-color 0.26s var(--ease), box-shadow 0.26s var(--ease);
        }
        /* brilho de acento que sobe pelo topo no hover — moldura sem trocar a borda */
        .pxy-card::before {
          content: ''; position: absolute; inset: 0; z-index: -1; opacity: 0;
          background: radial-gradient(90% 60% at 50% 0%, var(--azul-soft), transparent 70%);
          transition: opacity 0.3s var(--ease);
        }
        .pxy-card:hover { transform: translateY(-5px); border-color: var(--azul-3); box-shadow: var(--glow); }
        .pxy-card:hover::before { opacity: 1; }
        .pxy-card:focus-visible { outline: 2px solid var(--azul-2); outline-offset: 3px; }
        .pxy-num {
          position: absolute; top: 14px; right: 16px;
          font-family: var(--font-display); font-size: 24px; font-weight: 700;
          color: var(--fg); opacity: 0.10; line-height: 1;
        }
        .pxy-tag {
          position: absolute; top: 15px; right: 46px;
          padding: 4px 8px; border-radius: 999px;
          background: var(--azul-soft); color:var(--azul-texto);
          font-size: 11px; font-weight: 800; letter-spacing: 0.04em;
        }
        .pxy-ic {
          display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 3px;
          border-radius: 13px;
          background: linear-gradient(140deg, var(--azul-2), var(--azul-deep));
          box-shadow: 0 8px 20px -10px rgba(14, 165, 233, 0.9);
        }
        /* Os ícones do site são desenhados com stroke em gradiente ROXO, preso
           num atributo do SVG — a propriedade color não chega neles. Sobre a
           placa roxa isso deixava roxo em cima de roxo, praticamente invisível.
           Aqui o traço é forçado para branco em todas as formas possíveis. */
        .pxy-ic svg g,
        .pxy-ic svg path,
        .pxy-ic svg circle,
        .pxy-ic svg rect,
        .pxy-ic svg line,
        .pxy-ic svg polyline { stroke: #fff; }
        .pxy-card h3 { margin: 0; font-family: var(--font-display); font-size: 16px; letter-spacing: -0.01em; }
        .pxy-card > p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--fg-2); }
        .pxy-para { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 0; padding: 0; list-style: none; }
        .pxy-para li {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 8px; border-radius: 8px;
          background: var(--shell); border: 1px solid var(--hairline);
          font-size: 11px; font-weight: 600; color: var(--fg-2);
        }
        .pxy-para svg { color:var(--azul-texto); flex-shrink: 0; }
        .pxy-pe {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          margin-top: auto; padding-top: 14px; border-top: 1px dashed var(--hairline-2);
        }
        .pxy-cobr { font-size: 11px; font-weight: 700; color: var(--fg-2); }
        .pxy-ir {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 700; color:var(--azul-texto);
        }
        .pxy-card:hover .pxy-ir { text-decoration: underline; }

        /* ---------------- por que ---------------- */
        .pxy-why {
          display: grid; gap: 14px; margin-bottom: 26px;
          grid-template-columns: repeat(auto-fit, minmax(238px, 1fr));
          padding: 20px; border-radius: 20px;
          border: 1px solid var(--hairline); background: var(--shell);
        }
        .pxy-why-item { display: flex; gap: 12px; align-items: flex-start; }
        .pxy-why-ic {
          display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px;
          border-radius: 10px; background: var(--azul-soft); color:var(--azul-texto);
        }
        .pxy-why-item strong { display: block; font-size: 13px; margin-bottom: 3px; }
        .pxy-why-item p { margin: 0; font-size: 13px; line-height: 1.58; color: var(--fg-2); }

        /* ---------------- fechamento ---------------- */
        .pxy-fim {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
          gap: 16px; padding: 22px 24px; border-radius: 20px;
          border: 1px solid var(--hairline-2);
          background: linear-gradient(120deg, var(--azul-soft), transparent 72%);
        }
        .pxy-fim strong { display: block; font-family: var(--font-display); font-size: 16px; margin-bottom: 4px; }
        .pxy-fim p { margin: 0; font-size: 13px; color: var(--fg-2); max-width: 52ch; }
        .pxy-cta-2 { padding: 12px 20px; font-size: 13px; }

        /* ---------------- celular ---------------- */
        @media (max-width: 900px) {
          .pxy-hero { padding: 26px 20px 24px; }
        }
        @media (max-width: 560px) {
          .pxy-hero { border-radius: 20px; }
          .pxy-metricas { gap: 8px 18px; }
          .pxy-metricas strong { font-size: 16px; }
          .pxy-cta { width: 100%; justify-content: center; }
          .pxy-grid { grid-template-columns: 1fr; }
          .pxy-fim { padding: 18px; }
          .pxy-cta-2 { width: 100%; justify-content: center; }
        }
        /* no toque não existe hover: o card não pode ficar "preso" levantado */
        @media (hover: none) {
          .pxy-card:hover { transform: none; box-shadow: none; border-color: var(--hairline); }
          .pxy-cta:hover { transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pxy-card, .pxy-cta { transition: none; }
        }
      `})]})}export{s as CUPOM,X as Proxies};
