
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORAGE='marketsense_plssem_responses';
const constructs={
  'Keamanan':['KM1','KM2'],
  'Kepercayaan':['KP1','KP2','KP3'],
  'Kemudahan':['KMP1','KMP2','KMP3','KMP4','KMP5','KMP6'],
  'Privasi':['MP1','MP2','MP3'],
  'E-Kepuasan':['EK1','EK2','EK3_R','EK4','EK5_R','EK6'],
  'Niat Beli Ulang':['NMK1','NMK2']
};
const constructLabels=Object.keys(constructs);

function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2200)}
function getRows(){return JSON.parse(localStorage.getItem(STORAGE)||'[]')}
function setRows(rows){localStorage.setItem(STORAGE,JSON.stringify(rows))}
function mean(vals){const n=vals.map(Number).filter(Number.isFinite);return n.length?n.reduce((a,b)=>a+b,0)/n.length:0}
function normalized(raw){return raw?Math.round((raw/5)*100):0}
function constructMeans(rows){
  const out={};
  for(const [name,codes] of Object.entries(constructs)){
    const scores=rows.map(r=>mean(codes.map(c=>r[c]).filter(v=>v!==undefined && v!==''))).filter(v=>v>0);
    out[name]=mean(scores);
  }
  return out;
}

function setView(id){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  $$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===id));
  const nav=$(`.nav[data-view="${id}"]`);
  $('#pageTitle').textContent=nav?nav.textContent.trim():'Dashboard';
  if(id==='dashboard') renderDashboard();
  if(id==='results') renderResults();
  if(id==='report') renderReport();
  if(id==='data') renderData();
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('.nav').forEach(n=>n.onclick=()=>setView(n.dataset.view));
$$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
$('#quickFormBtn').onclick=()=>setView('questionnaire');

