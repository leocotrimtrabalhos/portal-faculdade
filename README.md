# Portal Acadêmico — PWA

Portal de faculdade instalável como app no celular. HTML/CSS/JS puros, sem build, sem backend.

## Como rodar localmente

Service workers **exigem servidor HTTP** (não funcionam abrindo o arquivo direto). Opções:

```bash
# opção 1: Python
python3 -m http.server 5173

# opção 2: Node
npx serve .
```

Abra `http://localhost:5173` no celular (mesma rede Wi-Fi) ou em `chrome://inspect` pra testar com Chrome DevTools.

## Estrutura

```
portal-faculdade/
├── index.html           # home
├── cursos.html          # catálogo
├── aluno.html           # área do aluno
├── secretaria.html      # requerimentos
├── diploma.html         # emissão de diploma (PDF via print)
├── contato.html         # canais e formulário
├── styles.css           # design system completo
├── app.js               # onboarding, CPF, SW, install prompt
├── sw.js                # service worker (cache-first offline)
├── manifest.json        # PWA manifest
├── vercel.json          # config de deploy
└── icons/               # ícones placeholder (substituir pela logo)
```

## Fluxo do usuário

1. **Primeiro acesso** → modal pede nome, data de nascimento e CPF (CPF validado por dígito verificador).
2. **Dados gravados em localStorage** com matrícula gerada (`ANO.XXXXXX`).
3. **Banner de instalação** aparece (Android/Desktop) ou dica manual (iOS) na primeira visita.
4. **Diploma** monta certificado em tempo real com os dados; botão "Gerar PDF" abre o diálogo de impressão (salvar como PDF).
5. **Tudo funciona offline** após o primeiro carregamento.

## Deploy na Vercel

```bash
# instalar CLI (uma vez)
npm i -g vercel

# dentro da pasta do projeto
vercel
# seguir o assistente; é um projeto estático, sem build
```

Ou ligue o repo no painel da Vercel — deploy automático sem nenhuma config (o `vercel.json` já cuida dos headers do service worker).

## Trocar a logo

Quando chegar a logo:
1. Substitua `icons/icon-192.png` e `icons/icon-512.png` (mantendo as dimensões).
2. Em `index.html` e demais páginas: trocar a `<div class="brand-mark">A</div>` por `<img src="icons/icon-192.png" alt="">`.
3. Em `styles.css` ajustar `.brand-mark { width, height }` se necessário.

## Limpar dados (testar onboarding de novo)

Na home, no card "06 — Sair / recadastrar". Ou DevTools → Application → Local Storage → remover `portal.student`.

## O que está mockado

- Notas, calendário, números do dashboard — texto fixo para demonstração.
- Formulário de contato apenas exibe confirmação, não envia.
- Lista de cursos é estática (links `#`).

## Stack

- HTML5 + CSS3 (variáveis nativas, sem preprocessador)
- Vanilla JS (sem framework, sem bundler)
- Service Worker API + Web App Manifest
- Google Fonts: Fraunces (display) + Manrope (body)
