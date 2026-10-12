(function(){
function showToast(message, type = 'success'){
 var container = $('toast-container');
 var toast = el('div', 'toast ' + (type === 'error' ? 'error' : 'success'), message);
 container.appendChild(toast);
 setTimeout(function(){
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease';
  setTimeout(function(){ toast.remove(); }, 3000);
 }, 3000);
}

function resetP(){ep=null;$('pn').value='';$('pf').value='';['pr','pk','ph','pd','pm2','pwin','ploss','phist','pach','pbio'].forEach(function(i){$(i).value=''});$('ppriv').value='public';$('puser').value='';$('psteam').value='';$('pauto').checked=true;$('pfh').textContent='Nuevo Jugador';$('pc').hidden=true}
function resetT(){et=null;$('acap').value='';$('an').value='';$('at').value='';chk={};$('tfh').textContent='Nuevo Equipo';$('acc').hidden=true;rTA()}
function $(i){return document.getElementById(i)}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function say(id,m){$(id).textContent=m}
function btn(t,f){var b=el('button',0,t);b.type='button';b.onclick=f;return b}
async function ok(p){var r=await p;if(r.error)throw r.error;return r.data}
function uid(){if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
var TournamentEngine=window.CSSTVTournamentEngine;
var seedOrder=TournamentEngine.seedOrder,mkM=TournamentEngine.mkM,fillR1=TournamentEngine.fillR1,computeDead=TournamentEngine.computeDead,genKO=TournamentEngine.genKO,genDE=TournamentEngine.genDE,rrPairs=TournamentEngine.rrPairs,genGroups=TournamentEngine.genGroups,sers=TournamentEngine.sers,idx=TournamentEngine.idx,nexts=TournamentEngine.nexts,routeOne=TournamentEngine.routeOne,settle=TournamentEngine.settle,blocked=TournamentEngine.blocked,unroute=TournamentEngine.unroute,applyRes=TournamentEngine.applyRes,standings=TournamentEngine.standings,genPlayoffs=TournamentEngine.genPlayoffs,champOf=TournamentEngine.champOf;


var V=['home','matches','results','mixes','events','pcw','palmares','ranking','teams','players','match-detail','player-profile','profile','cadm','padm','tadm','vadm','sadm'];
var nav=document.querySelectorAll('nav a[data-v]');

function closeMenus(){var l=$('adm-list'),b=$('adm-btn');if(l)l.hidden=true;if(b)b.setAttribute('aria-expanded','false');var n=$('mainnav'),m=$('menu-btn');if(n)n.classList.remove('open');if(m)m.setAttribute('aria-expanded','false')}
function show(v, pushState, hashVal){
    var isA=['cadm','padm','tadm','vadm','sadm'].indexOf(v)>-1;if($('adm-btn'))$('adm-btn').classList.toggle('on',isA);
    V.forEach(function(x){$(x).hidden=x!==v});
    nav.forEach(function(a){a.classList.toggle('on',a.dataset.v===v)});
    if(v==='profile') rProfileView();
    if(v==='palmares') rPalmares();
    if(pushState) { history.pushState({view: v}, '', '#' + (hashVal || v)); }
    render();
}

nav.forEach(function(a){
    a.onclick=function(e){
        e.preventDefault();
        show(a.dataset.v, true);closeMenus();
    }
});

window.onpopstate = function(event) { handleRoute(); };
$('logo').onclick=function(e){e.preventDefault();selEv=null;closeMenus();show('home',true)};
$('menu-btn').onclick=function(){var n=$('mainnav'),o=!n.classList.contains('open');n.classList.toggle('open',o);$('menu-btn').setAttribute('aria-expanded',o?'true':'false')};
$('adm-btn').onclick=function(e){e.stopPropagation();var l=$('adm-list'),o=l.hidden;l.hidden=!o;$('adm-btn').setAttribute('aria-expanded',o?'true':'false')};
document.addEventListener('click',function(e){var l=$('adm-list');if(l&&!l.hidden&&!l.contains(e.target)&&e.target!==$('adm-btn'))closeMenus()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenus()});

function handleRoute(){
    var hash = location.hash.replace('#', '');
    if(hash.startsWith('jugador/')) {
        var slug = hash.split('/')[1];
        var found = players.filter(function(p){ return p.nick.toLowerCase() === slug.toLowerCase() || p.id === slug; })[0];
        if(found) {
            selPlayerId = found.id;
            show('player-profile', false, hash);
            rProfile();
            return;
        }
    }
    if(V.indexOf(hash) !== -1) { show(hash, false); } else { show('home', false); }
}

window.addEventListener('DOMContentLoaded', function() { load(); });

var mstats=[],eloBySteam={},eloCfg={base:30,bonus_max:5,bonus_factor:10,elo_floor:100,start_elo:1000},servers=[],pcwTeams=[],pcwPosts=[],reports=[],meCreated=null,profDet=null,profAvatarBlob=null,matchVetos=[],eeid=null,emid=null,selE=null,curM=null,sb=null,me=null,meEmail='',matches=[],events=[],registrations=[],medals=[],mapStats=[],chatMsgs=[],selEv=null,selPlayerId=null,selMatchId=null,admin=false,teams=[],players=[],reqs=[],profileReqs=[],mine=null,sel=null,ep=null,et=null,chk={}, userProfiles={};
function num(v){var n=parseFloat(v);return isNaN(n)?null:n}
function fm(v,d){return v==null?'-':Number(v).toFixed(d)}
function av(p){if(p.photo_url){var a=el('img','av');a.loading='lazy';a.src=p.photo_url;a.alt=p.nick;return a}return el('div','av',(p.nick||'?')[0].toUpperCase())}
function byId(a,id){return a.filter(function(x){return x.id===id})[0]}
function members(t){return(t.members||[]).map(function(id){return byId(players,id)}).filter(Boolean)}
async function del(t,id){try{await ok(sb.from(t).delete().eq('id',id));load();showToast('Registro eliminado correctamente.')}catch(e){showToast(e.message,'error')}}

function rPub(){var tl=$('tlist');tl.textContent='';
 if(!teams.length)tl.appendChild(el('p','msg','Sin equipos.'));
 teams.forEach(function(t){var b=el('button','tc'+(sel===t.id?' on':''));b.type='button';b.appendChild(el('b',0,t.name));
  b.appendChild(el('span',0,(t.tag?'['+t.tag+'] ':'')+members(t).length+' jug.'));b.onclick=function(){sel=t.id;render()};tl.appendChild(b)});
 var r=$('roster'),t=byId(teams,sel);r.textContent='';$('rt').textContent=t?'Plantel: '+t.name+(t.captain_id?' · Capitán: '+tagOf(t.captain_id):''):'Plantel';
 if(!t){r.appendChild(el('p','msg','Elegí un equipo.'));return}
 var m=members(t);if(!m.length){r.appendChild(el('p','msg','Sin jugadores.'));return}
 var tb=el('table'),h=el('tr');['Jugador','Rating','K/D','HS %','ADR','Mapas'].forEach(function(x,k){h.appendChild(el('th',k?'num':0,x))});tb.appendChild(h);
 m.forEach(function(p){var tr=el('tr'),c=el('td'),w=el('div','pl');w.style.cursor='pointer';w.onclick=function(){openProfile(p)};w.style.padding='0';w.appendChild(av(p));w.appendChild(el('b',0,p.nick));if(t.captain_id&&p.user_id===t.captain_id)w.appendChild(el('span','msg','(C)'));c.appendChild(w);tr.appendChild(c);
  [fm(p.rating,2),fm(p.kd,2),fm(p.hs,1),fm(p.adr,1),p.maps==null?'-':p.maps].forEach(function(x){tr.appendChild(el('td','num',x))});tb.appendChild(tr)});r.appendChild(tb)}

function openProfile(p){selPlayerId=p.id;show('player-profile', true, 'jugador/' + encodeURIComponent(p.nick.toLowerCase()));rProfile();}
$('back-players').onclick=function(){show('players', true, 'players');};



function rPA(){
 fillPUser();var l=$('plist');pager(l,'adm-players',players.slice().sort(function(a,b){return String(a.nick).localeCompare(String(b.nick),'es',{sensitivity:'base'})}),function(p){var row=el('div','pl');row.appendChild(av(p));row.appendChild(el('b',0,p.nick));row.appendChild(el('span','msg',fm(p.rating,2)));if(p.user_id)row.appendChild(el('span','msg','🔗 '+tagOf(p.user_id)));if(p.steam_id)row.appendChild(el('span','msg','Steam ✓'));
  var viewBtn=btn('Ver',function(){openProfile(p)});
  var e=btn('Editar',function(){ep=p.id;$('pn').value=p.nick;$('pr').value=p.rating==null?'':p.rating;$('pk').value=p.kd==null?'':p.kd;$('ph').value=p.hs==null?'':p.hs;$('pd').value=p.adr==null?'':p.adr;$('pm2').value=p.maps==null?'':p.maps;$('pwin').value=p.wins==null?'':p.wins;$('ploss').value=p.losses==null?'':p.losses;$('phist').value=p.team_history||'';$('pach').value=p.achievements||'';$('pbio').value=p.bio||'';$('ppriv').value=p.privacy||'public';$('puser').value=p.user_id||'';$('psteam').value=p.steam_id||'';$('pauto').checked=p.stats_auto!==false;$('pfh').textContent='Editar '+p.nick;$('pc').hidden=false;say('pm','');if($('pn').scrollIntoView)$('pn').scrollIntoView({behavior:'smooth',block:'center'})});
  e.style.marginLeft='auto';row.appendChild(viewBtn);row.appendChild(e);row.appendChild(btn('X',function(){del('players',p.id)}));return row},{text:function(p){var t=ppTeam(p);return p.nick+' '+(p.user_id?tagOf(p.user_id):'')+' '+(t?t.name:'')},ph:'Buscar jugador, cuenta o equipo...',empty:'Sin jugadores.'});
 
 opts('medal-player',players,function(p){return p.nick});
 opts('mapstat-player',players,function(p){return p.nick});

 var vList = $('admin-full-verification-list');
 if(vList){
  vList.textContent = '';
  var currentFilter = $('filter-verification-status') ? $('filter-verification-status').value : 'all';
  var searchQuery = $('search-verification-input') ? $('search-verification-input').value.toLowerCase().trim() : '';
  
  var filteredReqs = profileReqs.filter(function(req){
   var pObj = byId(players, req.player_id);
   var tagInfo = (userProfiles[req.user_id] || req.user_id).toLowerCase();
   var nickInfo = pObj ? pObj.nick.toLowerCase() : '';
   
   var matchesStatus = (currentFilter === 'all' || req.status === currentFilter);
   var matchesSearch = (!searchQuery || nickInfo.indexOf(searchQuery) !== -1 || tagInfo.indexOf(searchQuery) !== -1);
   
   return matchesStatus && matchesSearch;
  });

  if(!filteredReqs.length){
   vList.appendChild(el('p','msg','No hay solicitudes que coincidan con la búsqueda o filtro.'));
  } else {
   pager(vList,'adm-verif',filteredReqs,function(req){
    var pObj = byId(players, req.player_id);
    var row = el('div','pl');
    var tagInfo = userProfiles[req.user_id] || req.user_id.substring(0,8) + '...';
    var statusText = req.status === 'pending' ? '⏳ Pendiente' : (req.status === 'approved' ? '✅ Aprobado' : '❌ Rechazado');
    
    var infoSpan = el('span', 0, (pObj ? pObj.nick : 'Jugador borrado') + ' | Usuario: ' + tagInfo + ' | Estado: ' + statusText);
    row.appendChild(infoSpan);
    
    var actionsDiv = document.createElement('div');
    actionsDiv.style.marginLeft = 'auto';
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '4px';

    if(req.status === 'pending'){
     var apBtn = btn('Aprobar', async function(){
      try {
       await ok(sb.from('players').update({ user_id: req.user_id }).eq('id', req.player_id));
       await ok(sb.from('profile_requests').update({ status: 'approved' }).eq('id', req.id));
       showToast('¡Solicitud aprobada con éxito!');
       load();
      } catch(e){ showToast('Error: '+e.message, 'error'); }
     });
     apBtn.className = 'pri';
     actionsDiv.appendChild(apBtn);

     var rejBtn = btn('Rechazar', async function(){
      try {
       await ok(sb.from('players').update({ user_id: null }).eq('id', req.player_id));
       await ok(sb.from('profile_requests').update({ status: 'rejected' }).eq('id', req.id));
       showToast('Solicitud rechazada.');
       load();
      } catch(e){ showToast('Error: '+e.message, 'error'); }
     });
     actionsDiv.appendChild(rejBtn);
    }

    if(req.status === 'approved'){
     var revBtn = btn('Revocar', async function(){
      if(!confirm('¿Estás seguro de quitarle la verificación a este jugador?')) return;
      try {
       await ok(sb.from('players').update({ user_id: null }).eq('id', req.player_id));
       await ok(sb.from('profile_requests').update({ status: 'rejected' }).eq('id', req.id));
       showToast('Verificación revocada.');
       load();
      } catch(e){ showToast('Error: '+e.message, 'error'); }
     });
     actionsDiv.appendChild(revBtn);
    }

    var delBtn = btn('Borrar', async function(){
     if(!confirm('¿Eliminar esta solicitud y desvincular el perfil si estaba verificado?')) return;
     try {
      await ok(sb.from('players').update({ user_id: null }).eq('id', req.player_id));
      await ok(sb.from('profile_requests').delete().eq('id', req.id));
      showToast('Solicitud eliminada.');
      load();
     } catch(e){ showToast('Error: '+e.message, 'error'); }
    });
    actionsDiv.appendChild(delBtn);
    row.appendChild(actionsDiv);
    return row;
   },{search:false});
  }
 }

 var aml=$('admin-medals-list');
 pager(aml,'adm-medals',medals,function(m){
  var plObj=byId(players,m.player_id);var row=el('div','pl');
  row.appendChild(el('b',0,(plObj?plObj.nick:'?')+' — '+(m.icon||'🏆')+' '+m.title));
  var delBtn=btn('X',async function(){await ok(sb.from('player_medals').delete().eq('id',m.id));load();showToast('Medalla eliminada.')});
  delBtn.style.marginLeft='auto';row.appendChild(delBtn);return row;
 },{text:function(m){var q=byId(players,m.player_id);return(q?q.nick:'')+' '+m.title},ph:'Buscar medalla o jugador...',empty:'Sin medallas.'});

 var amsl=$('admin-mapstats-list');
 pager(amsl,'adm-mapstats',mapStats,function(msObj){
  var plObj=byId(players,msObj.player_id);var row=el('div','pl');
  row.appendChild(el('b',0,(plObj?plObj.nick:'?')+' ['+msObj.map_name+']'));
  var delBtn=btn('X',async function(){await ok(sb.from('player_map_stats').delete().eq('id',msObj.id));load();showToast('Estadística de mapa eliminada.')});
  delBtn.style.marginLeft='auto';row.appendChild(delBtn);return row;
 },{text:function(x){var q=byId(players,x.player_id);return(q?q.nick:'')+' '+x.map_name},ph:'Buscar jugador o mapa...',empty:'Sin stats de mapas.'});
 rUnlinked();
}

function rUnlinked(){var ul=$('unl-list');if(!ul)return;var g={};
 mstats.forEach(function(s){if(s.player_id||!STEAM64.test(s.steam_id))return;var m=byId(matches,s.match_id),d=m?mdate(m):null,x=g[s.steam_id]||(g[s.steam_id]={steam:s.steam_id,nick:s.nick,n:0,last:null});
  x.n++;if(d&&(!x.last||d>x.last)){x.last=d;x.nick=s.nick}});
 var free=players.filter(function(p){return!p.steam_id}).sort(function(a,b){return String(a.nick).localeCompare(String(b.nick),'es',{sensitivity:'base'})});
 pager(ul,'adm-unlinked',Object.keys(g).map(function(k){return g[k]}).sort(function(a,b){return b.n-a.n}),function(x){var r=el('div','pl'),L=el('div');L.style.minWidth='0';
  L.appendChild(el('b',0,x.nick||'?'));L.appendChild(el('div','msg',x.steam+' · '+x.n+(x.n===1?' mix':' mixes')+(x.last?' · último '+dtd(x.last):'')));L.lastChild.style.padding='0';r.appendChild(L);
  var s=el('select');s.setAttribute('aria-label','Jugador para '+(x.nick||x.steam));s.style.marginLeft='auto';s.style.width='auto';s.style.maxWidth='170px';
  var o=el('option',0,'Elegí jugador');o.value='';s.appendChild(o);free.forEach(function(p){var q=el('option',0,p.nick);q.value=p.id;s.appendChild(q)});
  var same=free.filter(function(p){return norm(p.nick)===norm(x.nick)})[0];if(same)s.value=same.id;r.appendChild(s);
  r.appendChild(btn('Vincular',async function(){if(!s.value){showToast('Elegí a qué jugador pertenece este SteamID.','error');return}
   try{await ok(sb.rpc('link_steam_id',{p_steam:x.steam,p_player:s.value}));showToast('SteamID vinculado. Sus mixes ya están en el perfil.');load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}}));
  r.appendChild(btn('Crear jugador',async function(){try{var res=await ok(sb.from('players').insert({nick:String(x.nick||'jugador').slice(0,24)}).select());
   await ok(sb.rpc('link_steam_id',{p_steam:x.steam,p_player:res[0].id}));showToast('Jugador creado y vinculado.');load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}}));
  return r},{text:function(x){return(x.nick||'')+' '+x.steam},ph:'Buscar nick o SteamID...',empty:'No hay SteamID sin vincular.'})}

// Formulario de configuración del ELO (Admin → Servidores). No pisa lo que se está editando.
var ELOF=[['elo-base','base'],['elo-start','start_elo'],['elo-bmax','bonus_max'],['elo-bfac','bonus_factor'],['elo-floor','elo_floor']];
function eloFormFill(){ELOF.forEach(function(f){var i=$(f[0]);if(i&&document.activeElement!==i&&!i.dataset.dirty)i.value=eloCfg[f[1]]});eloPreview()}
function eloFormVals(){var v={};ELOF.forEach(function(f){v[f[1]]=Number($(f[0]).value)});return v}
function eloPreview(){var v=eloFormVals(),b=Math.min(v.bonus_max,Math.round(0.4*v.bonus_factor)),w=Math.max(1,v.base+b);
 say('elo-prev','Ejemplo con equipos parejos: gana +'+v.base+' / pierde −'+v.base+'. Ganando con rating 1.40: +'+w+'. Un jugador nuevo empieza con '+v.start_elo+' (nivel '+lvlOf(v.start_elo)[0]+').')}
ELOF.forEach(function(f){var i=$(f[0]);i.oninput=function(){i.dataset.dirty='1';eloPreview()}});
$('elo-save').onclick=async function(){var v=eloFormVals(),rec=$('elo-rec').checked,b=$('elo-save');
 if(rec&&!confirm('Se guardan los valores y se recalcula el ELO de todos con todos los mixes. ¿Seguir?'))return;
 b.disabled=true;say('elo-msg',rec?'Guardando y recalculando...':'Guardando...');
 try{var n=await ok(sb.rpc('elo_set_config',{p_base:v.base,p_bonus_max:v.bonus_max,p_bonus_factor:v.bonus_factor,p_floor:v.elo_floor,p_start_elo:v.start_elo,p_recompute:rec}));
  ELOF.forEach(function(f){delete $(f[0]).dataset.dirty});
  say('elo-msg',rec?'Guardado. '+n+(n===1?' mix recalculado.':' mixes recalculados.'):'Guardado. Se aplica a los mixes nuevos.');load()}
 catch(e){say('elo-msg','Error: '+(e&&e.message||e))}finally{b.disabled=false}};
function rSrv(){eloFormFill();var l=$('srv-list');if(!l)return;l.textContent='';
 if(!servers.length){l.appendChild(none('Todavía no hay servidores. Creá uno para obtener su token.'));return}
 servers.forEach(function(s){var r=el('div','pl'),L=el('div');L.appendChild(el('b',0,s.name));
  var st=el('div','msg',(s.active?'Activo':'Revocado')+' · última conexión: '+(s.last_seen_at?dt(s.last_seen_at):'nunca'));st.style.padding='0';L.appendChild(st);r.appendChild(L);
  var rot=btn('Nuevo token',async function(){if(!confirm('Se genera un token nuevo y el actual deja de funcionar. ¿Seguir?'))return;
   try{showToken(await ok(sb.rpc('rotate_server_token',{p_server:s.id})));load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}});
  rot.style.marginLeft='auto';r.appendChild(rot);
  r.appendChild(btn(s.active?'Revocar':'Reactivar',async function(){if(s.active&&!confirm('El servidor no va a poder enviar resultados hasta que lo reactives. ¿Seguir?'))return;
   try{await ok(sb.from('game_servers').update({active:!s.active}).eq('id',s.id));load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}}));
  l.appendChild(r)})}
function showToken(tok){$('srv-token-w').hidden=false;$('srv-token').value='csstv_api_url "'+CFG.url+'/rest/v1/rpc/ingest_server_chunk"\ncsstv_api_key "'+CFG.key+'"\ncsstv_server_token "'+tok+'"'}
$('srv-add').onclick=async function(){var n=$('srv-name').value.trim();if(n.length<2){say('srv-msg','Poné un nombre de al menos 2 caracteres.');return}
 try{showToken(await ok(sb.rpc('create_server_token',{p_name:n})));$('srv-name').value='';say('srv-msg','');showToast('Servidor creado. Copiá el token.');load()}catch(e){say('srv-msg','Error: '+(e&&e.message||e))}};
$('elo-recalc').onclick=async function(){if(!confirm('Se reinicia el ELO de todos los jugadores y se vuelven a aplicar todos los mixes. ¿Seguir?'))return;
 var b=$('elo-recalc');b.disabled=true;say('elo-msg','Recalculando...');
 try{var n=await ok(sb.rpc('elo_recompute_all'));say('elo-msg','Listo: '+n+(n===1?' mix aplicado.':' mixes aplicados.'));load()}catch(e){say('elo-msg','Error: '+(e&&e.message||e))}finally{b.disabled=false}};
$('srv-copy').onclick=function(){var t=$('srv-token');t.select();
 var fb=function(){try{document.execCommand('copy');showToast('Copiado.')}catch(x){showToast('Seleccioná el texto y copialo a mano.','error')}};
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t.value).then(function(){showToast('Copiado.')},fb);else fb()};

function rTA(){capOpts();var r=$('rq');r.textContent='';var p=reqs.filter(function(x){return x.status==='pending'});
 if(!p.length)r.appendChild(el('p','msg','Sin solicitudes.'));
 p.forEach(function(q){var row=el('div','pl');row.appendChild(el('b',0,(q.tag?'['+q.tag+'] ':'')+q.name));
  var a=btn('Aprobar',async function(){try{await ok(sb.from('teams').insert({name:q.name,tag:q.tag||'',owner_id:q.user_id,captain_id:q.user_id,members:[]}));await ok(sb.from('team_requests').update({status:'approved'}).eq('user_id',q.user_id));load();showToast('Equipo aprobado.')}catch(e){showToast('Error: '+e.message,'error')}});
  a.style.marginLeft='auto';row.appendChild(a);row.appendChild(btn('Rechazar',async function(){try{await ok(sb.from('team_requests').update({status:'rejected'}).eq('user_id',q.user_id));load();showToast('Solicitud rechazada.')}catch(e){showToast('Error: '+e.message,'error')}}));r.appendChild(row)});
 var l=$('tal');l.textContent='';if(!teams.length)l.appendChild(el('p','msg','Sin equipos.'));
 teams.forEach(function(t){var row=el('div','pl');row.appendChild(el('b',0,t.name));row.appendChild(el('span','msg',members(t).length+' jug.'));
  var e=btn('Editar',function(){et=t.id;$('an').value=t.name;$('at').value=t.tag||'';chk={};(t.members||[]).forEach(function(id){chk[id]=1});$('acap').value=t.captain_id||'';$('tfh').textContent='Editar '+t.name;$('acc').hidden=false;say('am','');rTA()});
  e.style.marginLeft='auto';row.appendChild(e);row.appendChild(btn('X',function(){del('teams',t.id)}));l.appendChild(row)});
 drawPicker()}

function tn(id){var t=byId(teams,id)||byId(pcwTeams,id);return t?t.name:'?'}
function evn(id){var e=byId(events,id);return e?e.name:''}
function tbl(h,rows){var t=el('table'),r=el('tr');h.forEach(function(x){r.appendChild(el('th',0,x))});t.appendChild(r);
 rows.forEach(function(c){var tr=el('tr');c.forEach(function(x){var td=el('td');if(x&&x.nodeType)td.appendChild(x);else td.textContent=x==null?'':x;tr.appendChild(td)});t.appendChild(tr)});return t}
function put(id,n){var c=$(id);c.textContent='';c.appendChild(n)}
function none(t){return el('p','msg',t)}
function dt(x){return x?new Date(x).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}
function loc(i){var d=new Date(i);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function sc(m){return m.score1==null?'-':m.score1+' - '+m.score2}

function openMatchDetail(mId){ selMatchId=mId;show('match-detail', true);rMatchDetail(); }
$('back-matches').onclick=function(){show('matches', true)};

function accounts(){var ids={};Object.keys(userProfiles).forEach(function(k){ids[k]=1});players.forEach(function(p){if(p.user_id)ids[p.user_id]=1});teams.forEach(function(t){if(t.owner_id)ids[t.owner_id]=1;if(t.captain_id)ids[t.captain_id]=1});return Object.keys(ids)}
function tagOf(id){if(!id)return'Sin capitán';if(userProfiles[id])return userProfiles[id];var p=players.filter(function(x){return x.user_id===id})[0];return p?p.nick:'Usuario '+String(id).slice(0,6)}
function capOpts(){var s=$('acap'),v=s.value;s.textContent='';var o=el('option',0,'Sin capitán');o.value='';s.appendChild(o);
 accounts().sort(function(a,b){return tagOf(a).localeCompare(tagOf(b))}).forEach(function(id){var x=el('option',0,tagOf(id));x.value=id;s.appendChild(x)});s.value=v;selRefresh(s)}
function rCap(){var sec=$('cap-sec'),box=$('cap-box'),mt=me?teams.filter(function(t){return t.captain_id===me}):[];sec.hidden=!mt.length;box.textContent='';
 mt.forEach(function(t){var d=el('div','fm');d.style.padding='0';d.appendChild(el('b',0,t.name));
  var cand=members(t).filter(function(p){return p.user_id&&p.user_id!==me});
  if(!cand.length){d.appendChild(el('p','msg','Ningún jugador de tu equipo tiene la cuenta verificada todavía. Hasta entonces, solo un admin puede cambiar al capitán.'));box.appendChild(d);return}
  var s=el('select');s.setAttribute('aria-label','Nuevo capitán');
  cand.forEach(function(p){var o=el('option',0,p.nick+(userProfiles[p.user_id]?' ('+userProfiles[p.user_id]+')':''));o.value=p.user_id;s.appendChild(o)});
  d.appendChild(s);
  d.appendChild(btn('Ceder capitanía',async function(){var c=cand.filter(function(p){return p.user_id===s.value})[0];
   if(!c||!confirm('¿Ceder la capitanía de '+t.name+' a '+c.nick+'? Vas a perder el permiso de vetar.'))return;
   try{await ok(sb.rpc('set_team_captain',{p_team:t.id,p_user:s.value}));showToast('Capitanía cedida a '+c.nick+'.');load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}}));
  box.appendChild(d)})}
var VPOOL=['dust2_ob','cbble','inferno','nuke','mirage','tuscan','season','train','cache'];
function vetoSeq(bo,n){var a=[];if(bo>=3)a.push('ban','ban');if(bo===3)a.push('pick','pick');if(bo>=5)a.push('pick','pick','pick','pick');while(a.length<n-1)a.push('ban');return a.slice(0,n-1)}
function isCap(tid){var t=byId(teams,tid)||byId(pcwTeams,tid);return!!(me&&t&&t.captain_id===me)}
function vlist(mid){return matchVetos.filter(function(v){return v.match_id===mid}).sort(function(a,b){return a.seq-b.seq})}
function rVeto(m){var box=$('md-veto');box.textContent='';var wrap=el('div','veto-box'),bo=m.best_of||1,seq=vetoSeq(bo,VPOOL.length),vs=vlist(m.id),n=vs.length,done=n>=seq.length;
 wrap.appendChild(el('b',0,'Veto y Pick de Mapas · BO'+bo));
 var tt=!done?(n%2===0?m.team1:m.team2):null,can=!done&&isCap(tt)&&m.status!=='finished';
 wrap.appendChild(el('p','msg',done?'Veto completo. Los mapas están definidos.':'Turno de '+tn(tt)+': '+(seq[n]==='ban'?'banear un mapa':'elegir un mapa')+'.'));
 if(!me)wrap.appendChild(el('p','msg','Iniciá sesión para participar. Solo los capitanes de los dos equipos pueden vetar.'));
 else if(!isCap(m.team1)&&!isCap(m.team2))wrap.appendChild(el('p','msg','Solo los capitanes de los dos equipos pueden vetar.'));
 else if(can)wrap.appendChild(el('p',0,'Es tu turno: tocá un mapa para '+(seq[n]==='ban'?'banearlo':'elegirlo')+'.'));
 else if(!done)wrap.appendChild(el('p','msg','Esperando al capitán de '+tn(tt)+'...'));
 var g=el('div','map-grid'),used={};vs.forEach(function(v){used[v.map]=v});var rest=VPOOL.filter(function(x){return!used[x]});
 VPOOL.forEach(function(mp){var v=used[mp],cls='map-pill',sub='';
  if(v){cls+=v.action==='ban'?' banned':' picked';sub=(v.action==='ban'?'Ban':'Pick')+' · '+tn(v.team_id)}
  else if(done&&rest.length===1&&rest[0]===mp){cls+=' decider';sub='Decisivo'}
  else if(can)cls+=' can';
  var p=el('div',cls,mp);if(sub)p.appendChild(el('small',0,sub));
  if(!v&&can)p.onclick=function(){vetoAct(m,n,mp,seq[n],tt)};
  g.appendChild(p)});
 wrap.appendChild(g);
 if(done){var order=vs.filter(function(v){return v.action==='pick'}).map(function(v){return v.map});if(rest.length===1)order.push(rest[0]);wrap.appendChild(el('p',0,'Mapas a jugar: '+order.join(' → ')))}
 if(admin&&vs.length){wrap.appendChild(btn('Reiniciar veto',async function(){if(!confirm('¿Borrar el veto de esta partida y empezar de nuevo?'))return;
  try{await ok(sb.from('match_vetos').delete().eq('match_id',m.id));await refreshVetos()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}}))}
 box.appendChild(wrap)}
async function vetoAct(m,n,mp,act,team){if(!me)return;
 try{await ok(sb.from('match_vetos').insert({match_id:m.id,seq:n+1,team_id:team,map:mp,action:act,by_user:me}));await refreshVetos()}
 catch(e){showToast('No se pudo vetar: '+(e&&e.message||e),'error');await refreshVetos()}}
async function refreshVetos(){if(!selMatchId)return;var id=selMatchId,r=await sb.from('match_vetos').select('*').eq('match_id',id);if(r.error)return;
 matchVetos=matchVetos.filter(function(v){return v.match_id!==id}).concat(r.data||[]);var m=byId(matches,id);if(m&&shown('match-detail'))rVeto(m)}
var pollSig={};
async function pollMatch(){var m=byId(matches,selMatchId);if(!sb||!m||!shown('match-detail')||document.hidden)return;var id=m.id;
 var R=await Promise.all([sb.from('matches').select('*').eq('id',id).maybeSingle(),sb.from('match_vetos').select('*').eq('match_id',id),sb.from('result_reports').select('*').eq('match_id',id),sb.from('match_chat').select('*').eq('match_id',id).order('created_at',{ascending:false}).limit(50)]);
 if(selMatchId!==id)return;
 if(R[0].data){var i=matches.findIndex(function(x){return x.id===id});if(i>-1)matches[i]=R[0].data}
 var vs=R[1].error?null:(R[1].data||[]),rp=R[2].error?null:(R[2].data||[]),ch=R[3].error?null:(R[3].data||[]).slice().reverse();
 if(vs)matchVetos=matchVetos.filter(function(v){return v.match_id!==id}).concat(vs);
 if(rp)reports=reports.filter(function(r){return r.match_id!==id}).concat(rp);
 if(ch)chatMsgs=ch;
 var m2=byId(matches,id),first=!pollSig[id],S=pollSig[id]||(pollSig[id]={});
 var sv=vs?vs.length:S.v,sr=(rp?rp.map(function(r){return r.id+'@'+r.updated_at}).join('|'):'')+'|'+(m2?[m2.status,m2.score1,m2.score2].join(','):''),sc2=ch?ch.length+':'+(ch.length?ch[ch.length-1].id:''):S.c;
 if(!first){if(S.r!==sr){rMatchDetail()}else{if(S.v!==sv&&m2&&m2.kind!=='mix')rVeto(m2);if(S.c!==sc2)drawChat()}}
 S.v=sv;S.r=sr;S.c=sc2}
setInterval(pollMatch,5000);
[['medal-player','Buscar jugador...'],['mapstat-player','Buscar jugador...'],['puser','Buscar cuenta...'],['acap','Buscar cuenta...']].forEach(function(x){enhanceSelect(x[0],x[1])});
function rMatchDetail(){
 var m=byId(matches,selMatchId);if(!m)return;
 $('md-title').textContent='Encuentro: '+tn(m.team1)+' vs '+tn(m.team2);
 var connContainer=$('md-connect-container');connContainer.textContent='';
 if(m.server_ip){var connBtn=Object.assign(el('a','pri','Conectar a Servidor (Steam)'),{href:'steam://connect/'+m.server_ip});
  connBtn.style.padding='5px 10px';connBtn.style.borderRadius='4px';connBtn.style.fontSize='12px';connContainer.appendChild(connBtn)}
 var hero=$('md-hero');hero.textContent='';
 hero.appendChild(el('h2','',tn(m.team1)+'  '+sc(m)+'  '+tn(m.team2)));
 hero.appendChild(el('p','msg','Mapa: '+(m.map||'Sin definir')+' | Estado: '+m.status));
 if(m.kind==='pcw'){[m.team1,m.team2].forEach(function(id){hero.appendChild(el('p','msg',tn(id)+': '+(rosterText(tget(id))||'sin datos')))})}
 var isMix=m.kind==='mix';$('md-vr').hidden=isMix;rStats(m);
 if(!isMix){rVeto(m);rResult(m)}rChat()}

function drawChat(){var cBox=$('md-chat');cBox.textContent='';var f=chatMsgs.filter(function(msg){return msg.match_id===selMatchId});
 if(!f.length)cBox.appendChild(none('Sin mensajes.'));
 f.forEach(function(msg){var d=el('div','chat-msg'),userTag=userProfiles[msg.user_id]||msg.user_email||'Anónimo';d.appendChild(el('b',0,userTag));d.appendChild(document.createTextNode(msg.message));cBox.appendChild(d)});
 cBox.scrollTop=cBox.scrollHeight}
async function fetchChat(){if(!selMatchId||!sb)return;var id=selMatchId,r=await sb.from('match_chat').select('*').eq('match_id',id).order('created_at',{ascending:false}).limit(50);
 if(r.error||selMatchId!==id)return;chatMsgs=(r.data||[]).slice().reverse();drawChat()}
function rChat(){drawChat();fetchChat()}

$('chat-send').onclick=async function(){
 var text=$('chat-input').value.trim();if(!text||!me)return;
 try{
  await ok(sb.from('match_chat').insert({match_id:selMatchId,user_id:me,user_email:me,message:text}));
  $('chat-input').value='';
  await fetchChat();
 }catch(e){showToast('Error: '+e.message,'error')}
};





/* rProfileView: ver más abajo */

/* prof-save: ver más abajo */

function mrow(m){
 var f=m.status==='finished',w1=f&&m.score1>m.score2,w2=f&&m.score2>m.score1;
 var links=[];
 if(m.server_ip && m.status==='live') {
  links.push(Object.assign(el('a','','[Conectar]'),{href:'steam://connect/'+m.server_ip}));
 }
 if(m.demo_url)links.push(Object.assign(el('a','','[Demo]'),{href:m.demo_url,target:'_blank'}));
 if(m.video_url)links.push(Object.assign(el('a','','[Video]'),{href:m.video_url,target:'_blank'}));
 var linkContainer=document.createElement('span');linkContainer.style.display='flex';linkContainer.style.gap='4px';links.forEach(function(l){linkContainer.appendChild(l)});
 var detBtn=btn('Ver',function(){openMatchDetail(m.id)});
 linkContainer.appendChild(detBtn);
 return [m.status==='live'?el('span','tag','LIVE'):dt(m.starts_at),el('span',w1?'w':null,tn(m.team1)),m.status==='upcoming'?'vs':sc(m),el('span',w2?'w':null,tn(m.team2)),m.map||'',linkContainer]}

function mtbl(l,e){return l.length?tbl(['Fecha','Eq 1','Resultado','Eq 2','Mapa','Acción'],l.map(mrow)):none(e)}
function mdate(m){return m.played_at||m.starts_at}
function mixList(){return matches.filter(function(m){return m.kind==='mix'&&m.status==='finished'}).sort(function(a,b){return new Date(mdate(b)||0)-new Date(mdate(a)||0)})}
function statsOf(mid){return mstats.filter(function(s){return s.match_id===mid})}
function statNick(s){var p=s.player_id?byId(players,s.player_id):null;return p?p.nick:(s.nick||'?')}
// Niveles de FACEIT: [nivel, ELO mínimo, color]. El ELO sale de player_elo (por SteamID); sin mixes, 1000.
var LV=[[1,0,'#9aa0a6'],[2,501,'#1ca82a'],[3,751,'#1ca82a'],[4,901,'#e0a800'],[5,1051,'#e0a800'],[6,1201,'#e0a800'],[7,1351,'#e0a800'],[8,1531,'#ff6309'],[9,1751,'#ff6309'],[10,2001,'#e5361f']];
function eloRow(p){return p&&p.steam_id?eloBySteam[p.steam_id]||null:null}
function eloOf(p){var e=eloRow(p);return e?e.elo:eloCfg.start_elo}
function lvlOf(elo){for(var i=LV.length-1;i>0;i--)if(elo>=LV[i][1])return LV[i];return LV[0]}
function lvlBadge(elo,big){var l=lvlOf(elo),b=el('span','lvl'+(big?' lg':''),String(l[0]));b.style.setProperty('--c',l[2]);b.title='Nivel '+l[0]+' · '+elo+' ELO';return b}
function eloDelta(d){return d==null?'-':el('span',d>0?'eu':d<0?'ed':null,(d>0?'+':'')+d)}
function mvpOf(mid){var b=null;statsOf(mid).forEach(function(s){if(s.rating!=null&&(!b||+s.rating>+b.rating))b=s});return b}
var MIXH=['Fecha','Mapa','Equipo 1','Resultado','Equipo 2','MVP',''];
function mixRow(m){var mv=mvpOf(m.id),w1=m.winner&&m.winner===m.team1,w2=m.winner&&m.winner===m.team2;
 return[dt(mdate(m)),m.map||'-',el('span',w1?'w':null,tn(m.team1)),sc(m),el('span',w2?'w':null,tn(m.team2)),mv?statNick(mv)+' ('+fm(mv.rating,2)+')':'-',btn('Ver',function(){openMatchDetail(m.id)})]}
function mixTbl(l,e){return l.length?tbl(MIXH,l.map(mixRow)):none(e)}
function rStats(m){var l=statsOf(m.id),w=$('md-stats-w'),box=$('md-stats');w.hidden=!l.length;box.textContent='';if(!l.length)return;
 [1,2].forEach(function(k){var tid=k===1?m.team1:m.team2,rows=l.filter(function(s){return s.team===k}).sort(function(a,b){return(+b.rating||0)-(+a.rating||0)});if(!rows.length)return;
  box.appendChild(el('div','gt',tn(tid)+(m.winner&&m.winner===tid?' · ganador':'')));
  box.appendChild(tbl(['Jugador','K','D','A','+/-','HS %','ADR','Rating','ELO'],rows.map(function(s){var p=s.player_id?byId(players,s.player_id):null,n,df=s.kills-s.deaths,nc=el('span','nb');
   if(p){n=el('a',0,p.nick);n.href='#';n.onclick=function(e){e.preventDefault();openProfile(p)}}else n=el('span','tbd',(s.nick||'?')+' (sin perfil)');
   if(s.elo_before!=null)nc.appendChild(lvlBadge(s.elo_before));nc.appendChild(n);
   return[nc,s.kills,s.deaths,s.assists,(df>0?'+':'')+df,s.kills?Math.round(s.headshots*100/s.kills)+'%':'-',s.rounds?fm(s.damage/s.rounds,1):'-',fm(s.rating,2),eloDelta(s.elo_delta)]})))});
 if(admin&&m.kind==='mix'){var d=btn('Borrar este mix',async function(){if(!confirm('Se borra el mix con sus estadísticas y se recalculan los perfiles y el ELO de todos. ¿Seguir?'))return;
   var ids=l.map(function(s){return s.player_id}).filter(Boolean);
   try{await ok(sb.from('matches').delete().eq('id',m.id));await ok(sb.from('teams').delete().in('id',[m.team1,m.team2]).eq('kind','mix'));
    for(var i=0;i<ids.length;i++)await ok(sb.rpc('recompute_player_stats',{p_player:ids[i]}));
    await ok(sb.rpc('elo_recompute_all'));
    showToast('Mix borrado.');show('mixes',true);load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}});
  d.style.margin='12px';box.appendChild(d)}}
function isOrph(m){return!!(m.stage&&(!m.event_id||(events.length&&!byId(events,m.event_id))))}
function isOfficial(m){return m.kind!=='pcw'&&m.kind!=='mix'}
function ms(s){return matches.filter(function(m){return m.status===s&&!m.bye&&m.team1&&m.team2&&!isOrph(m)&&isOfficial(m)})}
function byDate(a,b){return new Date(a.starts_at||0)-new Date(b.starts_at||0)}
function rank(){var r={};teams.forEach(function(t){r[t.id]={t:t,pj:0,g:0,p:0}});
 matches.forEach(function(m){if(m.status!=='finished'||m.bye||isOrph(m)||!isOfficial(m)||m.score1==null||m.score1===m.score2||!r[m.team1]||!r[m.team2])return;
  var w=m.score1>m.score2?m.team1:m.team2,l=w===m.team1?m.team2:m.team1;r[w].pj++;r[w].g++;r[l].pj++;r[l].p++});
 return Object.keys(r).map(function(k){var x=r[k];x.pts=x.g*3;return x}).sort(function(a,b){return b.pts-a.pts||b.g-a.g})}

function rHome(){put('hlive',mtbl(ms('live'),'Sin partidas en vivo.'));put('hup',mtbl(ms('upcoming').sort(byDate).slice(0,4),'Sin próximas partidas.'));
 put('hres',mtbl(ms('finished').sort(byDate).reverse().slice(0,4),'Sin resultados.'));
 put('hmix',mixTbl(mixList().slice(0,4),'Todavía no hay mixes del servidor.'));
 var tdiv=$('htournaments');tdiv.textContent='';if(!events.length)tdiv.appendChild(none('Sin torneos.'));
 events.slice(0,3).forEach(function(e){var d=el('div','rank');d.appendChild(el('b',0,e.name));var f=el('span',0,e.stage||'Inscripciones');d.appendChild(f);tdiv.appendChild(d)});
 var k=$('hrank');k.textContent='';var rk=rank();if(!rk.length)k.appendChild(none('Sin equipos.'));
 rk.slice(0,4).forEach(function(x,i){var r=el('div','rank');r.appendChild(el('i',0,i+1));r.appendChild(el('span',0,x.t.name));r.appendChild(el('span',0,x.pts+'p'));k.appendChild(r)})}

function rPalmares(){
 var pBox=$('vp-palmares');pBox.textContent='';
 var fin=events.filter(function(e){return e.stage==='Finalizado'});
 if(!fin.length){pBox.appendChild(none('No hay torneos finalizados en el Salón de la Fama todavía.'));return}
 var rows=[];
 fin.forEach(function(e){var champ='Sin campeón';
  if(e.champion)champ=tn(e.champion);
  else{var em=matches.filter(function(m){return m.event_id===e.id&&m.status==='finished'&&!m.bye});
   if(em.length){var l=em[em.length-1];if(l.score1!=null&&l.score2!=null&&l.score1!==l.score2)champ=tn(l.score1>l.score2?l.team1:l.team2)}}
  rows.push([e.name,e.prize||'-',champ])});
 pBox.appendChild(tbl(['Torneo','Premio','🏆 Clan Campeón'],rows))}

function rViews(){
 if(shown('matches'))put('vm1',mtbl(ms('live'),'Sin partidas en vivo.'));
 if(shown('matches'))put('vm2',mtbl(ms('upcoming').sort(byDate),'Sin próximas partidas.'));
 if(shown('results'))put('vr',mtbl(ms('finished').sort(byDate).reverse(),'Sin resultados.'));
 if(shown('mixes'))pager($('vmix'),'pub-mixes',mixList(),mixRow,{head:MIXH,text:function(m){return(m.map||'')+' '+tn(m.team1)+' '+tn(m.team2)+' '+statsOf(m.id).map(statNick).join(' ')},per:15,ph:'Buscar mapa o jugador...',empty:'Todavía no hay mixes del servidor.'});
 var rk=shown('ranking')?rank():[];if(shown('ranking'))put('vk',rk.length?tbl(['#','Equipo','PJ','G','P','Pts'],rk.map(function(x,i){return [i+1,x.t.name,x.pj,x.g,x.p,x.pts]})):none('Sin equipos.'));

 if(shown('events'))rEvents();

 var nm=function(p){var e=eloRow(p);return e?e.matches:0};
 var ps=players.slice().sort(function(a,b){return eloOf(b)-eloOf(a)||nm(b)-nm(a)||String(a.nick).localeCompare(String(b.nick),'es',{sensitivity:'base'})});
 if(shown('players'))pager($('vp'),'pub-players',ps,function(p){
  var t=teams.filter(function(x){return(x.members||[]).indexOf(p.id)>-1})[0],w=el('div','pl');w.style.padding='0';w.appendChild(av(p));w.appendChild(el('b',0,p.nick));
  var vB=btn('Ver',function(){openProfile(p)});
  return [w,lvlBadge(eloOf(p)),eloOf(p),t?t.name:'-',fm(p.rating,2),fm(p.kd,2),vB]},{head:['Jugador','Nivel','ELO','Equipo','Rating','K/D','Acción'],text:function(p){var t=teams.filter(function(x){return(x.members||[]).indexOf(p.id)>-1})[0];return p.nick+' '+(t?t.name+' '+(t.tag||''):'')},per:15,ph:'Buscar jugador o equipo...',empty:'Sin jugadores.'});}

$('back-events').onclick=function(){selEv=null;rViews()};

function opts(id,list,lab,blank){var s=$(id),v=s.value;s.textContent='';if(blank){var o=el('option',0,blank);o.value='';s.appendChild(o)}
 list.forEach(function(x){var o=el('option',0,lab(x));o.value=x.id;s.appendChild(o)});if(v)s.value=v;selRefresh(s)}

function rC(){
 opts('mt1',teams,function(t){return t.name});opts('mt2',teams,function(t){return t.name});opts('mev',events,function(e){return e.name},'Sin torneo');
 var l=$('cml');l.textContent='';var gl=matches.filter(function(m){return(!m.stage||isOrph(m))&&m.kind!=='mix'}),orf=gl.filter(isOrph);if(!gl.length)l.appendChild(none('Sin partidas.'));
 if(orf.length){var bb=btn('Borrar '+orf.length+' partida(s) de torneos eliminados',async function(){if(!confirm('Se borran '+orf.length+' partidas que quedaron de torneos eliminados. ¿Seguir?'))return;try{for(var q=0;q<orf.length;q++)await ok(sb.from('matches').delete().eq('id',orf[q].id));showToast('Partidas borradas.');load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}});bb.className='pri';l.appendChild(bb)}
 gl.sort(function(a,b){return(isOrph(b)?1:0)-(isOrph(a)?1:0)||byDate(b,a)}).slice(0,40).forEach(function(m){var r=el('div','pl');r.appendChild(el('b',0,tn(m.team1)+' vs '+tn(m.team2)));r.appendChild(el('span','msg',m.status+(isOrph(m)?' · de un torneo eliminado':'')));
  var e=btn('Editar',function(){emid=m.id;$('mt1').value=m.team1;$('mt2').value=m.team2;$('mev').value=m.event_id||'';$('mmap').value=m.map||'';$('mserver').value=m.server_ip||'';$('mst').value=m.starts_at?loc(m.starts_at):'';$('mss').value=m.status;$('ms1').value=m.score1==null?'':m.score1;$('ms2').value=m.score2==null?'':m.score2;$('mdem').value=m.demo_url||'';$('mvid').value=m.video_url||'';$('mfh').textContent='Editar';$('mcn').hidden=false;say('mmsg','')});
  e.style.marginLeft='auto';r.appendChild(e);r.appendChild(btn('X',function(){del('matches',m.id)}));l.appendChild(r)});
 var v=$('cel');v.textContent='';if(!events.length)v.appendChild(none('Sin torneos.'));
 events.forEach(function(x){var r=el('div','pl');r.appendChild(el('b',0,x.name));r.appendChild(el('span','msg',x.stage||'Inscripciones'));
  var ed=btn('Gestionar',function(){eeid=x.id;selE=x.id;fillE();rEM()});
  ed.style.marginLeft='auto';r.appendChild(ed);r.appendChild(btn('X',function(){if(confirm('Se elimina el torneo y todas sus partidas. ¿Seguir?'))delEvent(x)}));v.appendChild(r)})}

var emid=null,eeid=null;
function resetM(){emid=null;['mmap','mserver','mst','ms1','ms2','mdem','mvid'].forEach(function(i){$(i).value=''});$('mss').value='upcoming';$('mfh').textContent='Crear / Editar Partida';$('mcn').hidden=true}
function resetE(){eeid=null;selE=null;['en','emin','emax','eprize','es','ee','erules'].forEach(function(i){$(i).value=''});$('efmt').value='playoffs';$('ebo').value='1';$('efbo').value='1';$('egrp').value='2';$('eadv').value='2';$('edrr').checked=false;$('efh').textContent='Nuevo Torneo';$('ecn').hidden=true;$('egm').hidden=true;fmtE()}

var FMT={playoffs:'Eliminación simple',single:'Eliminación simple',double:'Doble eliminación',rr:'Todos contra todos',groups:'Grupos + playoffs',swiss:'Suizo (sin fixture automático)'},SO={group:0,ko:1,upper:1,lower:2,grand:3};
function tms(id){return matches.filter(function(m){return m.event_id===id})}
function ssort(a,b){return(SO[a.stage]||0)-(SO[b.stage]||0)||(a.grp||0)-(b.grp||0)||a.round-b.round||a.pos-b.pos}
function parts(e){var ids=(e.seeds||[]).slice();registrations.forEach(function(r){if(r.event_id===e.id&&ids.indexOf(r.team_id)<0)ids.push(r.team_id)});return ids.filter(function(id){return!!byId(teams,id)})}
function tobj(e){return{id:e.id,format:(!e.format||e.format==='playoffs')?'single':e.format,teams:parts(e),groups:e.group_count||2,advance:e.advance||2,best_of:e.best_of||1,final_bo:e.final_bo||1,double_rr:!!e.double_rr,champion:e.champion||null,generated:!!e.generated}}
function rname(m){var t=byId(events,m.event_id);
 if(m.stage==='group')return(t&&t.format==='groups'?'Grupo '+String.fromCharCode(64+m.grp)+' · ':'')+'Fecha '+m.round;
 if(m.stage==='grand')return'Gran final';
 var k=0;matches.forEach(function(x){if(x.event_id===m.event_id&&x.stage===m.stage&&x.round>k)k=x.round});
 if(m.stage==='ko'){var d=k-m.round;return d===0?'Final':d===1?'Semifinal':d===2?'Cuartos de final':d===3?'Octavos de final':'Ronda '+m.round}
 return(m.stage==='upper'?'Upper':'Lower')+(m.round===k?' final':' ronda '+m.round)}
function mbox(m){var d=el('div','mb'+(m.bye?' off':''));
 [[m.team1,m.score1],[m.team2,m.score2]].forEach(function(x){var r=el('div','mr'+(m.status==='finished'&&m.winner&&m.winner===x[0]?' w2':''));
  r.appendChild(el('span',x[0]?0:'tbd',x[0]?tn(x[0]):'Por definir'));r.appendChild(el('b',0,x[1]==null?'':x[1]));d.appendChild(r)});
 d.onclick=function(){if(!m.bye&&m.team1&&m.team2)openMatchDetail(m.id)};return d}
function brk(M,stage,e){var l=M.filter(function(m){return m.stage===stage});if(!l.length)return null;
 var by={},mx=0;l.forEach(function(m){(by[m.round]=by[m.round]||[]).push(m);if(m.round>mx)mx=m.round});
 var w=el('div','bk');for(var r=1;r<=mx;r++){if(!by[r]||by[r].every(function(m){return m.bye}))continue;var c=el('div','bc');c.appendChild(el('h4',0,rname(by[r][0])));
  by[r].sort(function(a,b){return a.pos-b.pos}).forEach(function(m){c.appendChild(mbox(m))});w.appendChild(c)}return w}
function kv(p,k,v){var d=el('div');d.appendChild(el('b',0,k+': '));d.appendChild(document.createTextNode(v));p.appendChild(d)}
function rEvents(){var e=byId(events,selEv);$('ev-detail').hidden=!e;$('ve1').parentElement.hidden=!!e;
 put('ve1',events.length?tbl(['Torneo','Formato','Estado','Equipos','Premio','Campeón',''],events.map(function(x){return[x.name,FMT[x.format||'playoffs']||x.format,x.stage||'Inscripciones',parts(x).length,x.prize||'-',x.champion?tn(x.champion):'-',btn('Ver',function(){selEv=x.id;rViews()})]})):none('Sin torneos.'));
 if(e)rED(e)}
function rED(e){var T=tobj(e),M=tms(e.id),stg=e.stage||'Inscripciones';$('ve3').textContent='Torneo: '+e.name;var i=$('ve-info');i.textContent='';var box=el('div','fm');
 kv(box,'Formato',(FMT[e.format||'playoffs']||e.format)+(T.format==='groups'?' ('+T.groups+' grupos, clasifican '+T.advance+' de cada uno)':'')+(T.double_rr?', ida y vuelta':''));
 kv(box,'Partidas','BO'+T.best_of+(T.final_bo!==T.best_of?' (final BO'+T.final_bo+')':''));kv(box,'Estado',stg);
 if(e.starts_on||e.ends_on)kv(box,'Fechas',(e.starts_on||'?')+' al '+(e.ends_on||'?'));kv(box,'Premio',e.prize||'-');
 if(e.max_teams)kv(box,'Cupo',T.teams.length+' / '+e.max_teams);if(e.champion)kv(box,'Campeón',tn(e.champion));
 if(e.rules){var p=el('p',0,e.rules);p.style.whiteSpace='pre-wrap';p.style.margin='6px 0 0';box.appendChild(p)}
 var myTeam=teams.filter(function(t){return t.owner_id===me})[0];
 var already=registrations.some(function(r){return r.event_id===e.id&&myTeam&&r.team_id===myTeam.id}),full=e.max_teams&&T.teams.length>=e.max_teams;
 if(me&&myTeam&&stg==='Inscripciones'&&!e.generated&&(already||!full)){
  var bR=btn(already?'Cancelar inscripción':'Inscribir equipo',async function(){
   try{if(already){await ok(sb.from('tournament_registrations').delete().match({event_id:e.id,team_id:myTeam.id}));showToast('Inscripción cancelada.')}
    else{await ok(sb.from('tournament_registrations').insert({event_id:e.id,team_id:myTeam.id}));showToast('¡Equipo inscripto con éxito!')}load()}catch(err){showToast('Error: '+err.message,'error')}});
  bR.className='pri';box.appendChild(bR)}
 i.appendChild(box);
 var gm=M.filter(function(m){return m.stage==='group'}),tp=$('ve-pos');$('ve-pos-w').hidden=!gm.length;tp.textContent='';
 if(gm.length){var G=T.format==='rr'?1:T.groups;for(var g=1;g<=G;g++){(function(g){var ids=T.teams.filter(function(id){return gm.some(function(m){return m.grp===g&&(m.team1===id||m.team2===id)})});
  if(T.format==='groups')tp.appendChild(el('div','gt','Grupo '+String.fromCharCode(64+g)));
  var rows=standings(M,ids,g).map(function(x,k){return[k+1,tn(x.id),x.pj,x.w,x.d,x.l,x.rf+':'+x.ra,x.pts,T.format==='groups'&&k<T.advance?'Clasifica':'']});
  var w=el('div','scroll');w.appendChild(tbl(['#','Equipo','PJ','G','E','P','Rondas','Pts',''],rows));tp.appendChild(w)})(g)}}
 var tb=$('ve-bracket');tb.textContent='';var any=false;
 [['ko',T.format==='groups'?'Playoffs':''],['upper','Upper bracket'],['lower','Lower bracket'],['grand','Gran final']].forEach(function(x){var b=brk(M,x[0]);if(b){any=true;if(x[1])tb.appendChild(el('div','gt',x[1]));tb.appendChild(b)}});
 if(!any)tb.appendChild(none('El fixture todavía no fue generado.'));
 put('ve-teams',T.teams.length?tbl(['#','Equipo'],T.teams.map(function(id,k){return[k+1,tn(id)]})):none('Sin equipos anotados.'));
 var vm=M.filter(function(m){return!m.bye&&m.team1&&m.team2}).sort(ssort);
 put('ve2',vm.length?tbl(['Fase','Fecha','Equipo 1','Resultado','Equipo 2','Mapa',''],vm.map(function(m){return[rname(m)].concat(mrow(m))})):none('Sin partidas.'))}
function fmtE(){var f=$('efmt').value,x=eeid?byId(events,eeid):null,lock=!!(x&&x.generated);$('eg').hidden=f!=='groups';$('ed').hidden=!(f==='rr'||f==='groups');
 ['efmt','ebo','efbo','egrp','eadv','edrr'].forEach(function(i){$(i).disabled=lock})}
function fillE(){var x=eeid?byId(events,eeid):null;if(!x)return;$('en').value=x.name||'';$('efmt').value=(x.format==='swiss'?'playoffs':x.format)||'playoffs';$('ebo').value=x.best_of||1;$('efbo').value=x.final_bo||1;
 $('egrp').value=x.group_count||2;$('eadv').value=x.advance||2;$('edrr').checked=!!x.double_rr;$('emin').value=x.min_teams||'';$('emax').value=x.max_teams||'';
 $('eprize').value=x.prize||'';$('es').value=x.starts_on||'';$('ee').value=x.ends_on||'';$('erules').value=x.rules||'';$('efh').textContent='Editar '+x.name;$('ecn').hidden=false;say('emsg','');say('ta_msg','');say('tp_msg','');fmtE()}
async function setSeeds(e,a){try{await ok(sb.from('events').update({seeds:a}).eq('id',e.id));await load();rEM()}catch(x){say('tp_msg','Error: '+x.message)}}
function mv(e,k,d){var a=parts(e),j=k+d;if(j<0||j>=a.length)return;var x=a[k];a[k]=a[j];a[j]=x;setSeeds(e,a)}
function rEM(){var e=selE?byId(events,selE):null;$('egm').hidden=!e;if(!e)return;var gen=!!e.generated,M=tms(e.id),P=parts(e);$('egh').textContent='Fixture: '+e.name;
 opts('tp_sel',teams.filter(function(x){return P.indexOf(x.id)<0}),function(x){return x.name});$('tp_add').disabled=gen;$('tp_shuf').disabled=gen;
 var pl=$('tp_list');pl.textContent='';if(!P.length)pl.appendChild(none('Sin equipos. Se anotan solos o los agregás vos, en orden de siembra (el primero es el cabeza de serie 1).'));
 P.forEach(function(id,k){var r=el('div','pl');r.appendChild(el('b',0,(k+1)+'. '+tn(id)));
  if(!gen){var up=btn('Subir',function(){mv(e,k,-1)}),dn=btn('Bajar',function(){mv(e,k,1)}),q=btn('Quitar',async function(){await sb.from('tournament_registrations').delete().match({event_id:e.id,team_id:id});setSeeds(e,P.filter(function(_,j){return j!==k}))});up.style.marginLeft='auto';r.appendChild(up);r.appendChild(dn);r.appendChild(q)}
  pl.appendChild(r)});
 $('ta_gen').disabled=gen;$('ta_reset').disabled=!gen;$('ta_play').hidden=e.format!=='groups';$('ta_play').disabled=!(e.format==='groups'&&gen&&!M.some(function(m){return m.stage==='ko'}));
 var ml=$('tm_list');ml.textContent='';var vm=M.filter(function(m){return!m.bye}).sort(ssort);if(!vm.length)ml.appendChild(none('Generá el fixture para ver las partidas.'));
 vm.forEach(function(m){var r=el('div','pl');r.appendChild(el('b',0,rname(m)+': '+(m.team1?tn(m.team1):'Por definir')+' vs '+(m.team2?tn(m.team2):'Por definir')));
  r.appendChild(el('span','msg',m.status==='upcoming'?'':sc(m)+' ('+m.status+')'));var b=btn('Resultado',function(){openRes(m)});b.disabled=!(m.team1&&m.team2);b.style.marginLeft='auto';r.appendChild(b);ml.appendChild(r)})}
function openRes(m,pre){curM=m;var bo=m.best_of||1;$('rdt').textContent=tn(m.team1)+' vs '+tn(m.team2)+' · BO'+bo;$('rst').value=m.status;$('rdate').value=m.starts_at?loc(m.starts_at):'';
 var c=$('rmaps');c.textContent='';var mp=pre||m.maps||[];
 for(var i=0;i<bo;i++){var x=mp[i]||{},row=el('div','g3'),a=el('input'),b=el('input'),d=el('input');a.setAttribute('list','mapsl');a.placeholder='Mapa '+(i+1);a.value=x.map||'';
  b.type='number';d.type='number';b.min=0;d.min=0;b.placeholder=tn(m.team1);d.placeholder=tn(m.team2);b.value=x.r1==null?'':x.r1;d.value=x.r2==null?'':x.r2;row.appendChild(a);row.appendChild(b);row.appendChild(d);c.appendChild(row)}
 say('rmsg','Cargá las rondas de cada mapa; el resultado de la serie se calcula solo.');$('rdl').showModal()}
async function finishE(eid,M){var e=byId(events,eid),c=champOf(tobj(e),M),st=c?'Finalizado':'En curso';if(c!==(e.champion||null)||st!==e.stage)await ok(sb.from('events').update({champion:c,stage:st}).eq('id',eid))}

function delEvent(x){return(async function(){try{await ok(sb.from('matches').delete().eq('event_id',x.id));await sb.from('tournament_registrations').delete().eq('event_id',x.id);await ok(sb.from('events').delete().eq('id',x.id));if(eeid===x.id)resetE();showToast('Torneo y partidas eliminados.');load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}})()}
function fillPUser(){var s=$('puser'),v=s.value;s.textContent='';var o=el('option',0,'Sin cuenta vinculada');o.value='';s.appendChild(o);accounts().sort(function(a,b){return tagOf(a).localeCompare(tagOf(b))}).forEach(function(id){var x=el('option',0,tagOf(id));x.value=id;s.appendChild(x)});s.value=v;selRefresh(s)}
var COUNTRIES=['Argentina','Bolivia','Brasil','Chile','Colombia','Costa Rica','Cuba','Ecuador','El Salvador','España','Estados Unidos','Guatemala','Honduras','México','Nicaragua','Panamá','Paraguay','Perú','Puerto Rico','República Dominicana','Uruguay','Venezuela','Otro'];
var ROLES=['AWPer','Rifler','IGL','Support','Entry fragger','Lurker','Otro'];
var PRIV={public:'Público',members:'Solo usuarios registrados',private:'Privado'};
function fillSel(id,list,blank){var s=$(id);if(s.children.length)return;var o=el('option',0,blank);o.value='';s.appendChild(o);list.forEach(function(x){var q=el('option',0,x);q.value=x;s.appendChild(q)})}
function dtd(x){return x?new Date(x).toLocaleDateString('es-AR'):'-'}
function avBox(box,url,name){box.textContent='';if(url){var im=el('img','csstv-av');im.src=url;im.alt=name||'';box.appendChild(im)}else box.appendChild(el('div','csstv-av',(name||'?')[0].toUpperCase()))}
// SteamID64 de una cuenta: 7656119 + 10 dígitos, o 765612 + 11 en las cuentas más nuevas.
var STEAM64=/^(7656119\d{10}|765612\d{11})$/;
var ProfileLinks=window.CSSTVProfileLinks;
var STEAM64=ProfileLinks.STEAM64;
var cleanSteam=ProfileLinks.cleanSteam,cleanFaceit=ProfileLinks.cleanFaceit,steamLink=ProfileLinks.steamLink,faceitLink=ProfileLinks.faceitLink;
function linkRow(box,k,v,f){if(!v)return;var d=el('div');d.appendChild(el('b',0,k+': '));var u=f(v);if(u){var a=el('a',0,v);a.href=u;a.target='_blank';a.rel='noopener noreferrer';d.appendChild(a)}else d.appendChild(document.createTextNode(v));box.appendChild(d)}
function prepAvatar(file){return new Promise(function(res,rej){
 if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){rej(new Error('La imagen tiene que ser JPG, PNG, WebP o GIF.'));return}
 if(file.size>5*1024*1024){rej(new Error('La imagen pesa más de 5 MB.'));return}
 var im=new Image(),u=URL.createObjectURL(file);
 im.onload=function(){var S=256,c=document.createElement('canvas'),x=c.getContext('2d'),w=im.width,h=im.height,m=Math.min(w,h);c.width=S;c.height=S;x.drawImage(im,(w-m)/2,(h-m)/2,m,m,0,0,S,S);URL.revokeObjectURL(u);c.toBlob(function(b){b?res(b):rej(new Error('No se pudo procesar la imagen.'))},'image/jpeg',0.88)};
 im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('No se pudo leer la imagen.'))};im.src=u})}
