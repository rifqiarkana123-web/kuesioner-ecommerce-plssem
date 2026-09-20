import { firebaseConfig } from './firebase-config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const constructs = {
  'Keamanan': ['KM1', 'KM2'],
  'Kepercayaan': ['KP1', 'KP2', 'KP3'],
  'Kemudahan': ['KMP1', 'KMP2', 'KMP3', 'KMP4', 'KMP5', 'KMP6'],
  'Privasi': ['MP1', 'MP2', 'MP3'],
  'E-Kepuasan': ['EK1', 'EK2', 'EK3_R', 'EK4', 'EK5_R', 'EK6'],
  'Niat Beli Ulang': ['NMK1', 'NMK2']
};
const constructLabels = Object.keys(constructs);
const indicatorCodes = [
  'KM1','KM2','KP1','KP2','KP3',
  'KMP1','KMP2','KMP3','KMP4','KMP5','KMP6',
  'MP1','MP2','MP3','EK1','EK2','EK3','EK4','EK5','EK6','NMK1','NMK2'
];

let db = null;
let firebaseApi = null;
let firebaseRows = [];
let firebaseReady = false;
let unsubscribeResponses = null;
let currentStep = 1;
const totalSteps = 9;


const sidebar = $('#sidebar');
const mobileBackdrop = $('#mobileBackdrop');
const menuToggle = $('#menuToggle');

function updateMenuButton(isOpen) {
  if (!menuToggle) return;
  menuToggle.textContent = isOpen ? '‹' : '›';
  menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  menuToggle.setAttribute('aria-label', isOpen ? 'Tutup sidebar' : 'Buka sidebar');
}

function openMobileMenu() {
  if (sidebar) sidebar.classList.add('open');
  if (mobileBackdrop) mobileBackdrop.classList.remove('hidden');
  document.body.classList.add('menu-open');
  updateMenuButton(true);
}

function closeMobileMenu() {
  if (sidebar) sidebar.classList.remove('open');
  if (mobileBackdrop) mobileBackdrop.classList.add('hidden');
  document.body.classList.remove('menu-open');
  updateMenuButton(false);
}

function toggleMobileMenu() {
  if (sidebar && sidebar.classList.contains('open')) closeMobileMenu();
  else openMobileMenu();
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.setTimeout(() => toast.classList.add('hidden'), 2600);
}

function setConnectionStatus(text, ok = false) {
  const label = $('#connectionText');
  const dot = $('#connectionDot');
  if (label) label.textContent = text;
  if (dot) {
    dot.style.background = ok ? '#36c275' : '#f2a93b';
  }
}

