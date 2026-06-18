import './admin-executive-dashboard.css';
import './admin-executive-dashboard.js';

function installCounterOrderStyles(){
  if(document.getElementById('counter-order-styles'))return
  const style=document.createElement('style')
  style.id='counter-order-styles'
  style.textContent=`
    [class~=big-form-panel]{padding:28px;border-radius:22px;border:1px solid #c48a18;background:#0b0c0d;box-shadow:0 28px 80px #000}
    [class~=big-form-panel] .panel-title{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin:0 0 22px;padding:0;border:0}
    [class~=big-form-panel] .panel-title h3{display:flex;align-items:center;gap:12px;margin:0;color:#fff;font-size:25px;line-height:1.1;letter-spacing:-.03em}
    [class~=big-form-panel] .panel-title h3 svg{color:#ffbf19}
    [class~=big-form-panel] .panel-title span{color:#e8e8e8;font-weight:800;font-size:15px;padding-top:4px;white-space:nowrap}
    [class~=big-form-panel] .stack-form{display:grid;gap:14px}
    [class~=big-form-panel] .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0}
    [class~=big-form-panel] input,[class~=big-form-panel] select,[class~=big-form-panel] textarea{width:100%;min-height:62px;border-radius:15px;border:1px solid #3a3a3a;background:#1f2022;color:#fff;font-size:15px;font-weight:800;padding:18px 20px;outline:0}
    [class~=big-form-panel] input::placeholder,[class~=big-form-panel] textarea::placeholder{color:#8e8e8e;font-weight:700}
    [class~=big-form-panel] input:focus,[class~=big-form-panel] select:focus,[class~=big-form-panel] textarea:focus{border-color:#ffbf19;box-shadow:0 0 0 4px rgba(255,174,0,.08)}
    [class~=big-form-panel] textarea{min-height:96px;resize:vertical}
    [class~=big-form-panel] .btn-secondary{min-height:46px;border:1px solid #3a3a3a;border-radius:999px;background:#171717;color:#fff;font-size:15px;font-weight:900;margin:2px 0}
    [class~=big-form-panel] .btn-primary{min-height:66px;border-radius:16px;margin-top:4px;background:linear-gradient(135deg,#ffc21a,#ff6415);color:#160900;font-size:16px;font-weight:950;box-shadow:0 22px 48px rgba(255,112,20,.25)}
    @media(max-width:900px){[class~=big-form-panel]{padding:20px}[class~=big-form-panel] .panel-title{flex-direction:column;gap:8px}[class~=big-form-panel] .form-grid{grid-template-columns:1fr}}
  `
  document.head.appendChild(style)
}

function isAdminPage(){return window.location.pathname.includes('admin')}
function token(){return localStorage.getItem('hotdog_token')||''}
function clickFirst(selector){document.querySelector(selector)?.click()}
function ensureCleanAdminWidgets(){
  if(!isAdminPage()||!token())return
  installCounterOrderStyles()
  const right=document.querySelector('.right-stack')
  if(!right)return
  if(!right.querySelector('.admin-actions-panel-final')){
    const actions=document.createElement('section')
    actions.className='admin-actions-panel-final'
    actions.innerHTML=`
      <h3>Ações rápidas</h3>
      <button type="button" data-action="availability"><span>✅</span>Disponibilidade <b>›</b></button>
      <button type="button" data-action="goals"><span>🎯</span>Metas <b>›</b></button>
      <button type="button" data-action="menu"><span>📊</span>Cardápio <b>›</b></button>
      <button type="button" data-action="post"><span>⭐</span>Pós-venda <b>›</b></button>
      <button type="button" data-action="campaign"><span>📣</span>Campanhas <b>›</b></button>`
    right.appendChild(actions)
    actions.addEventListener('click',(event)=>{
      const btn=event.target.closest('button')
      if(!btn)return
      const action=btn.dataset.action
      if(action==='availability') clickFirst('.availability-dock,[data-availability-open]')
      if(action==='goals') clickFirst('.goals-dock,[data-goals-open]')
      if(action==='menu') clickFirst('.outline-gold[href],.admin-top-actions .outline-gold')
      if(action==='post') clickFirst('.post-sale-dock,[data-post-sale-open]')
      if(action==='campaign') clickFirst('.campaign-dock,[data-campaign-open]')
    })
  }
  if(!right.querySelector('.admin-reports-panel-final')){
    const reports=document.createElement('section')
    reports.className='admin-reports-panel-final'
    reports.innerHTML=`
      <h3>Relatórios</h3>
      <button type="button" data-report-final="print">🖨️ Imprimir resumo</button>
      <button type="button" data-report-final="csv">⬇️ Exportar CSV</button>
      <button type="button" data-report-final="copy">Copiar WhatsApp</button>`
    right.appendChild(reports)
    reports.addEventListener('click',(event)=>{
      const btn=event.target.closest('button')
      if(!btn)return
      const type=btn.dataset.reportFinal
      if(type==='print') clickFirst('[data-report-print]')
      if(type==='csv') clickFirst('[data-report-csv]')
      if(type==='copy') clickFirst('[data-report-copy]')
    })
  }
}
function bootCleanAdmin(){
  installCounterOrderStyles()
  setInterval(ensureCleanAdminWidgets,1200)
  setTimeout(ensureCleanAdminWidgets,500)
}
bootCleanAdmin()