function adminRows(B,p){kv(B,'Victorias / derrotas',(p.wins==null?0:p.wins)+' / '+(p.losses==null?0:p.losses));kv(B,'Mapas jugados',p.maps==null?'-':String(p.maps));
 function blk(t,v){var d=el('div');d.appendChild(el('b',0,t+': '));var x=el('span',0,v);x.style.whiteSpace='pre-wrap';d.appendChild(x);B.appendChild(d)}
 blk('Historial de equipos',p.team_history||'Sin datos');
 var md=medals.filter(function(m){return m.player_id===p.id}).map(function(m){return(m.icon||'🏆')+' '+m.title});
 blk('Logros / palmarés',(md.length?md.join(' · '):'')+(p.achievements?(md.length?'\n':'')+p.achievements:'')||'Sin logros');
 blk('Biografía',p.bio||'Sin biografía');kv(B,'Privacidad del perfil',PRIV[p.privacy||'public']||'Público')}
function privBlock(p){if(admin||(me&&p.user_id===me))return null;if(p.privacy==='private')return'Este perfil es privado.';if(p.privacy==='members'&&!me)return'Iniciá sesión para ver este perfil.';return null}

async function touchSeen(tag){try{var pt=localStorage.getItem('pendingTag');
 if(pt&&!tag){var r=await sb.rpc('set_my_tag',{p_tag:pt});if(!r.error)localStorage.removeItem('pendingTag')}else if(pt)localStorage.removeItem('pendingTag');
 await sb.from('profile_details').upsert({user_id:me,last_seen:new Date().toISOString()})}catch(e){}}