function mean(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function normalized(raw) {
  return raw ? Math.round((raw / 5) * 100) : 0;
}

function isQuestionnaireResponse(row) {
  return Boolean(row && row.marketplace && (row.KM1 || row.EK1 || row.NMK1));
}

function normalizeRow(row) {
  const normalizedRow = { ...row };
  if ((normalizedRow.EK3_R === undefined || normalizedRow.EK3_R === '') && normalizedRow.EK3 !== undefined) {
    normalizedRow.EK3_R = 6 - Number(normalizedRow.EK3);
  }
  if ((normalizedRow.EK5_R === undefined || normalizedRow.EK5_R === '') && normalizedRow.EK5 !== undefined) {
    normalizedRow.EK5_R = 6 - Number(normalizedRow.EK5);
  }
  return normalizedRow;
}

function constructMeans(rows) {
  const result = {};
  for (const [name, codes] of Object.entries(constructs)) {
    const respondentScores = rows
      .map(row => mean(codes.map(code => row[code]).filter(value => value !== undefined && value !== '')))
      .filter(score => score > 0);
    result[name] = mean(respondentScores);
  }
  return result;
}

function getSummary(rows = firebaseRows) {
  const means = constructMeans(rows);
  const norm = {};
  for (const [key, value] of Object.entries(means)) norm[key] = normalized(value);
  const available = Object.values(norm).filter(value => value > 0);
  const overall = available.length ? Math.round(mean(available)) : 0;
  return { rows, means, norm, overall };
}

function setView(id) {
  $$('.view').forEach(view => view.classList.toggle('active', view.id === id));
  $$('.nav').forEach(button => button.classList.toggle('active', button.dataset.view === id));
  const nav = $(`.nav[data-view="${id}"]`);
  const pageTitle = $('#pageTitle');
  if (pageTitle) pageTitle.textContent = nav ? nav.textContent.trim() : 'Dashboard';

  if (id === 'dashboard') renderDashboard();
  if (id === 'results') renderResults();
  if (id === 'report') renderReport();
  if (id === 'data') renderData();

  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderLikerts() {
  $$('.likert').forEach(element => {
    const code = element.dataset.code;
    const text = element.dataset.text;
    element.className = 'likert-item';
    element.innerHTML = `
      <div class="likert-q"><span class="code">${code}.</span>${text}</div>
      <div class="scale">
        ${[1,2,3,4,5].map(value => `<label><input type="radio" name="${code}" value="${value}" required>${value}</label>`).join('')}
      </div>
      <div class="scale-caption"><span>Sangat Tidak Setuju</span><span>Sangat Setuju</span></div>`;
  });
}

function updateStep() {
  $$('.step').forEach(step => step.classList.toggle('active', Number(step.dataset.step) === currentStep));
  const active = $(`.step[data-step="${currentStep}"]`);
  if (!active) return;
  $('#stepLabel').textContent = `Tahap ${currentStep} dari ${totalSteps}`;
  $('#stepTitle').textContent = active.dataset.title;
  $('#progressFill').style.width = `${(currentStep / totalSteps) * 100}%`;
  $('#prevBtn').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  $('#nextBtn').classList.toggle('hidden', currentStep === totalSteps);
  $('#submitBtn').classList.toggle('hidden', currentStep !== totalSteps);
}

function stepValid() {
  const step = $(`.step[data-step="${currentStep}"]`);
  if (!step) return false;
  const required = $$('input[required],select[required]', step);
  const radioNames = [...new Set(required.filter(el => el.type === 'radio').map(el => el.name))];
  for (const name of radioNames) {
    if (!$(`input[name="${name}"]:checked`, step)) return false;
  }
  for (const element of required.filter(el => el.type !== 'radio')) {
    if (!element.value) return false;
  }
  return true;
}

function screeningOK() {
  if (currentStep === 1 && $('input[name="consent"]:checked')?.value === 'Tidak') {
    alert('Terima kasih. Kuesioner dihentikan karena Anda tidak memberikan persetujuan.');
    return false;
  }
  if (currentStep === 2) {
    const b1 = $('input[name="b1"]:checked')?.value;
    const b2 = $('input[name="b2"]:checked')?.value;
    if (b1 === 'Tidak' || b2 === 'Tidak') {
      alert('Maaf, Anda belum memenuhi kriteria responden penelitian ini.');
      return false;
    }
  }
  return true;
}

function buildSubmission(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  for (const code of indicatorCodes) {
    if (data[code] !== undefined && data[code] !== '') data[code] = Number(data[code]);
  }
  data.name = (data.name || '').trim();
  data.timestamp = new Date().toISOString();
  if (Number.isFinite(data.EK3)) data.EK3_R = 6 - data.EK3;
  if (Number.isFinite(data.EK5)) data.EK5_R = 6 - data.EK5;
  return data;
}

function barHTML(name, value) {
  return `<div class="bar-row"><span>${name}</span><div class="bar-track"><div class="bar-fill" style="width:${value || 0}%"></div></div><b>${value || 0}</b></div>`;
}

function drawRadar(norm) {
  const svg = $('#radarChart');
  if (!svg) return;
  const cx = 210, cy = 165, radius = 110, count = constructLabels.length;
  const points = rad => constructLabels.map((_, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    return [cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad];
  });
  const polygon = pts => pts.map(point => point.join(',')).join(' ');
  let html = '';
  [1,.75,.5,.25].forEach(factor => {
    html += `<polygon points="${polygon(points(radius * factor))}" fill="none" stroke="#e6eaf1" stroke-width="1"/>`;
  });
  constructLabels.forEach((name, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const lx = cx + Math.cos(angle) * (radius + 34);
    const ly = cy + Math.sin(angle) * (radius + 34);
    html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#edf0f6"/>`;
    html += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#667085">${name}</text>`;
  });
  const dataPoints = constructLabels.map((name, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    const r = radius * (norm[name] || 0) / 100;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  });
  html += `<polygon points="${polygon(dataPoints)}" fill="rgba(230,57,70,.20)" stroke="#e63946" stroke-width="3"/>`;
  dataPoints.forEach(point => { html += `<circle cx="${point[0]}" cy="${point[1]}" r="4" fill="#e63946"/>`; });
  svg.innerHTML = html;
}

function insightFor(name, score) {
  if (!score) return { title: 'Belum ada data', text: 'Isi kuesioner untuk menampilkan rekomendasi.' };
  if (score >= 80) return { title: `${name} kuat`, text: `Skor ${score}/100 menunjukkan aspek ini menjadi kekuatan pengalaman pengguna.` };
  if (score >= 65) return { title: `${name} cukup baik`, text: `Skor ${score}/100 sudah positif, namun masih ada ruang penguatan.` };
  return { title: `${name} perlu perhatian`, text: `Skor ${score}/100 menunjukkan aspek ini layak diprioritaskan.` };
}

function renderInsights(norm) {
  const target = $('#insightCards');
  if (!target) return;
  const sorted = constructLabels.map(name => [name, norm[name] || 0]).sort((a,b) => a[1] - b[1]);
  const picks = [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
  target.innerHTML = picks.map(([name, value]) => {
    const insight = insightFor(name, value);
    return `<div class="insight"><b>${insight.title}</b><p>${insight.text}</p></div>`;
  }).join('');
}

function renderDashboard() {
  const { rows, norm, overall } = getSummary();
  $('#statTotal').textContent = rows.length;
  const counts = { Shopee: 0, Tokopedia: 0, Lazada: 0 };
  rows.forEach(row => { if (row.marketplace in counts) counts[row.marketplace]++; });
  const dominant = rows.length ? Object.entries(counts).sort((a,b) => b[1] - a[1])[0][0] : '—';
  $('#statMarket').textContent = dominant;
  $('#statSat').textContent = norm['E-Kepuasan'] ? `${norm['E-Kepuasan']}/100` : '—';
  $('#statRep').textContent = norm['Niat Beli Ulang'] ? `${norm['Niat Beli Ulang']}/100` : '—';
  $('#overallScore').textContent = overall;
  $('#overallRing').style.background = `conic-gradient(#e63946 ${overall * 3.6}deg,#ffffff25 0deg)`;
  $('#dashBars').innerHTML = constructLabels.map(name => barHTML(name, norm[name])).join('');
  drawRadar(norm);
  renderInsights(norm);
}

function recommendText(name) {
  const recommendations = {
    'Keamanan': 'Perkuat persepsi keamanan transaksi dan kejelasan mekanisme proteksi pembayaran.',
    'Kepercayaan': 'Perkuat transparansi, kejujuran penjual, dan pengalaman yang membangun kepercayaan.',
    'Kemudahan': 'Sederhanakan alur pencarian, transaksi, pembayaran, dan interaksi aplikasi.',
    'Privasi': 'Perjelas kebijakan privasi dan kontrol pengguna terhadap penggunaan data pribadi.',
    'E-Kepuasan': 'Fokus pada konsistensi pengalaman belanja yang menyenangkan dan sesuai ekspektasi.',
    'Niat Beli Ulang': 'Perkuat faktor pengalaman yang mendorong pengguna kembali bertransaksi.'
  };
  return recommendations[name] || 'Lakukan evaluasi lanjutan.';
}

function roadmapHTML(norm) {
  const weak = constructLabels.slice().sort((a,b) => (norm[a] || 0) - (norm[b] || 0));
  return `<div class="roadmap-col"><small>JANGKA PENDEK</small><h4>0–3 Bulan</h4><ul><li>Prioritaskan ${weak[0]}</li><li>Audit pengalaman pengguna dan pain point</li><li>Perbaiki informasi yang paling membingungkan pengguna</li></ul></div>
  <div class="roadmap-col"><small>JANGKA MENENGAH</small><h4>3–6 Bulan</h4><ul><li>Optimalkan ${weak[1]}</li><li>Uji perubahan melalui survei lanjutan</li><li>Bandingkan skor per kelompok marketplace</li></ul></div>
  <div class="roadmap-col"><small>JANGKA PANJANG</small><h4>6–12 Bulan</h4><ul><li>Integrasikan temuan PLS-SEM</li><li>Validasi model pada sampel lebih besar</li><li>Bangun dashboard monitoring berkala</li></ul></div>`;
}

function renderResults() {
  const { rows, means, norm, overall } = getSummary();
  $('#resultOverall').textContent = rows.length ? overall : '—';
  $('#validRows').textContent = rows.length;
  const pairs = constructLabels.map(name => [name, norm[name] || 0]).filter(pair => pair[1] > 0).sort((a,b) => b[1] - a[1]);
  $('#bestConstruct').textContent = pairs.length ? pairs[0][0] : '—';
  $('#weakConstruct').textContent = pairs.length ? pairs[pairs.length - 1][0] : '—';
  $('#scoreTableWrap').innerHTML = `<table class="score-table"><thead><tr><th>Konstruk</th><th>Raw Mean</th><th>Normalized</th><th>Kategori</th></tr></thead><tbody>${constructLabels.map(name => {
    const raw = means[name] || 0;
    const n = norm[name] || 0;
    const category = n >= 80 ? 'Sangat Baik' : n >= 65 ? 'Baik' : n >= 50 ? 'Cukup' : 'Perlu Perbaikan';
    return `<tr><td>${name}</td><td class="score">${raw ? raw.toFixed(2) : '-'}</td><td class="score">${n || '-'}</td><td>${raw ? category : '-'}</td></tr>`;
  }).join('')}</tbody></table>`;
  $('#recommendations').innerHTML = constructLabels.slice().sort((a,b) => (norm[a] || 0) - (norm[b] || 0)).slice(0,3).map(name => {
    const value = norm[name] || 0;
    return `<div class="recommend-card"><b>${name}</b><span>${value ? `Skor ${value}/100. ${recommendText(name)}` : 'Belum ada data.'}</span></div>`;
  }).join('');
  $('#roadmap').innerHTML = roadmapHTML(norm);
}

function renderReport() {
  const { rows, means, norm, overall } = getSummary();
  $('#reportDate').textContent = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  $('#reportTotal').textContent = rows.length;
  $('#reportIndex').textContent = `${overall}/100`;
  const counts = { Shopee:0, Tokopedia:0, Lazada:0 };
  rows.forEach(row => { if (row.marketplace in counts) counts[row.marketplace]++; });
  $('#reportMarket').textContent = rows.length ? Object.entries(counts).sort((a,b) => b[1] - a[1])[0][0] : '—';
  $('#reportTable').innerHTML = `<table class="score-table"><thead><tr><th>Konstruk</th><th>Mean</th><th>Skor 0–100</th></tr></thead><tbody>${constructLabels.map(name => `<tr><td>${name}</td><td>${means[name] ? means[name].toFixed(2) : '-'}</td><td>${norm[name] || '-'}</td></tr>`).join('')}</tbody></table>`;

  const pairs = constructLabels.map(name => [name, norm[name] || 0]).filter(pair => pair[1] > 0).sort((a,b) => b[1] - a[1]);
  if (!rows.length || !pairs.length) {
    $('#reportAnalysis').textContent = 'Belum ada respons yang dapat dianalisis.';
    $('#reportRecs').textContent = 'Isi kuesioner terlebih dahulu.';
    return;
  }
  const best = pairs[0];
  const weakest = pairs[pairs.length - 1];
  $('#reportAnalysis').innerHTML = `Berdasarkan ${rows.length} respons yang tersimpan, indeks pengalaman pengguna berada pada skor <b>${overall}/100</b>. Konstruk dengan skor relatif tertinggi adalah <b>${best[0]}</b> (${best[1]}/100), sedangkan konstruk yang paling membutuhkan perhatian adalah <b>${weakest[0]}</b> (${weakest[1]}/100). Analisis ini bersifat deskriptif dan bukan hasil estimasi PLS-SEM inferensial.`;
  $('#reportRecs').innerHTML = `Prioritas pertama adalah ${recommendText(weakest[0])} Setelah data mencukupi, ekspor dataset ke SmartPLS untuk menguji measurement model, structural model, dan efek mediasi E-Kepuasan.`;
}

function renderData() {
  const rows = firebaseRows.slice().sort((a,b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  $('#dataRows').innerHTML = rows.slice(0,12).map(row => {
    const sat = mean(['EK1','EK2','EK3_R','EK4','EK5_R','EK6'].map(code => row[code]).filter(value => value !== undefined));
    const rep = mean(['NMK1','NMK2'].map(code => row[code]).filter(value => value !== undefined));
    const time = row.timestamp ? new Date(row.timestamp).toLocaleString('id-ID') : '-';
    return `<tr><td>${time}</td><td>${row.name || '-'}</td><td>${row.marketplace || '-'}</td><td>${row.age || '-'}</td><td>${row.job || '-'}</td><td>${sat ? sat.toFixed(2) : '-'}</td><td>${rep ? rep.toFixed(2) : '-'}</td></tr>`;
  }).join('') || '<tr><td colspan="7">Belum ada respons.</td></tr>';
}

function refreshAllViews() {
  renderDashboard();
  renderResults();
  renderReport();
  renderData();
}

async function loadResponsesOnce() {
  if (!firebaseReady || !db || !firebaseApi) {
    showToast('Firebase belum terhubung.');
    return;
  }
  try {
    const snapshot = await firebaseApi.getDocs(firebaseApi.collection(db, 'responses'));
    firebaseRows = snapshot.docs
      .map(doc => normalizeRow({ _id: doc.id, ...doc.data() }))
      .filter(isQuestionnaireResponse);
    refreshAllViews();
    showToast('Data Firebase dimuat ulang.');
  } catch (error) {
    console.error('Gagal memuat data Firebase:', error);
    showToast('Gagal memuat data Firebase.');
  }
}

function subscribeResponses() {
  if (unsubscribeResponses) unsubscribeResponses();
  unsubscribeResponses = firebaseApi.onSnapshot(
    firebaseApi.collection(db, 'responses'),
    snapshot => {
      firebaseRows = snapshot.docs
        .map(doc => normalizeRow({ _id: doc.id, ...doc.data() }))
        .filter(isQuestionnaireResponse);
      refreshAllViews();
      setConnectionStatus('Firebase realtime', true);
    },
    error => {
      console.error('Listener Firestore gagal:', error);
      setConnectionStatus('Firebase bermasalah', false);
      showToast('Koneksi realtime Firebase bermasalah.');
    }
  );
}

async function initializeFirebase() {
  setConnectionStatus('Menyambungkan Firebase...', false);
  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
    ]);
    const firebaseApp = initializeApp(firebaseConfig);
    db = firestore.getFirestore(firebaseApp);
    firebaseApi = {
      collection: firestore.collection,
      addDoc: firestore.addDoc,
      onSnapshot: firestore.onSnapshot,
      getDocs: firestore.getDocs
    };
    firebaseReady = true;
    subscribeResponses();
  } catch (error) {
    console.error('Firebase gagal diinisialisasi:', error);
    firebaseReady = false;
    setConnectionStatus('Firebase tidak terhubung', false);
    showToast('Firebase tidak terhubung. Form tetap bisa dibuka, tetapi respons belum dapat dikirim.');
  }
}

// Event UI dipasang sebelum koneksi Firebase, jadi navigasi tetap dapat diklik walau jaringan bermasalah.

const drawerCloseBtn = $('#drawerCloseBtn');

if (menuToggle) menuToggle.addEventListener('click', toggleMobileMenu);
if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeMobileMenu);
if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileMenu);

