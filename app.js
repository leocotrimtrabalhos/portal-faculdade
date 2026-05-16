/* ============================================================
   Portal Acadêmico — app.js
   - Registro do service worker (PWA offline)
   - Onboarding na primeira visita (nome, nascimento, CPF)
   - Banner de instalação (beforeinstallprompt)
   - Helpers usados pelas páginas internas
   ============================================================ */

const STORAGE_KEYS = {
  student: 'portal.student',
  installDismissed: 'portal.installDismissed'
};

/* -------------------- Registro do Service Worker -------------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('SW falhou ao registrar:', err));
  });
}

/* -------------------- Helpers de storage -------------------- */
const Student = {
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.student);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(data) {
    localStorage.setItem(STORAGE_KEYS.student, JSON.stringify(data));
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.student);
  }
};

/* -------------------- Validações -------------------- */
function onlyDigits(str) {
  return (str || '').replace(/\D/g, '');
}

// Valida CPF pelos dígitos verificadores. Rejeita 11 iguais.
function isValidCPF(cpf) {
  cpf = onlyDigits(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (slice) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i], 10) * (slice.length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9));
  const d2 = calcDigit(cpf.slice(0, 10));
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}

function formatCPF(value) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatDate(value) {
  const d = onlyDigits(value).slice(0, 8);
  return d
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2');
}

// dd/mm/aaaa → válido e razoável (entre 1920 e hoje)
function isValidBirthDate(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return false;
  const [_, dd, mm, yyyy] = m;
  const day = +dd, month = +mm, year = +yyyy;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1920 || year > new Date().getFullYear()) return false;
  const d = new Date(year, month - 1, day);
  return d.getDate() === day && d.getMonth() === month - 1 && d.getFullYear() === year;
}

/* -------------------- Onboarding -------------------- */
function ensureOnboarding() {
  if (Student.get()) {
    renderStudentBadge();
    return;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-open';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-step-indicator">
        <span class="active"></span>
        <span></span>
      </div>
      <div class="modal-eyebrow">Matrícula · Primeiro acesso</div>
      <h2>Bem-vindo ao <em>portal</em>.</h2>
      <p class="modal-lede">Para personalizar sua experiência e emitir documentos, precisamos de alguns dados básicos. Tudo fica salvo apenas neste dispositivo.</p>

      <form id="onboarding-form" novalidate>
        <div class="field">
          <label>Nome completo</label>
          <input type="text" name="name" autocomplete="name" placeholder="Como aparece no seu RG" required>
          <span class="error">Informe seu nome completo.</span>
        </div>

        <div class="field">
          <label>Data de nascimento</label>
          <input type="text" name="birth" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" required>
          <span class="error">Data inválida.</span>
        </div>

        <div class="field">
          <label>CPF</label>
          <input type="text" name="cpf" inputmode="numeric" placeholder="000.000.000-00" maxlength="14" required>
          <span class="hint">Usado apenas para gerar seu diploma.</span>
          <span class="error">CPF inválido.</span>
        </div>

        <button type="submit" class="btn btn--block mt-md">Entrar no portal →</button>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const form = backdrop.querySelector('#onboarding-form');
  const cpfInput = form.querySelector('input[name="cpf"]');
  const birthInput = form.querySelector('input[name="birth"]');

  cpfInput.addEventListener('input', (e) => {
    e.target.value = formatCPF(e.target.value);
  });

  birthInput.addEventListener('input', (e) => {
    e.target.value = formatDate(e.target.value);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get('name') || '').toString().trim();
    const birth = (fd.get('birth') || '').toString().trim();
    const cpf = (fd.get('cpf') || '').toString().trim();

    let ok = true;
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('has-error'));

    if (name.split(' ').filter(Boolean).length < 2) {
      form.querySelector('input[name="name"]').closest('.field').classList.add('has-error');
      ok = false;
    }
    if (!isValidBirthDate(birth)) {
      birthInput.closest('.field').classList.add('has-error');
      ok = false;
    }
    if (!isValidCPF(cpf)) {
      cpfInput.closest('.field').classList.add('has-error');
      ok = false;
    }
    if (!ok) return;

    Student.set({
      name,
      birth,
      cpf,
      enrolledAt: new Date().toISOString(),
      registrationCode: gerarMatricula()
    });

    backdrop.remove();
    document.body.style.overflow = '';
    renderStudentBadge();
    location.reload();
  });
}

function gerarMatricula() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${year}.${rand}`;
}

function renderStudentBadge() {
  const badge = document.querySelector('[data-student-badge]');
  const s = Student.get();
  if (!badge || !s) return;
  const first = s.name.split(' ')[0];
  badge.textContent = `${first} · ${s.registrationCode}`;
}

/* -------------------- Banner de instalação PWA -------------------- */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (localStorage.getItem(STORAGE_KEYS.installDismissed) === '1') return;
  showInstallBanner();
});

function showInstallBanner() {
  if (document.getElementById('install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.className = 'install-banner is-visible';
  banner.innerHTML = `
    <div class="body">
      <h4>Instalar como aplicativo</h4>
      <p>Acesse o portal direto da sua tela inicial, mesmo offline.</p>
    </div>
    <button id="install-btn">Instalar</button>
    <button class="close" id="install-close" aria-label="Fechar">×</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(STORAGE_KEYS.installDismissed, '1');
    }
    deferredPrompt = null;
    banner.remove();
  });

  document.getElementById('install-close').addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEYS.installDismissed, '1');
    banner.remove();
  });
}

// iOS não dispara beforeinstallprompt; mostra dica manual se for iPhone/iPad fora do modo standalone
function maybeShowIOSInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const dismissed = localStorage.getItem(STORAGE_KEYS.installDismissed) === '1';
  if (!isIOS || isStandalone || dismissed) return;
  if (document.getElementById('install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.className = 'install-banner is-visible';
  banner.innerHTML = `
    <div class="body">
      <h4>Instalar no iPhone</h4>
      <p>Toque em Compartilhar e em "Adicionar à Tela de Início".</p>
    </div>
    <button class="close" id="install-close" aria-label="Fechar">×</button>
  `;
  document.body.appendChild(banner);
  document.getElementById('install-close').addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEYS.installDismissed, '1');
    banner.remove();
  });
}

/* -------------------- Marcar item ativo na bottom nav -------------------- */
function markActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.bottom-nav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === path) a.classList.add('active');
  });
}

/* -------------------- Bootstrap -------------------- */
document.addEventListener('DOMContentLoaded', () => {
  ensureOnboarding();
  markActiveNav();
  setTimeout(maybeShowIOSInstallHint, 1500);
});

// Exposto pra páginas internas (ex.: diploma.html)
window.Portal = { Student, isValidCPF, formatCPF };
