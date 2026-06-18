import './admin-executive-dashboard.css';
import './admin-executive-dashboard.js';

function isAdminPage(){return window.location.pathname.includes('admin')}
function token(){return localStorage.getItem('hotdog_token')||''}
function clickFirst(selector){document.querySelector(selector)?.click()}
function ensureCleanAdminWidgets(){
  if(!isAdminPage()||!token())return
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
  setInterval(ensureCleanAdminWidgets,1200)
  setTimeout(ensureCleanAdminWidgets,500)
}
bootCleanAdmin()