$$('.nav').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$$('[data-go]').forEach(button => button.addEventListener('click', () => setView(button.dataset.go)));
$('#nextBtn').addEventListener('click', () => {
  if (!stepValid()) { showToast('Lengkapi bagian ini terlebih dahulu.'); return; }
  if (!screeningOK()) return;
  if (currentStep < totalSteps) {
    currentStep++;
    updateStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});
$('#prevBtn').addEventListener('click', () => {
  if (currentStep > 1) {
    currentStep--;
    updateStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});
$('#printBtn').addEventListener('click', () => window.print());
$('#refreshBtn').addEventListener('click', loadResponsesOnce);

$('#surveyForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!stepValid()) { showToast('Lengkapi seluruh jawaban.'); return; }
  if (!firebaseReady || !db || !firebaseApi) {
    showToast('Firebase belum terhubung. Periksa koneksi internet lalu coba lagi.');
    return;
  }

  const submitButton = $('#submitBtn');
  submitButton.disabled = true;
  const previousLabel = submitButton.textContent;
  submitButton.textContent = 'Mengirim...';

  try {
    const data = buildSubmission(event.target);
    await firebaseApi.addDoc(firebaseApi.collection(db, 'responses'), data);
    event.target.reset();
    currentStep = 1;
    updateStep();
    showToast('Respons berhasil dikirim ke Firebase.');
    setView('results');
  } catch (error) {
    console.error('Gagal mengirim respons:', error);
    showToast('Respons gagal dikirim. Coba lagi.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = previousLabel;
  }
});

$('#exportCsvBtn').addEventListener('click', () => {
  const rows = firebaseRows;
  if (!rows.length) { showToast('Belum ada data untuk diekspor.'); return; }
  const columns = [
    'timestamp','name','marketplace','gender','age','education','job','frequency','payment',
    'KM1','KM2','KP1','KP2','KP3','KMP1','KMP2','KMP3','KMP4','KMP5','KMP6',
    'MP1','MP2','MP3','EK1','EK2','EK3','EK3_R','EK4','EK5','EK5_R','EK6','NMK1','NMK2'
  ];
  const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.join(','), ...rows.map(row => columns.map(column => escapeCsv(row[column])).join(','))].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'kuesioner_ecommerce_plssem.csv';
  link.click();
  URL.revokeObjectURL(link.href);
});

renderLikerts();
updateStep();
refreshAllViews();
initializeFirebase();