function renderLikerts(){
  $$('.likert').forEach(el=>{
    const c=el.dataset.code,t=el.dataset.text;
    el.className='likert-item';
    el.innerHTML=`<div class="likert-q"><span class="code">${c}.</span>${t}</div>
      <div class="scale">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="${c}" value="${n}" required>${n}</label>`).join('')}</div>
      <div class="scale-caption"><span>Sangat Tidak Setuju</span><span>Sangat Setuju</span></div>`;
  });
}
renderLikerts();

let currentStep=1,totalSteps=9;
function updateStep(){
  $$('.step').forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===currentStep));
  const a=$(`.step[data-step="${currentStep}"]`);
  $('#stepLabel').textContent=`Tahap ${currentStep} dari ${totalSteps}`;
  $('#stepTitle').textContent=a.dataset.title;
  $('#progressFill').style.width=`${currentStep/totalSteps*100}%`;
  $('#prevBtn').style.visibility=currentStep===1?'hidden':'visible';
  $('#nextBtn').classList.toggle('hidden',currentStep===totalSteps);
  $('#submitBtn').classList.toggle('hidden',currentStep!==totalSteps);
}
function stepValid(){
  const s=$(`.step[data-step="${currentStep}"]`);
  const req=$$('input[required],select[required]',s);
  const names=[...new Set(req.filter(e=>e.type==='radio').map(e=>e.name))];
  for(const name of names) if(!$(`input[name="${name}"]:checked`,s)) return false;
  for(const e of req.filter(e=>e.type!=='radio')) if(!e.value) return false;
  return true;
}
function screeningOK(){
  if(currentStep===1 && $('input[name="consent"]:checked')?.value==='Tidak'){alert('Terima kasih. Kuesioner dihentikan karena Anda tidak memberikan persetujuan.');return false}
  if(currentStep===2){
    if($('input[name="b1"]:checked')?.value==='Tidak'||$('input[name="b2"]:checked')?.value==='Tidak'){
      alert('Maaf, Anda belum memenuhi kriteria responden penelitian ini.');return false;
    }
  }
  return true;
}
$('#nextBtn').onclick=()=>{if(!stepValid()){showToast('Lengkapi bagian ini terlebih dahulu.');return} if(!screeningOK())return; if(currentStep<totalSteps){currentStep++;updateStep();window.scrollTo({top:0,behavior:'smooth'})}};
$('#prevBtn').onclick=()=>{if(currentStep>1){currentStep--;updateStep();window.scrollTo({top:0,behavior:'smooth'})}};
$('#surveyForm').addEventListener('submit',e=>{
  e.preventDefault(); if(!stepValid())return;
  const d=Object.fromEntries(new FormData(e.target).entries());
  d.timestamp=new Date().toISOString();
  if(d.EK3)d.EK3_R=String(6-Number(d.EK3));
  if(d.EK5)d.EK5_R=String(6-Number(d.EK5));
  const rows=getRows();rows.push(d);setRows(rows);
  e.target.reset();currentStep=1;updateStep();showToast('Respons berhasil disimpan.');
  setView('results');
});
updateStep();

function getSummary(){
  const rows=getRows(),means=constructMeans(rows),norm={};
  for(const [k,v] of Object.entries(means)) norm[k]=normalized(v);
  const vals=Object.values(norm).filter(v=>v>0),overall=vals.length?Math.round(mean(vals)):0;
  return {rows,means,norm,overall};
}

function renderDashboard(){
  const {rows,norm,overall}=getSummary();
  $('#statTotal').textContent=rows.length;
  const counts={Shopee:0,Tokopedia:0,Lazada:0};rows.forEach(r=>{if(r.marketplace in counts)counts[r.marketplace]++});
  const dominant=rows.length?Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]:'—';
  $('#statMarket').textContent=dominant;
  $('#statSat').textContent=norm['E-Kepuasan']?norm['E-Kepuasan']+'/100':'—';
  $('#statRep').textContent=norm['Niat Beli Ulang']?norm['Niat Beli Ulang']+'/100':'—';
  $('#overallScore').textContent=overall;
  $('#overallRing').style.background=`conic-gradient(#6b5cff ${overall*3.6}deg,#ffffff25 0deg)`;
  $('#dashBars').innerHTML=constructLabels.map(k=>barHTML(k,norm[k])).join('');
  drawRadar(norm);
  renderInsights(norm);
}
function barHTML(k,v){return `<div class="bar-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${v||0}%"></div></div><b>${v||0}</b></div>`}

function drawRadar(norm){
  const svg=$('#radarChart'),cx=210,cy=165,R=110,n=constructLabels.length;
  const pts=(rad)=>constructLabels.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [cx+Math.cos(a)*rad,cy+Math.sin(a)*rad]});
  const poly=p=>p.map(x=>x.join(',')).join(' ');
  let html='';
  [1,.75,.5,.25].forEach(f=>html+=`<polygon points="${poly(pts(R*f))}" fill="none" stroke="#e6eaf1" stroke-width="1"/>`);
  constructLabels.forEach((k,i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R,lx=cx+Math.cos(a)*(R+34),ly=cy+Math.sin(a)*(R+34);html+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#edf0f6"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#667085">${k}</text>`});
  const dataPts=constructLabels.map((k,i)=>{const a=-Math.PI/2+i*2*Math.PI/n,r=R*(norm[k]||0)/100;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r]});
  html+=`<polygon points="${poly(dataPts)}" fill="rgba(107,92,255,.20)" stroke="#6b5cff" stroke-width="3"/>`;
  dataPts.forEach(p=>html+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#6b5cff"/>`);
  svg.innerHTML=html;
}

function insightFor(name,score){
  if(!score)return {title:'Belum ada data',text:'Isi kuesioner untuk menampilkan rekomendasi.'};
  if(score>=80)return {title:`${name} kuat`,text:`Skor ${score}/100 menunjukkan aspek ini sudah menjadi kekuatan utama pengalaman pengguna.`};
  if(score>=65)return {title:`${name} cukup baik`,text:`Skor ${score}/100 sudah positif, tetapi masih ada ruang penguatan pada pengalaman pengguna.`};
  return {title:`${name} perlu perhatian`,text:`Skor ${score}/100 menunjukkan aspek ini layak diprioritaskan dalam rekomendasi perbaikan.`};
}
function renderInsights(norm){
  const sorted=constructLabels.map(k=>[k,norm[k]||0]).sort((a,b)=>a[1]-b[1]);
  const picks=[sorted[0],sorted[Math.floor(sorted.length/2)],sorted[sorted.length-1]];
  $('#insightCards').innerHTML=picks.map(([k,v])=>{const x=insightFor(k,v);return `<div class="insight"><b>${x.title}</b><p>${x.text}</p></div>`}).join('');
}

function renderResults(){
  const {rows,means,norm,overall}=getSummary();
  $('#resultOverall').textContent=overall||'—';$('#validRows').textContent=rows.length;
  const pairs=constructLabels.map(k=>[k,norm[k]||0]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  $('#bestConstruct').textContent=pairs.length?pairs[0][0]:'—';
  $('#weakConstruct').textContent=pairs.length?pairs[pairs.length-1][0]:'—';
  $('#scoreTableWrap').innerHTML=`<table class="score-table"><thead><tr><th>Konstruk</th><th>Raw Mean</th><th>Normalized</th><th>Kategori</th></tr></thead><tbody>${
    constructLabels.map(k=>{const raw=means[k]||0,n=norm[k]||0,cat=n>=80?'Sangat Baik':n>=65?'Baik':n>=50?'Cukup':'Perlu Perbaikan';return `<tr><td>${k}</td><td class="score">${raw?raw.toFixed(2):'-'}</td><td class="score">${n||'-'}</td><td>${raw?cat:'-'}</td></tr>`}).join('')
  }</tbody></table>`;
  $('#recommendations').innerHTML=constructLabels.slice().sort((a,b)=>(norm[a]||0)-(norm[b]||0)).slice(0,3).map(k=>{
    const v=norm[k]||0; return `<div class="recommend-card"><b>${k}</b><span>${v?`Skor ${v}/100. ${recommendText(k,v)}`:'Belum ada data.'}</span></div>`;
  }).join('');
  $('#roadmap').innerHTML=roadmapHTML(norm);
}
function recommendText(k,v){
  const map={
    'Keamanan':'Perkuat persepsi keamanan transaksi dan kejelasan mekanisme proteksi pembayaran.',
    'Kepercayaan':'Perkuat transparansi, kejujuran penjual, dan kualitas pengalaman yang membangun kepercayaan.',
    'Kemudahan':'Sederhanakan alur pencarian, transaksi, pembayaran, dan interaksi aplikasi.',
    'Privasi':'Perjelas kebijakan privasi dan kontrol pengguna terhadap penggunaan data pribadi.',
    'E-Kepuasan':'Fokus pada konsistensi pengalaman belanja yang menyenangkan dan sesuai ekspektasi.',
    'Niat Beli Ulang':'Perkuat faktor pengalaman yang mendorong pengguna kembali bertransaksi.'
  };
  return map[k]||'Lakukan evaluasi lanjutan.';
}
function roadmapHTML(norm){
  const weak=constructLabels.slice().sort((a,b)=>(norm[a]||0)-(norm[b]||0));
  return `<div class="roadmap-col"><small>JANGKA PENDEK</small><h4>0–3 Bulan</h4><ul><li>Prioritaskan ${weak[0]}</li><li>Audit pengalaman pengguna dan pain point</li><li>Perbaiki informasi yang paling membingungkan pengguna</li></ul></div>
  <div class="roadmap-col"><small>JANGKA MENENGAH</small><h4>3–6 Bulan</h4><ul><li>Optimalkan ${weak[1]}</li><li>Uji perubahan melalui survei lanjutan</li><li>Bandingkan skor per kelompok marketplace</li></ul></div>
  <div class="roadmap-col"><small>JANGKA PANJANG</small><h4>6–12 Bulan</h4><ul><li>Integrasikan temuan PLS-SEM</li><li>Validasi model pada sampel lebih besar</li><li>Bangun dashboard monitoring berkala</li></ul></div>`;
}

function renderReport(){
  const {rows,means,norm,overall}=getSummary();
  $('#reportDate').textContent=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  $('#reportTotal').textContent=rows.length;$('#reportIndex').textContent=`${overall}/100`;
  const counts={Shopee:0,Tokopedia:0,Lazada:0};rows.forEach(r=>{if(r.marketplace in counts)counts[r.marketplace]++});
  $('#reportMarket').textContent=rows.length?Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]:'—';
  $('#reportTable').innerHTML=`<table class="score-table"><thead><tr><th>Konstruk</th><th>Mean</th><th>Skor 0–100</th></tr></thead><tbody>${constructLabels.map(k=>`<tr><td>${k}</td><td>${means[k]?means[k].toFixed(2):'-'}</td><td>${norm[k]||'-'}</td></tr>`).join('')}</tbody></table>`;
  const pairs=constructLabels.map(k=>[k,norm[k]||0]).sort((a,b)=>b[1]-a[1]);
  $('#reportAnalysis').innerHTML=rows.length?`Berdasarkan ${rows.length} respons yang tersimpan, indeks pengalaman pengguna berada pada skor <b>${overall}/100</b>. Konstruk dengan skor relatif tertinggi adalah <b>${pairs[0][0]}</b> (${pairs[0][1]}/100), sedangkan konstruk yang paling membutuhkan perhatian adalah <b>${pairs[pairs.length-1][0]}</b> (${pairs[pairs.length-1][1]}/100). Analisis ini bersifat deskriptif dan bukan hasil estimasi PLS-SEM inferensial.`:'Belum ada respons yang dapat dianalisis.';
  $('#reportRecs').innerHTML=rows.length?`Prioritas pertama adalah ${recommendText(pairs[pairs.length-1][0],pairs[pairs.length-1][1])} Setelah data mencukupi, ekspor dataset ke SmartPLS untuk menguji measurement model, structural model, dan efek mediasi E-Kepuasan.`:'Isi kuesioner terlebih dahulu.';
}
$('#printBtn').onclick=()=>window.print();

function renderData(){
  const rows=getRows();
  $('#dataRows').innerHTML=rows.slice().reverse().slice(0,12).map(r=>{
    const sat=mean(['EK1','EK2','EK3_R','EK4','EK5_R','EK6'].map(c=>r[c]).filter(Boolean));
    const rep=mean(['NMK1','NMK2'].map(c=>r[c]).filter(Boolean));
    return `<tr><td>${new Date(r.timestamp).toLocaleString('id-ID')}</td><td>${r.marketplace||'-'}</td><td>${r.age||'-'}</td><td>${r.job||'-'}</td><td>${sat?sat.toFixed(2):'-'}</td><td>${rep?rep.toFixed(2):'-'}</td></tr>`
  }).join('')||'<tr><td colspan="6">Belum ada respons.</td></tr>';
}
$('#exportCsvBtn').onclick=()=>{
  const rows=getRows();if(!rows.length){showToast('Belum ada data.');return}
  const cols=['timestamp','name','marketplace','gender','age','education','job','frequency','payment','KM1','KM2','KP1','KP2','KP3','KMP1','KMP2','KMP3','KMP4','KMP5','KMP6','MP1','MP2','MP3','EK1','EK2','EK3','EK3_R','EK4','EK5','EK5_R','EK6','NMK1','NMK2'];
  const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const csv=[cols.join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='marketsense_plssem_dataset.csv';a.click();URL.revokeObjectURL(a.href)
};
$('#clearBtn').onclick=()=>{if(confirm('Hapus semua data lokal prototype?')){localStorage.removeItem(STORAGE);renderData();renderDashboard();showToast('Data lokal dihapus.')}};

renderDashboard();
