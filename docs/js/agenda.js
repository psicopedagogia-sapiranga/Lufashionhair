const el=id=>document.getElementById(id);
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const hoje=()=>iso(new Date());
const date=s=>new Date(s+'T12:00:00');
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selecionado=hoje(),mes=date(selecionado),registros=[],editando=null,carregando=false,consulta=0;
function aviso(texto){el('aviso').textContent=texto;el('aviso').hidden=false;clearTimeout(aviso.timer);aviso.timer=setTimeout(()=>el('aviso').hidden=true,2200);}
function desenhar(){
 el('mes').textContent=mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 const inicio=new Date(mes.getFullYear(),mes.getMonth(),1),ultimo=new Date(mes.getFullYear(),mes.getMonth()+1,0);
 let html=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>'<span class="semana">'+d+'</span>').join('')+'<span></span>'.repeat(inicio.getDay());
 for(let n=1;n<=ultimo.getDate();n++){const dia=iso(new Date(mes.getFullYear(),mes.getMonth(),n));const quantidade=registros.filter(a=>a.data===dia).length;
 html+=`<button class="data ${dia===hoje()?'hoje':''} ${dia===selecionado?'selecionado':''}" data-dia="${dia}" aria-pressed="${dia===selecionado}" aria-label="${n}, ${quantidade} clientes"><span>${n}</span>${quantidade?'<small></small>':''}</button>`;}
 el('calendario').innerHTML=html;
 el('dia-titulo').textContent=date(selecionado).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
 const lista=registros.filter(a=>a.data===selecionado).sort((a,b)=>(a.hora||'99').localeCompare(b.hora||'99'));
 el('lista').innerHTML=lista.length?lista.map(a=>`<article class="marcacao"><div class="horario">${a.hora?escapeHtml(a.hora.slice(0,5)):'A combinar'}</div><div class="info"><strong>${escapeHtml(a.cliente_nome)}</strong>${a.observacoes?'<p>'+escapeHtml(a.observacoes)+'</p>':''}</div><div class="acoes"><button class="discreto" data-editar="${Number(a.id)}">Editar</button><button class="discreto" data-excluir="${Number(a.id)}">Excluir</button></div></article>`).join(''):'<p class="vazio">Nenhuma cliente marcada neste dia.</p>';
}
async function carregar(){
 const versao=++consulta;carregando=true;el('atualizar').disabled=true;el('erro').hidden=true;
 try{const inicio=iso(new Date(mes.getFullYear(),mes.getMonth(),1)),fim=iso(new Date(mes.getFullYear(),mes.getMonth()+1,0));
 const lista=await api.listarAgendamentosPeriodo(inicio,fim);if(versao!==consulta)return;
 registros=lista.filter(a=>!['cancelado','faltou'].includes(a.status));desenhar();
 }catch(e){if(versao!==consulta)return;el('erro').textContent=e.message;el('erro').hidden=false;throw e;}
 finally{if(versao===consulta){carregando=false;el('atualizar').disabled=false;}}
}
async function entrar(){await carregar();el('login').hidden=true;el('app').hidden=false;}
el('login-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;el('login-erro').textContent='';try{await api.login(el('usuario').value,el('senha').value);await entrar();el('senha').value='';}catch(err){el('login-erro').textContent=err.message;}finally{b.disabled=false;}};
el('sair').onclick=async()=>{await api.logout();location.reload();};
el('calendario').onclick=e=>{const b=e.target.closest('[data-dia]');if(b){selecionado=b.dataset.dia;desenhar();}};
async function mudarMes(delta){mes=new Date(mes.getFullYear(),mes.getMonth()+delta,1);selecionado=iso(mes);registros=[];desenhar();await carregar().catch(()=>{});}
el('anterior').onclick=()=>mudarMes(-1);el('seguinte').onclick=()=>mudarMes(1);
el('hoje').onclick=()=>{selecionado=hoje();mes=date(selecionado);registros=[];desenhar();carregar().catch(()=>{});};
el('atualizar').onclick=()=>carregar().then(()=>aviso('Agenda atualizada')).catch(()=>{});
function abrir(item=null){editando=item;el('editor-titulo').textContent=item?'Editar marcação':'Marcar cliente';el('nome').value=item?.cliente_nome||'';el('data').value=item?.data||selecionado;el('hora').value=item?.hora?.slice(0,5)||'';el('observacao').value=item?.observacoes||'';el('form-erro').textContent='';el('editor').showModal();}
el('novo').onclick=()=>abrir();el('voltar').onclick=()=>el('editor').close();
el('marcacao').onsubmit=async e=>{
 e.preventDefault();el('salvar').disabled=true;el('voltar').disabled=true;el('form-erro').textContent='';
 const dados={...(editando||{}),cliente_nome:el('nome').value.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR').replace(/(^|[\s'-])\p{L}/gu,c=>c.toLocaleUpperCase('pt-BR'))||'Cliente sem nome',data:el('data').value||selecionado,hora:el('hora').value||null,observacoes:el('observacao').value.trim(),servico_nome:editando?.servico_nome||'Atendimento',duracao_minutos:editando?.duracao_minutos||1,status:editando?.status||'agendado'};
 try{if(editando)await api.atualizarAgendamento(editando.id,dados);else await api.criarAgendamento(dados);el('editor').close();selecionado=dados.data;mes=date(selecionado);await carregar().catch(()=>{});aviso('Marcação salva');}catch(err){el('form-erro').textContent=err.message;}finally{el('salvar').disabled=false;el('voltar').disabled=false;}
};
el('editor').addEventListener('cancel',e=>{if(el('salvar').disabled)e.preventDefault();});
el('lista').onclick=async e=>{const editar=e.target.closest('[data-editar]'),excluir=e.target.closest('[data-excluir]');if(editar)abrir(registros.find(a=>Number(a.id)===Number(editar.dataset.editar)));if(excluir){const a=registros.find(a=>Number(a.id)===Number(excluir.dataset.excluir));if(!a||!confirm('Excluir esta marcação de '+a.cliente_nome+'?'))return;excluir.disabled=true;try{await api.atualizarAgendamento(a.id,{...a,status:'cancelado'});await carregar();aviso('Marcação excluída');}catch(err){aviso(err.message);excluir.disabled=false;}}};
let start=null,pull=0;
document.addEventListener('touchstart',e=>{start=!el('app').hidden&&!el('editor').open&&!carregando&&window.scrollY<=0&&e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;pull=0;},{passive:true});
document.addEventListener('touchmove',e=>{if(!start)return;if(e.touches.length!==1){start=null;el('aviso').hidden=true;return;}const t=e.touches[0];pull=t.clientY-start.y;if(pull<0||Math.abs(t.clientX-start.x)>30){start=null;el('aviso').hidden=true;return;}if(pull>10){if(e.cancelable)e.preventDefault();clearTimeout(aviso.timer);el('aviso').textContent=pull>90?'Solte para atualizar':'Puxe para atualizar';el('aviso').hidden=false;}},{passive:false});
document.addEventListener('touchend',()=>{if(!start)return;start=null;el('aviso').hidden=true;if(pull>90){aviso('Atualizando…');carregar().then(()=>aviso('Agenda atualizada')).catch(()=>aviso('Não foi possível atualizar'));}},{passive:true});
document.addEventListener('touchcancel',()=>{start=null;el('aviso').hidden=true;},{passive:true});
if(getToken())entrar().catch(e=>el('login-erro').textContent=e.message);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