function myPlayer(){return me?players.filter(function(p){return p.user_id===me})[0]:null}
async function rProfileView(){
 if(!me)return;fillSel('prof-country',COUNTRIES,'Sin especificar');fillSel('prof-role',ROLES,'Sin especificar');
 $('prof-email').value=meEmail;$('prof-tag').value=userProfiles[me]||'';
 var r=await sb.from('profile_details').select('*').eq('user_id',me).maybeSingle();profDet=r.data||{};var d=profDet;
 $('prof-real').value=d.real_name||'';$('prof-country').value=d.country||'';$('prof-role').value=d.game_role||'';$('prof-steam').value=d.steam||'';$('prof-faceit').value=d.faceit||'';$('prof-discord').value=d.discord||'';
 profAvatarBlob=null;$('prof-file').value='';avBox($('prof-av'),d.avatar_url,userProfiles[me]||meEmail);
 var pl=myPlayer(),tm=(pl?teams.filter(function(t){return(t.members||[]).indexOf(pl.id)!==-1})[0]:null)||teams.filter(function(t){return t.captain_id===me||t.owner_id===me})[0];
 var played=tm?matches.filter(function(m){return m.status==='finished'&&!m.bye&&!isOrph(m)&&(m.team1===tm.id||m.team2===tm.id)}).length:0;
 var A=$('prof-auto');A.textContent='';var joined=d.joined_at||meCreated;
 kv(A,'Fecha de registro',joined?dtd(joined):'-');kv(A,'Última conexión',d.last_seen?dt(d.last_seen):'Ahora');
 kv(A,'Equipo actual',tm?tm.name+(tm.tag?' ['+tm.tag+']':''):'Sin equipo');kv(A,'Partidas jugadas',String(played)+(tm?' (partidas terminadas de '+tm.name+')':''));
 kv(A,'Jugador vinculado',pl?pl.nick:'Ninguno (podés reclamar tu perfil desde la sección Jugadores)');
 var B=$('prof-admin');B.textContent='';
 if(!pl)B.appendChild(none('Cuando un admin vincule tu cuenta a un jugador, vas a ver acá tus estadísticas y datos.'));else adminRows(B,pl)}
