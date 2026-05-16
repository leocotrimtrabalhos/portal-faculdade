/* ============================================================
   Descomplica Faculdade Digital — app.js
   ============================================================ */

const STORAGE_KEYS = {
  student: 'portal.student',
  installDismissed: 'portal.installDismissed'
};

/* -------------------- Service Worker -------------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('SW falhou:', err));
  });
}

/* -------------------- Storage -------------------- */
const Student = {
  get() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.student)); } catch { return null; }
  },
  set(data) { localStorage.setItem(STORAGE_KEYS.student, JSON.stringify(data)); },
  clear() { localStorage.removeItem(STORAGE_KEYS.student); }
};

/* -------------------- Validações -------------------- */
function onlyDigits(str) { return (str || '').replace(/\D/g, ''); }

function isValidCPF(cpf) {
  cpf = onlyDigits(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (s) => {
    let sum = 0;
    for (let i = 0; i < s.length; i++) sum += parseInt(s[i]) * (s.length + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(cpf.slice(0,9)) === +cpf[9] && calc(cpf.slice(0,10)) === +cpf[10];
}

function formatCPF(v) {
  const d = onlyDigits(v).slice(0,11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatDate(v) {
  const d = onlyDigits(v).slice(0,8);
  return d.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2');
}

function isValidBirthDate(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const [_, dd, mm, yyyy] = m;
  const day = +dd, month = +mm, year = +yyyy;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 1920 || year > new Date().getFullYear()) return false;
  const d = new Date(year, month - 1, day);
  return d.getDate() === day && d.getMonth() === month - 1;
}

/* -------------------- Onboarding -------------------- */
function ensureOnboarding() {
  if (Student.get()) { renderStudentBadge(); return; }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-open';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-step-indicator">
        <span class="active"></span><span></span>
      </div>
      <div class="modal-eyebrow">Primeiro acesso · Matrícula</div>
      <h2>Bem-vindo à <em>Descomplica</em>.</h2>
      <p class="modal-lede">Informe seus dados para personalizar o portal e emitir documentos. Tudo fica salvo apenas neste dispositivo.</p>
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

  cpfInput.addEventListener('input', e => { e.target.value = formatCPF(e.target.value); });
  birthInput.addEventListener('input', e => { e.target.value = formatDate(e.target.value); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = fd.get('name').trim();
    const birth = fd.get('birth').trim();
    const cpf = fd.get('cpf').trim();
    let ok = true;
    form.querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));
    if (name.split(' ').filter(Boolean).length < 2) { form.querySelector('input[name="name"]').closest('.field').classList.add('has-error'); ok = false; }
    if (!isValidBirthDate(birth)) { birthInput.closest('.field').classList.add('has-error'); ok = false; }
    if (!isValidCPF(cpf)) { cpfInput.closest('.field').classList.add('has-error'); ok = false; }
    if (!ok) return;
    Student.set({ name, birth, cpf, enrolledAt: new Date().toISOString(), registrationCode: gerarMatricula() });
    backdrop.remove();
    document.body.style.overflow = '';
    renderStudentBadge();
    // Tenta mostrar install banner após cadastro
    setTimeout(() => { tryShowInstallBanner(); maybeShowIOSInstallHint(); }, 800);
    location.reload();
  });
}

function gerarMatricula() {
  return `${new Date().getFullYear()}.${Math.floor(100000 + Math.random() * 900000)}`;
}

function renderStudentBadge() {
  const badge = document.querySelector('[data-student-badge]');
  const s = Student.get();
  if (!badge || !s) return;
  badge.textContent = `${s.name.split(' ')[0]} · ${s.registrationCode}`;
}

/* -------------------- Install Banner PWA -------------------- */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Mostra imediatamente, independente de ter dismissado antes
  showInstallBanner();
});

function tryShowInstallBanner() {
  if (deferredPrompt) showInstallBanner();
}

function showInstallBanner() {
  if (document.getElementById('install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.className = 'install-banner is-visible';
  banner.innerHTML = `
    <div class="body">
      <h4>📲 Instalar como app</h4>
      <p>Acesse o portal direto da tela inicial, mesmo offline.</p>
    </div>
    <button id="install-btn">Instalar</button>
    <button class="close" id="install-close" aria-label="Fechar">×</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.remove();
  });

  document.getElementById('install-close').addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEYS.installDismissed, '1');
    banner.remove();
  });
}

function maybeShowIOSInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!isIOS || isStandalone) return;
  if (document.getElementById('install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.className = 'install-banner is-visible';
  banner.innerHTML = `
    <div class="body">
      <h4>📲 Instalar no iPhone</h4>
      <p>Toque em <strong>Compartilhar</strong> e em "Adicionar à Tela de Início".</p>
    </div>
    <button class="close" id="install-close" aria-label="Fechar">×</button>
  `;
  document.body.appendChild(banner);
  document.getElementById('install-close').addEventListener('click', () => banner.remove());
}

/* -------------------- Nav ativa -------------------- */
function markActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.bottom-nav a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
}

/* -------------------- Bootstrap -------------------- */
document.addEventListener('DOMContentLoaded', () => {
  ensureOnboarding();
  markActiveNav();
  // iOS: mostra dica de instalação logo na primeira visita
  setTimeout(maybeShowIOSInstallHint, 1200);
});

window.Portal = { Student, isValidCPF, formatCPF };