$('prof-file').onchange=async function(){var f=this.files&&this.files[0];if(!f)return;try{profAvatarBlob=await prepAvatar(f);avBox($('prof-av'),URL.createObjectURL(profAvatarBlob),'')}catch(e){profAvatarBlob=null;showToast(e&&e.message||'Imagen no válida','error')}};
$('prof-save').onclick=async function(){if(!me)return;var tag=$('prof-tag').value.trim();
 if(tag.length<2||tag.length>24){showToast('El nickname debe tener entre 2 y 24 caracteres.','error');return}
 var real=$('prof-real').value.trim();if(real&&!/^[\p{L}\p{M}' .\-]{1,60}$/u.test(real)){showToast('El nombre real solo puede tener letras, espacios, punto, apóstrofe y guion.','error');return}
 var steam=cleanSteam($('prof-steam').value);if(steam===null){showToast('Steam: usá tu SteamID64 (17 dígitos), el link de tu perfil o tu nombre de perfil.','error');return}
 var fc=cleanFaceit($('prof-faceit').value);if(fc===null){showToast('FACEIT: usá tu nickname o el link de tu perfil.','error');return}
 var dc=$('prof-discord').value.trim();if(dc&&!/^[A-Za-z0-9_.#\-]{2,40}$/.test(dc)){showToast('Discord: usá tu nombre de usuario, sin espacios.','error');return}
 try{if(tag!==(userProfiles[me]||''))await ok(sb.rpc('set_my_tag',{p_tag:tag}));
  var av=profDet&&profDet.avatar_url||null;
  if(profAvatarBlob){var path=me+'/'+Date.now()+'.jpg';await ok(sb.storage.from('avatars').upload(path,profAvatarBlob,{contentType:'image/jpeg'}));av=sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}
  await ok(sb.from('profile_details').upsert({user_id:me,avatar_url:av,real_name:real||null,country:$('prof-country').value||null,game_role:$('prof-role').value||null,steam:steam||null,faceit:fc||null,discord:dc||null,updated_at:new Date().toISOString()}));
  pdCache={};showToast('¡Perfil actualizado con éxito!');load();rProfileView()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}};

var ppTab='info',pdCache={};
var FLAG={'Argentina':'ar','Bolivia':'bo','Brasil':'br','Chile':'cl','Colombia':'co','Costa Rica':'cr','Cuba':'cu','Ecuador':'ec','El Salvador':'sv','España':'es','Estados Unidos':'us','Guatemala':'gt','Honduras':'hn','México':'mx','Nicaragua':'ni','Panamá':'pa','Paraguay':'py','Perú':'pe','Puerto Rico':'pr','República Dominicana':'do','Uruguay':'uy','Venezuela':'ve'};
function ppTeam(p){var t=teams.filter(function(x){return(x.members||[]).indexOf(p.id)!==-1})[0];if(!t&&p.user_id)t=teams.filter(function(x){return x.captain_id===p.user_id||x.owner_id===p.user_id})[0];return t||null}
function winOf(m){return m.winner||(m.score1>m.score2?m.team1:m.score2>m.score1?m.team2:null)}
function ppAll(p,t){var o=ppMatches(t).map(function(m){return{m:m,t:t}});
 mstats.forEach(function(s){if(s.player_id!==p.id)return;var m=byId(matches,s.match_id);if(!m||m.status!=='finished')return;o.push({m:m,t:{id:s.team===1?m.team1:m.team2},s:s})});
 var dd=function(x){var d=mdate(x.m);return d?+new Date(d):0};
 return o.filter(function(x){return x.m.status!=='finished'}).concat(o.filter(function(x){return x.m.status==='finished'}).sort(function(a,b){return dd(b)-dd(a)}))}
function ppMatches(t){if(!t)return[];var l=matches.filter(function(m){return!m.bye&&!isOrph(m)&&isOfficial(m)&&m.team1&&m.team2&&(m.team1===t.id||m.team2===t.id)});
 var dd=function(m){return m.starts_at?+new Date(m.starts_at):0};
 var up=l.filter(function(m){return m.status!=='finished'}).sort(function(a,b){return(dd(a)||9e15)-(dd(b)||9e15)}),fin=l.filter(function(m){return m.status==='finished'}).sort(function(a,b){return dd(b)-dd(a)});
 return up.concat(fin)}
function groupMedals(pid){var g={},o=[];medals.filter(function(m){return m.player_id===pid}).forEach(function(m){var k=(m.icon||'🏆')+'|'+m.title;if(!g[k]){g[k]={icon:m.icon||'🏆',title:m.title,n:0};o.push(g[k])}g[k].n++});return o}
function ppOpp(m,t){return m.team1===t.id?m.team2:m.team1}
function ppScore(m,t){return m.team1===t.id?m.score1+' : '+m.score2:m.score2+' : '+m.score1}
function ppSub(m){if(m.kind==='mix')return'Mix · '+(m.map||'mapa sin dato');var e=byId(events,m.event_id);return e&&m.stage?e.name+' · '+rname(m):(e?e.name:'Partida amistosa')}
function socLink(box,label,val,f){if(!val)return;var u=f(val),n;if(u){n=el('a',0,label);n.href=u;n.target='_blank';n.rel='noopener noreferrer'}else n=el('span',0,label+': '+val);box.appendChild(n)}
function ppBar(label,v,max,txt){var b=el('div','pp-stat'),t=el('div','t');t.appendChild(el('span',0,label));t.appendChild(el('b',0,txt));b.appendChild(t);
 var tr=el('div','pp-bar'),i=el('i');i.style.width=(v==null?0:Math.max(0,Math.min(100,v/max*100)))+'%';tr.appendChild(i);b.appendChild(tr);return b}
function ppHero(p,d,t,blk){var h=$('pp-hero');h.textContent='';var ph=el('div','pp-photo'),img=p.photo_url||(d&&d.avatar_url);
 if(img){var im=el('img');im.src=img;im.alt=p.nick;ph.appendChild(im)}else ph.appendChild(el('div','ph',(p.nick||'?')[0].toUpperCase()));h.appendChild(ph);
 var inf=el('div','pp-info'),hd=el('div','pp-head'),L=el('div'),nm=el('h2','pp-name');
 if(d&&d.country&&FLAG[d.country]){var fl=el('img');fl.src='https://flagcdn.com/24x18/'+FLAG[d.country]+'.png';fl.alt=d.country;fl.width=24;fl.height=18;fl.onerror=function(){fl.remove()};nm.appendChild(fl)}
 nm.appendChild(document.createTextNode(p.nick));L.appendChild(nm);if(d&&d.real_name)L.appendChild(el('div','pp-real',d.real_name));hd.appendChild(L);
 var soc=el('div','pp-soc');if(d){socLink(soc,'Steam',d.steam,steamLink);socLink(soc,'FACEIT',d.faceit,faceitLink);if(d.discord)soc.appendChild(el('span',0,'Discord: '+d.discord))}hd.appendChild(soc);inf.appendChild(hd);
 function row(k,v){var r=el('div','pp-row');r.appendChild(el('span',0,k));var s2=el('span');if(v&&v.nodeType)s2.appendChild(v);else s2.textContent=v;r.appendChild(s2);inf.appendChild(r)}
 row('Equipo actual',t?t.name+(t.tag?' ['+t.tag+']':''):'Libre');
 if(blk){inf.appendChild(el('p','msg',blk));h.appendChild(inf);return}
 if(d&&d.game_role)row('Rol',d.game_role);if(d&&d.country)row('País',d.country);
 row('Victorias / derrotas',(p.wins==null?0:p.wins)+' / '+(p.losses==null?0:p.losses));
 var er=eloRow(p),ev=eloOf(p),eb=el('span','nb');eb.appendChild(lvlBadge(ev));eb.appendChild(el('b',0,String(ev)));
 if(er)eb.appendChild(el('span','pp-cap','máx. '+er.peak_elo));row('ELO',eb);
 var g=groupMedals(p.id),bw=el('span');if(g.length)g.slice(0,3).forEach(function(x){bw.appendChild(el('span','pp-badge',x.n+' x '+x.title))});else bw.textContent='Sin logros';row('Logros',bw);
 var ft=[];if(d&&d.joined_at)ft.push('Miembro desde '+dtd(d.joined_at));if(d&&d.last_seen)ft.push('Última conexión '+dt(d.last_seen));if(ft.length)inf.appendChild(el('div','pp-real',ft.join(' · ')));
 var myReq=profileReqs.filter(function(r){return r.player_id===p.id&&r.user_id===me})[0];
 if(!p.user_id&&me){
  if(!myReq){var cb=btn('Reclamar este perfil',async function(){if(!confirm('¿Estás seguro de solicitar el perfil de '+p.nick+'? Un administrador deberá aprobarlo.'))return;
    try{await ok(sb.from('profile_requests').insert({player_id:p.id,user_id:me,status:'pending'}));showToast('¡Solicitud enviada con éxito!');load()}catch(e){showToast('Error al solicitar: '+(e&&e.message||e),'error')}});cb.className='pri';cb.style.marginTop='10px';inf.appendChild(cb)}
  else if(myReq.status==='pending'){var pm=el('span','msg','⏳ Solicitud de reclamo pendiente de aprobación');pm.style.display='block';pm.style.marginTop='8px';inf.appendChild(pm)}}
 else if(p.user_id){var cm=el('span','msg',p.user_id===me?'✓ Este es tu perfil reclamado':'🔒 Perfil reclamado y verificado');cm.style.display='block';cm.style.marginTop='8px';inf.appendChild(cm)}
 h.appendChild(inf)}
function ppTabs(){var T=[['info','Info'],['teams','Equipos'],['matches','Partidas'],['ach','Logros'],['maps','Mapas']],bar=$('pp-tabs');bar.textContent='';
 T.forEach(function(x){var b=btn(x[1],function(){ppTab=x[0];ppApply()});b.setAttribute('role','tab');b.id='pp-t-'+x[0];bar.appendChild(b)});ppApply()}
function ppApply(){['info','teams','matches','ach','maps'].forEach(function(k){$('pp-'+k).hidden=k!==ppTab;var b=$('pp-t-'+k);if(b)b.className=k===ppTab?'on':''})}
function ppDraw(p,d,t){
 ppHero(p,d,t,null);
 var g=groupMedals(p.id),sw=$('pp-strip-w'),st=$('pp-strip');st.textContent='';sw.hidden=!g.length;
 g.forEach(function(x){var tl=el('div','pp-tile');tl.title=x.title;tl.appendChild(el('div','ic',x.icon));if(x.n>1)tl.appendChild(el('span','ct',x.n));tl.appendChild(el('small',0,x.title));st.appendChild(tl)});
 var sb2=$('pp-stats');sb2.textContent='';
 var nmix=mstats.filter(function(s){return s.player_id===p.id}).length;
 $('pp-src').textContent=nmix&&p.stats_auto!==false?'(automáticas · '+nmix+(nmix===1?' mix)':' mixes)'):'(cargadas por el admin)';
 var ev=eloOf(p),lv=lvlOf(ev),nx=LV[lv[0]];
 sb2.appendChild(nx?ppBar('Nivel '+lv[0]+' → '+nx[0],ev-lv[1],nx[1]-lv[1],'faltan '+(nx[1]-ev)+' ELO'):ppBar('Nivel 10',1,1,ev+' ELO'));
 sb2.appendChild(ppBar('Rating',p.rating,2,fm(p.rating,2)));sb2.appendChild(ppBar('K/D',p.kd,2,fm(p.kd,2)));sb2.appendChild(ppBar('Headshot %',p.hs,100,p.hs==null?'-':fm(p.hs,1)+'%'));sb2.appendChild(ppBar('ADR',p.adr,120,fm(p.adr,1)));
 var tot=(p.wins||0)+(p.losses||0);if(tot>0)sb2.appendChild(ppBar('Win rate',(p.wins||0)/tot*100,100,Math.round((p.wins||0)/tot*100)+'%'));
 sb2.appendChild(el('div','pp-cap','Mapas jugados: '+(p.maps!=null?p.maps:'-')));
 var rc=$('pp-recent');rc.textContent='';var ml=ppAll(p,t);
 if(!ml.length)rc.appendChild(none(t?'Todavía no hay partidas.':'El jugador no tiene equipo ni mixes.'));
 ml.slice(0,6).forEach(function(x){var m=x.m,tt=x.t,f=m.status==='finished',w=winOf(m),r=el('div','pp-m'+(f&&w?(w===tt.id?' w':' l'):'')),L=el('div');
  L.appendChild(el('span',0,'VS '+tn(ppOpp(m,tt))));L.appendChild(el('small',0,ppSub(m)+(x.s?' · '+x.s.kills+'-'+x.s.deaths+' · rating '+fm(x.s.rating,2)+(x.s.elo_delta!=null?' · ELO '+(x.s.elo_delta>0?'+':'')+x.s.elo_delta:''):'')));r.appendChild(L);
  r.appendChild(el('div','s',m.status==='upcoming'?(m.starts_at?dt(m.starts_at):'Por definir'):(m.status==='live'?'EN VIVO ':'')+ppScore(m,tt)));r.onclick=function(){openMatchDetail(m.id)};rc.appendChild(r)});
 var tp=$('pp-teams');tp.textContent='';tp.appendChild(el('h3',0,'Equipo actual'));tp.appendChild(el('div','pp-line',t?t.name+(t.tag?' ['+t.tag+']':''):'Libre'));
 tp.appendChild(el('h3',0,'Historial de equipos'));
 var hist=(p.team_history||'').split('\n').map(function(x){return x.trim()}).filter(Boolean);if(!hist.length)tp.appendChild(none('Sin historial cargado.'));hist.forEach(function(x){tp.appendChild(el('div','pp-line',x))});
 var mt=$('pp-matches');mt.textContent='';
 mt.appendChild(ml.length?tbl(['Fecha','Rival','Resultado','Mapas','Competencia','K-D','ELO'],ml.map(function(x){var m=x.m,tt=x.t,f=m.status==='finished',w=winOf(m);return[mdate(m)?dt(mdate(m)):'-',tn(ppOpp(m,tt)),el('span',f&&w?(w===tt.id?'w':null):null,m.status==='upcoming'?'vs':ppScore(m,tt)),(m.maps&&m.maps.length?m.maps.map(function(k){return k.map||'?'}).join(', '):(m.map||'')),ppSub(m),x.s?x.s.kills+'-'+x.s.deaths:'',x.s&&x.s.elo_delta!=null?eloDelta(x.s.elo_delta):'']})):none('Sin partidas.'));
 var ac=$('pp-ach');ac.textContent='';
 if(!g.length&&!p.achievements)ac.appendChild(none('Sin logros todavía.'));
 g.forEach(function(x){ac.appendChild(el('div','pp-line',x.icon+' '+x.title+(x.n>1?'  ×'+x.n:'')))});
 if(p.achievements){ac.appendChild(el('h3',0,'Palmarés'));ac.appendChild(el('div','pp-line',p.achievements))}
 if(p.bio){ac.appendChild(el('h3',0,'Biografía'));ac.appendChild(el('div','pp-line',p.bio))}
 var mp=$('pp-maps');mp.textContent='';var pm2=mapStats.filter(function(m){return m.player_id===p.id});
 var agg={};mstats.forEach(function(s){if(s.player_id!==p.id)return;var m=byId(matches,s.match_id);if(!m)return;var k=m.map||'?',a=agg[k]||(agg[k]={map:k,n:0,k:0,d:0,dmg:0,r:0,w:0});
  a.n++;a.k+=s.kills;a.d+=s.deaths;a.dmg+=s.damage;a.r+=s.rounds;if(m.winner&&m.winner===(s.team===1?m.team1:m.team2))a.w++});
 var al=Object.keys(agg).map(function(k){return agg[k]}).sort(function(a,b){return b.n-a.n});
 if(al.length){mp.appendChild(el('h3',0,'Mixes por mapa'));mp.appendChild(tbl(['Mapa','Mixes','Victorias','K/D','ADR'],al.map(function(a){return[a.map,a.n,a.w,fm(a.k/Math.max(a.d,1),2),a.r?fm(a.dmg/a.r,1):'-']})))}
 if(pm2.length){if(al.length)mp.appendChild(el('h3',0,'Cargadas por el admin'));mp.appendChild(tbl(['Mapa','Rating','K/D','Mapas'],pm2.map(function(x){return[x.map_name,fm(x.rating,2),fm(x.kd,2),x.maps!=null?x.maps:'-']})))}
 else if(!al.length)mp.appendChild(none('Sin estadísticas de mapas.'));
 ppTabs()}
function rProfile(){var p=byId(players,selPlayerId);if(!p)return;var t=ppTeam(p),blk=privBlock(p);
 var d=p.user_id&&!blk?(pdCache[p.user_id]||null):null;
 if(blk){ppHero(p,null,t,blk);$('pp-body').hidden=true;return}
 $('pp-body').hidden=false;ppDraw(p,d,t);
 if(p.user_id&&!(p.user_id in pdCache)){var uid2=p.user_id;
  sb.from('profile_details').select('*').eq('user_id',uid2).maybeSingle().then(function(r){pdCache[uid2]=r&&r.data?r.data:false;if(selPlayerId===p.id)ppDraw(p,pdCache[uid2]||null,t)})}}

var PG={};
function norm(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function pageNums(total,cur){var o=[],last=0;for(var i=0;i<total;i++){if(i===0||i===total-1||Math.abs(i-cur)<=1){if(i-last>1)o.push(null);o.push(i);last=i}}return o}
function pager(box,key,items,rowFn,o){o=o||{};var st=PG[key]||(PG[key]={page:0,per:o.per||10,q:''});
 if(!box._pg||!box.children.length){box.textContent='';var bar=el('div','pg-bar'),list=el('div','pg-list'),nav=el('div','pg-nav');
  if(o.search!==false){var inp=el('input');inp.type='search';inp.placeholder=o.ph||'Buscar...';inp.value=st.q;inp.setAttribute('aria-label','Buscar');inp.oninput=function(){st.q=inp.value;st.page=0;box._redraw()};bar.appendChild(inp)}
  var sel=el('select');sel.setAttribute('aria-label','Elementos por página');[10,15,25].forEach(function(n){var op=el('option',0,n+' por página');op.value=String(n);sel.appendChild(op)});sel.value=String(st.per);sel.onchange=function(){st.per=+sel.value;st.page=0;box._redraw()};bar.appendChild(sel);
  box.appendChild(bar);box.appendChild(list);box.appendChild(nav);box._pg={list:list,nav:nav}}
 box._items=items;box._rowFn=rowFn;box._o=o;
 box._redraw=function(){var st2=PG[key],it=box._items,q=norm(st2.q),tf=box._o.text,f=(q&&tf)?it.filter(function(x){return norm(tf(x)).indexOf(q)!==-1}):it,pages=Math.max(1,Math.ceil(f.length/st2.per));
  if(st2.page>=pages)st2.page=pages-1;if(st2.page<0)st2.page=0;
  var L=box._pg.list,N=box._pg.nav;L.textContent='';N.textContent='';
  if(!f.length)L.appendChild(none(q?'Nada coincide con la búsqueda.':(box._o.empty||'Sin elementos.')));
  var pg=f.slice(st2.page*st2.per,(st2.page+1)*st2.per);
  if(box._o.head){if(pg.length)L.appendChild(tbl(box._o.head,pg.map(box._rowFn)))}else pg.forEach(function(x){var r=box._rowFn(x);if(r)L.appendChild(r)});
  if(f.length)N.appendChild(el('div','pg-info','Mostrando '+(st2.page*st2.per+1)+'–'+Math.min(f.length,(st2.page+1)*st2.per)+' de '+f.length+(f.length!==it.length?' (filtrados de '+it.length+')':'')));
  if(pages>1){var tabs=el('div','pp-tabs pg-tabs');
   var pb=function(txt,pgn,dis,on){var b=btn(txt,function(){st2.page=pgn;box._redraw()});if(dis)b.disabled=true;if(on)b.className='on';tabs.appendChild(b)};
   pb('‹',st2.page-1,st2.page===0);
   pageNums(pages,st2.page).forEach(function(n){if(n===null)tabs.appendChild(el('span','pg-gap','…'));else pb(String(n+1),n,false,n===st2.page)});
   pb('›',st2.page+1,st2.page===pages-1);N.appendChild(tabs)}};
 box._redraw()}

function myCapTeams(){return me?teams.filter(function(t){return t.captain_id===me}):[]}
function myTeamIds(){if(!me)return[];var pl=myPlayer(),ids={};teams.forEach(function(t){if(t.captain_id===me||t.owner_id===me||(pl&&(t.members||[]).indexOf(pl.id)!==-1))ids[t.id]=1});return Object.keys(ids)}
function reportsOf(mid){return reports.filter(function(r){return r.match_id===mid})}
function normMaps(a){return JSON.stringify((a||[]).map(function(x){return[String(x.map||'').trim().toLowerCase(),+x.r1,+x.r2]}))}
function serOf(maps){var a=0,b=0;(maps||[]).forEach(function(x){if(+x.r1>+x.r2)a++;else if(+x.r2>+x.r1)b++});return[a,b]}
function repState(m){if(m.status==='finished')return'finished';var rs=reportsOf(m.id);if(!rs.length)return'none';if(rs.length<2)return'one';return normMaps(rs[0].maps)===normMaps(rs[1].maps)?'agreed':'disputed'}
function myMatchTeams(m){return[m.team1,m.team2].filter(function(t){return t&&isCap(t)})}
function vetoMaps(m){var seq=vetoSeq(m.best_of||1,VPOOL.length),vs=vlist(m.id);if(vs.length<seq.length)return[];var used={};vs.forEach(function(v){used[v.map]=1});
 var order=vs.filter(function(v){return v.action==='pick'}).map(function(v){return v.map}),rest=VPOOL.filter(function(x){return!used[x]});if(rest.length===1)order.push(rest[0]);return order}
function prepProof(file){return new Promise(function(res,rej){
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)){rej(new Error('Las capturas tienen que ser JPG, PNG o WebP.'));return}
 if(file.size>8*1024*1024){rej(new Error('Una captura pesa más de 8 MB.'));return}
 var im=new Image(),u=URL.createObjectURL(file);
 im.onload=function(){var k=Math.min(1,1280/im.width),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(function(b){b?res(b):rej(new Error('No se pudo procesar la captura.'))},'image/jpeg',0.82)};
 im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('No se pudo leer la captura.'))};im.src=u})}
async function adminApply(m,mp){var M=(m.event_id&&m.stage?tms(m.event_id):[m]).map(function(x){return Object.assign({},x)}),r=applyRes(M,m.id,'finished',mp,m.starts_at||null);
 if(r.err)throw new Error(r.err);
 M.forEach(function(x){if(x.id===m.id)x.map=mp.map(function(k){return k.map}).filter(Boolean).join(', ')||null});
 await ok(sb.from('matches').upsert(M.filter(function(x){return r.ch[x.id]})));if(m.event_id&&m.stage)await finishE(m.event_id,M);await load()}
async function sendReport(m,team,rows,lineup,files,note,existing){
 var maps=[];rows.forEach(function(r){var a=r.a.value.trim(),b=String(r.b.value).trim(),c=String(r.c.value).trim();if(!a&&!b&&!c)return;
  if(!a||b===''||c==='')throw new Error('Completá el mapa y las rondas de los dos equipos en cada fila que uses.');
  if(!/^\d{1,2}$/.test(b)||!/^\d{1,2}$/.test(c))throw new Error('Las rondas son números de 0 a 99.');maps.push({map:a,r1:+b,r2:+c})});
 if(!maps.length)throw new Error('Cargá al menos un mapa.');
 var ser=serOf(maps);if(ser[0]===ser[1])throw new Error('La serie no puede quedar empatada.');
 if(members(tget(team)).length&&!lineup.length)throw new Error('Marcá los jugadores que jugaron.');
 if(lineup.length>7)throw new Error('La alineación puede tener hasta 7 jugadores.');
 var proof=existing&&existing.proof?existing.proof.slice():[];
 if(files.length){proof=[];for(var i=0;i<files.length;i++){var blob=await prepProof(files[i]),path=m.id+'/'+me+'-'+Date.now()+'-'+i+'.jpg';
  await ok(sb.storage.from('proofs').upload(path,blob,{contentType:'image/jpeg'}));proof.push(sb.storage.from('proofs').getPublicUrl(path).data.publicUrl)}}
 await ok(sb.from('result_reports').upsert({match_id:m.id,team_id:team,by_user:me,maps:maps,lineup:lineup,proof:proof,note:note||null},{onConflict:'match_id,team_id'}))}
function repCard(m,r){var d=el('div','pp-m');d.style.cursor='default';d.style.display='block';
 d.appendChild(el('b',0,'Reporte de '+tn(r.team_id)+' · '+tagOf(r.by_user)));var ser=serOf(r.maps);
 d.appendChild(el('div','msg','Serie: '+tn(m.team1)+' '+ser[0]+' - '+ser[1]+' '+tn(m.team2)));
 d.appendChild(tbl(['Mapa',tn(m.team1),tn(m.team2)],(r.maps||[]).map(function(x){return[x.map||'-',x.r1,x.r2]})));
 var lu=(r.lineup||[]).map(function(id){var p=byId(players,id);return p?p.nick:'?'});d.appendChild(el('div','msg','Alineación: '+(lu.length?lu.join(', '):'sin datos')));
 if(r.note)d.appendChild(el('div','msg','Nota: '+r.note));
 if((r.proof||[]).length){var g=el('div');g.style.display='flex';g.style.gap='8px';g.style.flexWrap='wrap';g.style.marginTop='6px';
  r.proof.forEach(function(u){if(!/^https:\/\//.test(u))return;var a=el('a');a.href=u;a.target='_blank';a.rel='noopener noreferrer';var im=el('img','rp-img');im.src=u;im.alt='Captura del resultado';a.appendChild(im);g.appendChild(a)});d.appendChild(g)}
 return d}
function repForm(m,mt,rs){var f=el('div','fm');f.style.padding='0';var bo=m.best_of||1,selT=null;
 if(mt.length>1){selT=el('select');selT.setAttribute('aria-label','Equipo que reporta');selT.setAttribute('data-k','team');mt.forEach(function(t){var o=el('option',0,tn(t));o.value=t;selT.appendChild(o)});f.appendChild(selT)}
 var body=el('div','fm');body.style.padding='0';f.appendChild(body);
 function draw(){var team=(selT&&selT.value)||mt[0];body.textContent='';
  var mine=rs.filter(function(r){return r.team_id===team})[0],other=rs.filter(function(r){return r.team_id!==team})[0],conf=!mine&&!!other,base=mine?mine.maps:(other?other.maps:null),vm=vetoMaps(m);
  body.appendChild(el('b',0,conf?'Confirmar el resultado que cargó '+tn(other.team_id):(mine?'Editar mi reporte ('+tn(team)+')':'Cargar el resultado ('+tn(team)+')')));
  var live=el('div','msg',''),rows=[];
  var liveUpd=function(){var mp=[];rows.forEach(function(r){if(r.b.value!==''&&r.c.value!=='')mp.push({r1:+r.b.value,r2:+r.c.value})});var s2=serOf(mp);live.textContent=mp.length?'Serie: '+tn(m.team1)+' '+s2[0]+' - '+s2[1]+' '+tn(m.team2):''};
  for(var i=0;i<bo;i++){var x=(base&&base[i])||{},row=el('div','g3'),a=el('input'),b=el('input'),c=el('input');
   a.setAttribute('list','mapsl');a.placeholder='Mapa '+(i+1);a.value=x.map||(!base&&vm[i])||'';a.setAttribute('data-k','map'+i);
   b.type='number';c.type='number';b.min=0;c.min=0;b.max=99;c.max=99;b.placeholder=tn(m.team1);c.placeholder=tn(m.team2);b.value=x.r1==null?'':x.r1;c.value=x.r2==null?'':x.r2;
   b.setAttribute('data-k','r1_'+i);c.setAttribute('data-k','r2_'+i);b.oninput=liveUpd;c.oninput=liveUpd;row.appendChild(a);row.appendChild(b);row.appendChild(c);body.appendChild(row);rows.push({a:a,b:b,c:c})}
  body.appendChild(live);
  var tm0=tget(team),roster=members(tm0),checks=[];
  if(m.kind==='pcw'){body.appendChild(el('b',0,'Roster de '+tn(team)));body.appendChild(el('div','msg',rosterText(tm0)||'Sin jugadores'))}
  else{body.appendChild(el('b',0,'Jugadores que jugaron ('+tn(team)+')'));
  if(!roster.length)body.appendChild(none('Tu equipo no tiene jugadores cargados. Pedile al admin que arme el plantel.'));
  roster.forEach(function(p){var lb=el('label','chk'),ck=el('input');ck.type='checkbox';ck.value=p.id;ck.setAttribute('data-k','lu');ck.checked=!!(mine&&(mine.lineup||[]).indexOf(p.id)>-1);lb.appendChild(ck);lb.appendChild(el('span',0,p.nick));body.appendChild(lb);checks.push(ck)});}
  body.appendChild(el('b',0,'Capturas del resultado (hasta 3)'));var fi=el('input');fi.type='file';fi.accept='image/png,image/jpeg,image/webp';fi.multiple=true;fi.setAttribute('data-k','file');body.appendChild(fi);
  if(mine&&(mine.proof||[]).length)body.appendChild(el('div','msg','Ya subiste '+mine.proof.length+' captura(s). Si elegís archivos nuevos, reemplazan a las anteriores.'));
  var nt=el('textarea');nt.rows=2;nt.maxLength=300;nt.placeholder='Nota (opcional)';nt.value=mine&&mine.note||'';nt.setAttribute('data-k','note');body.appendChild(nt);
  var msg=el('span','msg','');msg.style.padding='0';
  var go=btn(conf?'Confirmar resultado':'Enviar mi reporte',async function(){
   try{go.disabled=true;msg.textContent='Enviando...';
    await sendReport(m,team,rows,(m.kind==='pcw'?((tget(team)||{}).members||[]):checks.filter(function(q){return q.checked}).map(function(q){return q.value})),[].slice.call(fi.files||[],0,3),nt.value.trim(),mine);
    showToast(conf?'Resultado confirmado.':'Reporte enviado.');await load()}catch(e){msg.textContent=(e&&e.message)||'Error';go.disabled=false}});
  go.className='pri';body.appendChild(go);
  if(mine)body.appendChild(btn('Retirar mi reporte',async function(){if(!confirm('¿Retirar tu reporte?'))return;try{await ok(sb.from('result_reports').delete().eq('id',mine.id));showToast('Reporte retirado.');load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}}));
  body.appendChild(msg);liveUpd()}
 if(selT)selT.onchange=draw;draw();return f}
function rResult(m){var box=$('md-result');box.textContent='';var wrap=el('div','veto-box'),st=repState(m),rs=reportsOf(m.id);
 var msgs={none:'Todavía no hay un resultado cargado.',finished:'Resultado final: '+tn(m.team1)+' '+sc(m)+' '+tn(m.team2),agreed:'Los dos capitanes coinciden. '+(m.kind==='pcw'?'':'Falta la aprobación de un admin.'),disputed:'Los capitanes no coinciden. Un admin va a definir el resultado.'},info=msgs[st];
 if(st==='one'){var r0=rs[0];info=tn(r0.team_id)+' cargó un resultado. Falta que el capitán de '+tn(r0.team_id===m.team1?m.team2:m.team1)+' lo confirme.'}
 wrap.appendChild(el('p','msg',info));
 if(st==='finished'&&m.maps&&m.maps.length&&!rs.length)wrap.appendChild(tbl(['Mapa',tn(m.team1),tn(m.team2)],m.maps.map(function(x){return[x.map||'-',x.r1,x.r2]})));
 rs.forEach(function(r){wrap.appendChild(repCard(m,r))});
 var mt=myMatchTeams(m);if(m.status!=='finished'&&m.team1&&m.team2&&mt.length)wrap.appendChild(repForm(m,mt,rs));
 if(admin&&m.team1&&m.team2){var ab=el('div');ab.style.display='flex';ab.style.gap='8px';ab.style.flexWrap='wrap';
  if(m.status!=='finished')rs.forEach(function(r){var b=btn('Aprobar reporte de '+tn(r.team_id),async function(){if(!confirm('¿Dar por válido el resultado que cargó '+tn(r.team_id)+'?'))return;try{await adminApply(m,r.maps);showToast('Resultado aprobado.')}catch(e){showToast('Error: '+(e&&e.message||e),'error')}});if(st==='agreed')b.className='pri';ab.appendChild(b)});
  ab.appendChild(btn(m.status==='finished'?'Corregir resultado (admin)':'Cargar o forzar resultado (admin)',function(){openRes(m,rs[0]?rs[0].maps:null)}));wrap.appendChild(ab)}
 box.appendChild(wrap)}
function rPend(){var box=$('pend-list');if(!box)return;box.textContent='';var ids={};reports.forEach(function(r){ids[r.match_id]=1});
 var l=matches.filter(function(m){return ids[m.id]&&m.status!=='finished'});if(!l.length){box.appendChild(none('No hay resultados pendientes.'));return}
 l.forEach(function(m){var st=repState(m),lab={one:'Falta que confirme el otro capitán',agreed:'Los capitanes coinciden: listo para aprobar',disputed:'Disputa: hay que definir el resultado'}[st]||'',r=el('div','pl');
  r.appendChild(el('b',0,(m.kind==='pcw'?'[PCW] ':'')+tn(m.team1)+' vs '+tn(m.team2)));r.appendChild(el('span','msg',lab));
  var b=btn('Revisar',function(){openMatchDetail(m.id)});b.style.marginLeft='auto';r.appendChild(b);
  if(st==='agreed'){var ap=btn('Aprobar',async function(){try{await adminApply(m,reportsOf(m.id)[0].maps);showToast('Resultado aprobado.')}catch(e){showToast('Error: '+(e&&e.message||e),'error')}});ap.className='pri';r.appendChild(ap)}
  box.appendChild(r)})}



function drawPicker(){var sel=$('pk-sel');sel.textContent='';var chosen=players.filter(function(p){return chk[p.id]});
 sel.appendChild(el('div','pg-info','Plantel: '+chosen.length+' jugador(es)'));
 if(!chosen.length)sel.appendChild(none('Todavía no agregaste jugadores.'));
 chosen.forEach(function(p){var r=el('div','pl');r.appendChild(av(p));r.appendChild(el('b',0,p.nick));var x=btn('Quitar',function(){delete chk[p.id];drawPicker()});x.style.marginLeft='auto';r.appendChild(x);sel.appendChild(r)});
 var used={};teams.forEach(function(t){if(t.id!==et)(t.members||[]).forEach(function(id){used[id]=1})});
 var avail=players.filter(function(p){return!chk[p.id]&&!used[p.id]});
 pager($('pk2'),'team-picker',avail,function(p){var r=el('div','pl');r.appendChild(av(p));r.appendChild(el('b',0,p.nick));if(p.rating!=null)r.appendChild(el('span','msg',fm(p.rating,2)));
  var x=btn('Agregar',function(){chk[p.id]=1;drawPicker()});x.style.marginLeft='auto';r.appendChild(x);return r},{text:function(p){return p.nick},ph:'Buscar jugador para agregar...',empty:'No hay más jugadores disponibles (los que ya están en otros equipos no se muestran).'})}
function selApply(s){var v=s.value,q=norm(s._q||'');s.textContent='';(s._all||[]).forEach(function(p){if(!q||norm(p[1]).indexOf(q)>-1||p[0]===v){var o=el('option',0,p[1]);o.value=p[0];s.appendChild(o)}});s.value=v}
function selRefresh(s){s._all=Array.prototype.map.call(s.options,function(o){return[o.value,o.textContent]});if(s._q)selApply(s)}
function enhanceSelect(id,ph){var s=$(id);if(!s||s._enh)return;s._enh=true;var inp=el('input');inp.type='search';inp.placeholder=ph||'Buscar...';inp.setAttribute('aria-label','Buscar en la lista');inp.oninput=function(){s._q=inp.value;selApply(s)};s.parentNode.insertBefore(inp,s)}

var pcwSt={ids:{},guests:[]},accSt={ids:{},guests:[]},accPost=null;
function tget(id){return byId(teams,id)||byId(pcwTeams,id)}
function rosterText(t){if(!t)return'';return members(t).map(function(p){return p.nick}).concat(t.guests||[]).join(', ')}
function iAmSide(id){var t=tget(id);if(!t||!me)return false;var pl=myPlayer();return t.captain_id===me||t.owner_id===me||!!(pl&&(t.members||[]).indexOf(pl.id)>-1)}
function rosterPicker(box,key,st,o){o=o||{};box.textContent='';
 var head=el('div','pg-info'),chosen=el('div'),listBox=el('div'),total=function(){return Object.keys(st.ids).length+st.guests.length};
 function refresh(){head.textContent='Roster: '+total()+' / 7 (recomendado 5)';chosen.textContent='';
  Object.keys(st.ids).forEach(function(id){var p=byId(players,id);if(!p)return;var r=el('div','pl');r.appendChild(av(p));r.appendChild(el('b',0,p.nick));var x=btn('Quitar',function(){delete st.ids[id];refresh()});x.style.marginLeft='auto';r.appendChild(x);chosen.appendChild(r)});
  st.guests.forEach(function(g,i){var r=el('div','pl');r.appendChild(el('div','av','?'));r.appendChild(el('b',0,g));r.appendChild(el('span','msg','(sin perfil)'));var x=btn('Quitar',function(){st.guests.splice(i,1);refresh()});x.style.marginLeft='auto';r.appendChild(x);chosen.appendChild(r)});
  var avail=players.filter(function(p){return!st.ids[p.id]});
  pager(listBox,key,avail,function(p){var r=el('div','pl');r.appendChild(av(p));r.appendChild(el('b',0,p.nick));var x=btn('Agregar',function(){if(total()>=7){showToast('El roster puede tener hasta 7 jugadores.','error');return}st.ids[p.id]=1;refresh()});x.style.marginLeft='auto';r.appendChild(x);return r},
   {text:function(p){return p.nick},ph:'Buscar jugador de la lista...',empty:'No hay más jugadores en la lista.'})}
 box.appendChild(head);box.appendChild(chosen);
 if(o.myTeams&&o.myTeams.length){var fr=el('div','g2'),fs=el('select');fs.setAttribute('aria-label','Cargar el plantel de mi equipo');o.myTeams.forEach(function(t){var op=el('option',0,'Plantel de '+t.name);op.value=t.id;fs.appendChild(op)});
  fr.appendChild(fs);fr.appendChild(btn('Cargar plantel',function(){var t=byId(teams,fs.value||o.myTeams[0].id);if(!t)return;st.ids={};st.guests=[];(t.members||[]).slice(0,7).forEach(function(id){st.ids[id]=1});if(o.onTeam)o.onTeam(t);refresh()}));box.appendChild(fr)}
 box.appendChild(el('b',0,'Agregar de la lista'));box.appendChild(listBox);
 box.appendChild(el('b',0,'¿No está en la lista? Escribí su tag'));
 var gr=el('div','g2'),gi=el('input');gi.maxLength=24;gi.placeholder='Tag (2 a 24 caracteres)';gi.setAttribute('data-k','guest');
 gr.appendChild(gi);gr.appendChild(btn('Agregar tag',function(){var g=gi.value.trim();
  if(g.length<2||g.length>24||/[<>]/.test(g)){showToast('El tag tiene que tener entre 2 y 24 caracteres, sin < ni >.','error');return}
  if(st.guests.some(function(x){return x.toLowerCase()===g.toLowerCase()})){showToast('Ese tag ya está en el roster.','error');return}
  if(total()>=7){showToast('El roster puede tener hasta 7 jugadores.','error');return}st.guests.push(g);gi.value='';refresh()}));box.appendChild(gr);refresh()}
function openAccept(p){accPost=p;accSt={ids:{},guests:[]};var tm=tget(p.team_id);
 $('pcwd-info').textContent='Rival: '+(tm?tm.name:'?')+' · BO'+p.best_of+' · Roster rival: '+(rosterText(tm)||'sin datos');$('pcwd-name').value='';$('pcwd-msg').textContent='';
 var myT=teams.filter(function(t){return t.captain_id===me||t.owner_id===me});
 rosterPicker($('pcwd-roster'),'pcw-acc-picker',accSt,{myTeams:myT,onTeam:function(t){$('pcwd-name').value=t.name.slice(0,24)}});$('pcwdlg').showModal()}
function rPcw(){var logged=!!me;$('pcw-form').hidden=!logged;var h=$('pcw-hint');h.hidden=logged;h.textContent='Iniciá sesión para publicar o aceptar prácticas.';
 if(logged){var myT=teams.filter(function(t){return t.captain_id===me||t.owner_id===me});rosterPicker($('pcw-roster'),'pcw-post-picker',pcwSt,{myTeams:myT,onTeam:function(t){$('pcw-name').value=t.name.slice(0,24)}})}
 var fresh=pcwPosts.filter(function(p){return p.status==='open'&&Date.now()-new Date(p.created_at)<7*864e5&&(!p.starts_at||new Date(p.starts_at)>Date.now()-72e5)}),ob=$('pcw-open');ob.textContent='';
 if(!fresh.length)ob.appendChild(none('No hay anuncios abiertos. ¡Publicá el tuyo!'));
 fresh.forEach(function(p){var tm=tget(p.team_id),r=el('div','pl'),L=el('div');L.appendChild(el('b',0,'BO'+p.best_of+' · '+(tm?tm.name:'?')+' · '+tagOf(p.by_user)));
  L.appendChild(el('div','msg','Roster: '+(rosterText(tm)||'sin datos')));
  L.appendChild(el('div','msg',(p.starts_at?dt(p.starts_at):'Fecha a convenir')+(p.maps?' · Mapas: '+p.maps:'')));if(p.note)L.appendChild(el('div','msg',p.note));r.appendChild(L);
  if(me&&p.by_user===me){var cb=btn('Cancelar anuncio',async function(){if(!confirm('¿Cancelar tu anuncio?'))return;try{await ok(sb.rpc('cancel_pcw_post',{p_post:p.id}));showToast('Anuncio cancelado.');load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}});cb.style.marginLeft='auto';r.appendChild(cb)}
  else if(me){var ab=btn('Aceptar',function(){openAccept(p)});ab.className='pri';ab.style.marginLeft='auto';r.appendChild(ab)}
  ob.appendChild(r)});
 var mb=$('pcw-mine');mb.textContent='';
 var mine=matches.filter(function(m){return m.kind==='pcw'&&(iAmSide(m.team1)||iAmSide(m.team2))}).sort(function(a,b){return(a.status==='finished'?1:0)-(b.status==='finished'?1:0)});
 if(!me)mb.appendChild(none('Iniciá sesión para ver tus prácticas.'));else if(!mine.length)mb.appendChild(none('Todavía no tenés prácticas.'));
 mine.slice(0,15).forEach(function(m){var r=el('div','pl'),st=repState(m);r.appendChild(el('b',0,tn(m.team1)+' vs '+tn(m.team2)));
  r.appendChild(el('span','msg','BO'+(m.best_of||1)+' · '+(m.status==='finished'?'Terminada '+sc(m):st==='none'?'Sin resultado':st==='one'?'Falta confirmación':st==='disputed'?'En disputa':'Listo')));
  var o2=btn('Abrir',function(){openMatchDetail(m.id)});o2.style.marginLeft='auto';r.appendChild(o2);
  if(m.status!=='finished'&&(isCap(m.team1)||isCap(m.team2)||admin))r.appendChild(btn('Cancelar',async function(){if(!confirm('¿Cancelar esta práctica?'))return;try{await ok(sb.rpc('cancel_pcw_match',{p_match:m.id}));showToast('Práctica cancelada.');load()}catch(e){showToast('Error: '+(e&&e.message||e),'error')}}));
  mb.appendChild(r)});
 put('pcw-recent',mtbl(matches.filter(function(m){return m.kind==='pcw'&&m.status==='finished'}).sort(byDate).reverse().slice(0,20),'Todavía no hay prácticas jugadas.'))}
$('pcw-post').onclick=async function(){if(!me)return;var ids=Object.keys(pcwSt.ids),gs=pcwSt.guests;
 if(ids.length+gs.length<1){say('pcw-msg','Armá tu roster: elegí jugadores de la lista o escribí sus tags.');return}
 var when=$('pcw-when').value?new Date($('pcw-when').value).toISOString():null;
 try{await ok(sb.rpc('create_pcw_post',{p_name:$('pcw-name').value.trim()||null,p_best_of:+$('pcw-bo').value,p_maps:$('pcw-maps').value.trim()||null,p_starts_at:when,p_note:$('pcw-note').value.trim()||null,p_players:ids,p_guests:gs}));
  pcwSt={ids:{},guests:[]};['pcw-name','pcw-maps','pcw-note','pcw-when'].forEach(function(i){$(i).value=''});say('pcw-msg','');showToast('¡Anuncio publicado!');await load()}
 catch(e){say('pcw-msg',(e&&e.message)||'Error')}};
$('pcwd-cl').onclick=function(){$('pcwdlg').close()};
$('pcwd-go').onclick=async function(){var p=accPost;if(!p)return;var ids=Object.keys(accSt.ids),gs=accSt.guests;
 if(ids.length+gs.length<1){$('pcwd-msg').textContent='Armá tu roster: elegí jugadores de la lista o escribí sus tags.';return}
 if(!confirm('¿Aceptar la práctica con ese roster?'))return;
 try{$('pcwd-go').disabled=true;var mid=await ok(sb.rpc('accept_pcw',{p_post:p.id,p_name:$('pcwd-name').value.trim()||null,p_players:ids,p_guests:gs}));
  $('pcwdlg').close();showToast('¡Práctica acordada!');await load();openMatchDetail(mid)}
 catch(e){$('pcwd-msg').textContent=(e&&e.message)||'Error'}finally{$('pcwd-go').disabled=false}};
function shown(id){var e=$(id);return!!e&&(!e.hidden||(typeof window!=='undefined'&&window.__renderAll===true))}
function render(){
 if(shown('teams')){rPub();rCap()}
 if(shown('home'))rHome();
 if(shown('matches')||shown('results')||shown('mixes')||shown('ranking')||shown('players')||shown('events'))rViews();
 if(shown('pcw'))rPcw();
 if(admin){if(shown('padm')||shown('vadm'))rPA();if(shown('tadm'))rTA();if(shown('cadm')){rC();rEM();rPend()}if(shown('sadm'))rSrv()}
 var md=byId(matches,selMatchId);if(md&&shown('match-detail')){rStats(md);if(md.kind!=='mix'){rVeto(md);rResult(md)}}}

var seenErr={};
var loadP=null,loadAgain=false;
function load(){if(loadP){loadAgain=true;return loadP}
 loadP=(async function(){try{await loadImpl();while(loadAgain){loadAgain=false;await loadImpl()}}finally{loadP=null}})();return loadP}
async function loadImpl(){try{
 var R=await CSSTVIndexData.loadSnapshot(sb,admin,me,function(label,error){if(!seenErr[label]){seenErr[label]=1;console.error(label,error);showToast('Error cargando '+label+': '+error.message+(error.code?' [código '+error.code+']':'')+(error.hint?' · '+error.hint:''),'error')}});
 eloBySteam={};(R[16]||[]).forEach(function(e){eloBySteam[e.steam_id]=e});
 if(R[17]&&R[17][0])eloCfg=R[17][0];
 var allT=R[0]||[];teams=allT.filter(function(t){return t.kind!=='pcw'&&t.kind!=='mix'});pcwTeams=allT.filter(function(t){return t.kind==='pcw'||t.kind==='mix'});
 mstats=R[14]||[];servers=R[15]||[];players=R[1]||[];matches=R[2];events=R[3];registrations=R[4];medals=R[5];mapStats=R[6];profileReqs=R[7];matchVetos=R[8];pcwPosts=R[9];reports=R[10];
 userProfiles={};if(R[11].data)R[11].data.forEach(function(pr){userProfiles[pr.id]=pr.tag});
 reqs=(R[12]||[]).map(function(x){x.id=x.user_id;return x});mine=R[13];
 say('tm',!me?'Iniciá sesión.':!mine?'':mine.status==='approved'?'Aprobado.':mine.status==='rejected'?'Rechazado.':'Pendiente.');
 handleRoute();
}catch(e){showToast('Error al cargar datos: '+e.message,'error')}}

async function setS(s){
 me=s&&s.user?s.user.id:null;
 meEmail=s&&s.user?s.user.email:'';
 admin=false;
 var userTag = '';
 if(me){
  var r=await sb.from('profiles').select('role, tag').eq('id',me).maybeSingle();
  if(r.data){ admin = (r.data.role==='admin'); userTag = r.data.tag || ''; }
 }
 say('ses',!me?'':(userTag ? userTag + ' - ' : '') + s.user.email+(admin?' (Admin)':''));$('ses').title=$('ses').textContent;meCreated=s&&s.user?s.user.created_at:null;if(me)touchSeen(userTag);
 $('lg').textContent=me?'Salir':'Ingresar';
 $('nav-profile').hidden=!me;
 document.querySelectorAll('.ad').forEach(function(a){a.hidden=!admin});
 if(!admin&&(!$('padm').hidden||!$('tadm').hidden||!$('cadm').hidden||!$('vadm').hidden||!$('sadm').hidden))show('home');load()
}

if(CFG.url.indexOf('TU_')===0){say('ses','Falta configurar Supabase');return}
if(typeof supabase==='undefined'){say('ses','Falta Supabase JS');return}
sb=supabase.createClient(CFG.url,CFG.key);
sb.auth.onAuthStateChange(function(_e,s){setTimeout(function(){setS(s)},0)});
$('lg').onclick=function(){if(me)sb.auth.signOut();else{say('dm','');$('dlg').showModal()}};
$('cl').onclick=function(){$('dlg').close()};
$('li').onclick=async function(){say('dm','...');
 try{var r=await sb.auth.signInWithPassword({email:$('em').value.trim(),password:$('pw').value});
  if(r.error)say('dm',r.error.message);else{$('dlg').close();showToast('¡Sesión iniciada con éxito!')}}catch(e){say('dm','Error')}};
$('su').onclick=async function(){say('dm','...');
 try{var tagVal=$('reg-tag').value.trim();if(tagVal.length<2||tagVal.length>24){say('dm','El tag debe tener entre 2 y 24 caracteres.');return}
  var r=await sb.auth.signUp({email:$('em').value.trim(),password:$('pw').value,options:{data:{tag:tagVal}}});
  if(r.error){say('dm',r.error.message)}
  else if(r.data&&r.data.user){
   if(r.data.session){try{await sb.rpc('set_my_tag',{p_tag:tagVal})}catch(x){}$('dlg').close();showToast('¡Registro exitoso!')}
   else{try{localStorage.setItem('pendingTag',tagVal)}catch(x){}say('dm','Revisá tu email para confirmar la cuenta.')}}
 }catch(e){say('dm','Error al registrarse')}};
$('ts').onclick=async function(){if(!me){$('dlg').showModal();return}var n=$('tn').value.trim();if(n.length<2){say('tm','Corto.');return}
 try{await ok(sb.from('team_requests').upsert({user_id:me,name:n,tag:$('tt').value.trim().toUpperCase(),status:'pending'}));load();showToast('Solicitud de equipo enviada.')}catch(e){showToast('Error: '+(e&&e.message||e),'error')}};
$('pa').onclick=async function(){var n=$('pn').value.trim(),f=$('pf').files[0];if(!n){say('pm','Nick requerido.');return}
 try{var old=ep?byId(players,ep):null,url=old?old.photo_url||null:null;
  if(f){var path='p'+Date.now().toString(36);await ok(sb.storage.from('photos').upload(path,f));url=sb.storage.from('photos').getPublicUrl(path).data.publicUrl}
  var d={nick:n,photo_url:url,rating:num($('pr').value),kd:num($('pk').value),hs:num($('ph').value),adr:num($('pd').value),maps:num($('pm2').value),wins:num($('pwin').value),losses:num($('ploss').value),team_history:$('phist').value.trim()||null,achievements:$('pach').value.trim()||null,bio:$('pbio').value.trim()||null,privacy:$('ppriv').value||'public',user_id:$('puser').value||null};
  var dup=d.user_id?players.filter(function(x){return x.user_id===d.user_id&&x.id!==ep})[0]:null;if(dup){showToast('Esa cuenta ya está vinculada al jugador '+dup.nick+'.','error');return}
  d.stats_auto=$('pauto').checked;
  var steam=$('psteam').value.trim(),prevSteam=old?old.steam_id||'':'';
  var res=await ok(ep?sb.from('players').update(d).eq('id',ep).select():sb.from('players').insert(d).select()),pid=ep||(res&&res[0]&&res[0].id);
  if(pid&&steam!==prevSteam){
   try{if(steam)await ok(sb.rpc('link_steam_id',{p_steam:steam,p_player:pid}));else await ok(sb.rpc('link_steam_id',{p_steam:prevSteam,p_player:null}))}
   catch(e2){resetP();load();showToast('Jugador guardado, pero el SteamID no: '+(e2&&e2.message||e2),'error');return}}
  resetP();load();showToast('Jugador guardado con éxito.')}catch(e){showToast('Error al guardar jugador: '+(e&&e.message||e),'error')}};

$('add-medal-btn').onclick=async function(){
 var pid=$('medal-player').value,title=$('medal-title').value.trim(),icon=$('medal-icon').value.trim()||'🏆';if(!pid||!title)return;
 try{await ok(sb.from('player_medals').insert({player_id:pid,title:title,icon:icon}));$('medal-title').value='';load();showToast('Medalla otorgada.')}catch(e){showToast('Error al otorgar medalla: '+(e&&e.message||e),'error')}
};

$('add-mapstat-btn').onclick=async function(){
 var pid=$('mapstat-player').value,mapName=$('mapstat-name').value.trim().toLowerCase();if(!pid||!mapName)return;
 try{await ok(sb.from('player_map_stats').insert({player_id:pid,map_name:mapName,rating:num($('mapstat-rating').value),kd:num($('mapstat-kd').value),maps:num($('mapstat-maps').value)}));$('mapstat-name').value='';load();showToast('Estadística de mapa guardada.')}catch(e){showToast('Error al guardar stat: '+(e&&e.message||e),'error')}
};

$('msv').onclick=async function(){var a=$('mt1').value,b=$('mt2').value;if(!a||!b||a===b){showToast('Elegí dos equipos distintos.','error');return}
 try{var d={team1:a,team2:b,map:$('mmap').value.trim(),server_ip:$('mserver').value.trim()||null,event_id:$('mev').value||null,status:$('mss').value,score1:num($('ms1').value),score2:num($('ms2').value),demo_url:$('mdem').value.trim()||null,video_url:$('mvid').value.trim()||null,starts_at:$('mst').value?new Date($('mst').value).toISOString():null};
  await ok(emid?sb.from('matches').update(d).eq('id',emid):sb.from('matches').insert(d));resetM();load();showToast('Partida guardada con éxito.')}catch(e){showToast('Error al guardar partida: '+(e&&e.message||e),'error')}
};
$('mcn').onclick=resetM;$('ecn').onclick=resetE;

$('efmt').onchange=fmtE;
$('ev').onclick=async function(){var n=$('en').value.trim();if(n.length<2){say('emsg','Poné un nombre.');return}
 var x=eeid?byId(events,eeid):null,d={name:n,min_teams:num($('emin').value),max_teams:num($('emax').value),prize:$('eprize').value.trim()||null,starts_on:$('es').value||null,ends_on:$('ee').value||null,rules:$('erules').value.trim()||null};
 if(!x||!x.generated){d.format=$('efmt').value;d.best_of=+$('ebo').value;d.final_bo=+$('efbo').value;d.group_count=num($('egrp').value)||2;d.advance=num($('eadv').value)||2;d.double_rr=$('edrr').checked}
 if(!x)d.stage='Inscripciones';
 try{var r=await ok(eeid?sb.from('events').update(d).eq('id',eeid):sb.from('events').insert(d).select());if(!eeid&&r&&r[0]){eeid=r[0].id;selE=eeid}
  await load();fillE();rEM();showToast('Torneo guardado con éxito.')}catch(err){say('emsg','Error: '+err.message)}};
$('tp_add').onclick=function(){var e=byId(events,selE),v=$('tp_sel').value;if(!e||!v||e.generated)return;setSeeds(e,parts(e).concat([v]))};
$('tp_shuf').onclick=function(){var e=byId(events,selE);if(!e||e.generated)return;var a=parts(e);for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x}setSeeds(e,a)};
$('ta_gen').onclick=async function(){var e=byId(events,selE);if(!e||e.generated)return;var T=tobj(e),n=T.teams.length,f=T.format,er=null,M;
 if(e.format==='swiss')er='El formato Suizo no tiene fixture automático. Elegí otro formato.';
 if((f==='single'||f==='rr')&&n<2)er='Necesitás al menos 2 equipos.';
 if(f==='double'&&n<3)er='La doble eliminación necesita al menos 3 equipos.';
 if(f==='groups'&&(T.groups<2||n<T.groups*2||T.advance>Math.floor(n/T.groups)))er='Con '+n+' equipos no alcanza para '+T.groups+' grupos que clasifiquen '+T.advance+' cada uno.';
 if(e.min_teams&&n<e.min_teams)er='Faltan equipos: el mínimo es '+e.min_teams+'.';
 if(er){say('ta_msg',er);return}
 if(!confirm('Se genera el fixture con este orden de equipos. Se borran las partidas anteriores del torneo y después no se pueden cambiar los equipos ni el formato. ¿Seguir?'))return;
 M=f==='single'?genKO(e.id,T.teams,T.best_of,T.final_bo,'ko'):f==='double'?genDE(e.id,T.teams,T.best_of,T.final_bo):genGroups(e.id,T.teams,f==='rr'?1:T.groups,T.best_of,T.double_rr);
 settle(M);
 try{await ok(sb.from('matches').delete().eq('event_id',e.id));await ok(sb.from('matches').insert(M));await ok(sb.from('events').update({generated:true,stage:'En curso',seeds:T.teams,champion:null}).eq('id',e.id));say('ta_msg','Fixture generado.');await load();showToast('Fixture generado.')}catch(x){say('ta_msg','Error: '+x.message)}};
$('ta_play').onclick=async function(){var e=byId(events,selE);if(!e||e.format!=='groups'||!e.generated)return;var M=tms(e.id);
 if(M.some(function(m){return m.stage==='ko'})){say('ta_msg','Los playoffs ya están generados.');return}
 if(M.some(function(m){return m.stage==='group'&&m.status!=='finished'})){say('ta_msg','Faltan resultados de la fase de grupos.');return}
 try{var P=genPlayoffs(tobj(e),M);settle(P);await ok(sb.from('matches').insert(P));say('ta_msg','Playoffs generados.');await load()}catch(x){say('ta_msg','Error: '+x.message)}};
$('ta_reset').onclick=async function(){var e=byId(events,selE);if(!e||!e.generated)return;if(!confirm('Se borran todas las partidas y resultados de este torneo. ¿Seguir?'))return;
 try{await ok(sb.from('matches').delete().eq('event_id',e.id));await ok(sb.from('events').update({generated:false,stage:'Inscripciones',champion:null}).eq('id',e.id));say('ta_msg','Fixture reiniciado.');await load();fmtE()}catch(x){say('ta_msg','Error: '+x.message)}};
$('rcl').onclick=function(){$('rdl').close()};
$('rsv').onclick=async function(){var m=curM,mp=[];if(!m)return;
 [].forEach.call($('rmaps').children,function(row){var c=row.children,r1=num(c[1].value),r2=num(c[2].value);if(r1!=null&&r2!=null)mp.push({map:c[0].value.trim(),r1:r1,r2:r2})});
 var st=$('rst').value,when=$('rdate').value?new Date($('rdate').value).toISOString():null,M=(m.event_id?tms(m.event_id):[m]).map(function(x){return Object.assign({},x)}),r=applyRes(M,m.id,st,mp,when);
 if(r.err){say('rmsg',r.err);return}
 M.forEach(function(x){if(x.id===m.id)x.map=mp.map(function(k){return k.map}).filter(Boolean).join(', ')||null});
 try{await ok(sb.from('matches').upsert(M.filter(function(x){return r.ch[x.id]})));if(m.event_id)await finishE(m.event_id,M);$('rdl').close();load()}catch(e){say('rmsg','Error: '+e.message)}};
$('pc').onclick=resetP;$('acc').onclick=resetT;
$('ac').onclick=async function(){var n=$('an').value.trim();if(n.length<2)return;
 try{var d={name:n,tag:$('at').value.trim().toUpperCase(),members:players.filter(function(p){return chk[p.id]}).map(function(p){return p.id}),captain_id:$('acap').value||null};
  await ok(et?sb.from('teams').update(d).eq('id',et):sb.from('teams').insert(Object.assign({owner_id:me},d)));resetT();load();showToast('Equipo guardado con éxito.')}catch(e){showToast('Error al guardar equipo: '+(e&&e.message||e),'error')}
};

if($('filter-verification-status')) {
  $('filter-verification-status').onchange = function() { render(); };
}

var searchTimer;
if($('search-verification-input')) {
  $('search-verification-input').oninput = function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() { render(); }, 300);
  };
}
})();
