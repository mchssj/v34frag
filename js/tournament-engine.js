/* CSSTV tournament engine: bracket generation, progression and standings. */
(function (global) {
'use strict';
function uid(){if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
function seedOrder(S){var o=[1,2];while(o.length<S){var n=o.length*2,r=[];o.forEach(function(x){r.push(x,n+1-x)});o=r}return o.slice(0,S)}
function mkM(t,stage,grp,round,pos,bo){return{id:uid(),event_id:t,stage:stage,grp:grp,round:round,pos:pos,team1:null,team2:null,dead1:false,dead2:false,next_win:null,next_win_slot:null,next_lose:null,next_lose_slot:null,best_of:bo,status:'upcoming',score1:null,score2:null,maps:null,winner:null,bye:false,starts_at:null,map:null}}
function fillR1(M1,ord,teams){var n=teams.length;M1.forEach(function(m,i){var a=ord[2*i],b=ord[2*i+1];if(a<=n)m.team1=teams[a-1];else m.dead1=true;if(b<=n)m.team2=teams[b-1];else m.dead2=true})}
function computeDead(M){var by={},ch=true;M.forEach(function(m){by[m.id]=m});
 while(ch){ch=false;M.forEach(function(m){
  if(m.next_win&&m.dead1&&m.dead2){var t=by[m.next_win],k='dead'+m.next_win_slot;if(!t[k]){t[k]=true;ch=true}}
  if(m.next_lose&&(m.dead1||m.dead2)){var t2=by[m.next_lose],k2='dead'+m.next_lose_slot;if(!t2[k2]){t2[k2]=true;ch=true}}})}}
function genKO(tid,teams,bo,fbo,stage){var n=teams.length,S=2,k=1,r,i,m;while(S<n){S*=2;k++}
 var R=[],M=[];
 for(r=1;r<=k;r++){R[r]=[];for(i=1;i<=S/Math.pow(2,r);i++){m=mkM(tid,stage,null,r,i,r===k?fbo:bo);R[r][i]=m;M.push(m)}}
 for(r=1;r<k;r++)for(i=1;i<R[r].length;i++){m=R[r][i];m.next_win=R[r+1][Math.ceil(i/2)].id;m.next_win_slot=i%2?1:2}
 fillR1(R[1].slice(1),seedOrder(S),teams);computeDead(M);return M}
function genDE(tid,teams,bo,fbo){var n=teams.length,S=4,k=2,r,i,m;while(S<n){S*=2;k++}
 var U=[],L=[],M=[];
 for(r=1;r<=k;r++){U[r]=[];for(i=1;i<=S/Math.pow(2,r);i++){m=mkM(tid,'upper',null,r,i,bo);U[r][i]=m;M.push(m)}}
 for(r=1;r<=2*k-2;r++){L[r]=[];var c=S/Math.pow(2,Math.floor((r+1)/2)+1);for(i=1;i<=c;i++){m=mkM(tid,'lower',null,r,i,bo);L[r][i]=m;M.push(m)}}
 var G=mkM(tid,'grand',null,1,1,fbo);M.push(G);
 function W(a,b,s){a.next_win=b.id;a.next_win_slot=s}
 function Lo(a,b,s){a.next_lose=b.id;a.next_lose_slot=s}
 for(r=1;r<k;r++)for(i=1;i<U[r].length;i++)W(U[r][i],U[r+1][Math.ceil(i/2)],i%2?1:2);
 W(U[k][1],G,1);
 for(i=1;i<U[1].length;i++)Lo(U[1][i],L[1][Math.ceil(i/2)],i%2?1:2);
 for(r=2;r<=k;r++)for(i=1;i<U[r].length;i++)Lo(U[r][i],L[2*r-2][i],2);
 for(r=1;r<2*k-2;r++)for(i=1;i<L[r].length;i++){if(r%2)W(L[r][i],L[r+1][i],1);else W(L[r][i],L[r+1][Math.ceil(i/2)],i%2?1:2)}
 W(L[2*k-2][1],G,2);
 fillR1(U[1].slice(1),seedOrder(S),teams);computeDead(M);return M}
function rrPairs(list){var a=list.slice();if(a.length%2)a.push(null);var n=a.length,R=[];for(var r=0;r<n-1;r++){var p=[];for(var i=0;i<n/2;i++){var x=a[i],y=a[n-1-i];if(x&&y)p.push([x,y])}R.push(p);a.splice(1,0,a.pop())}return R}
function genGroups(tid,teams,G,bo,drr){var grp=[],M=[],i;for(i=0;i<G;i++)grp.push([]);
 teams.forEach(function(t,i){var row=Math.floor(i/G),c=i%G;grp[row%2?G-1-c:c].push(t)});
 grp.forEach(function(L,g){var R=rrPairs(L),nR=R.length;
  R.forEach(function(P,r){P.forEach(function(p,j){var m=mkM(tid,'group',g+1,r+1,j+1,bo);m.team1=p[0];m.team2=p[1];M.push(m)})});
  if(drr)R.forEach(function(P,r){P.forEach(function(p,j){var m=mkM(tid,'group',g+1,nR+r+1,j+1,bo);m.team1=p[1];m.team2=p[0];M.push(m)})})});
 return M}
function sers(maps){var a=0,b=0;(maps||[]).forEach(function(x){if(x.r1==null||x.r2==null)return;if(x.r1>x.r2)a++;else if(x.r2>x.r1)b++});return[a,b]}
function idx(M){var by={};M.forEach(function(m){by[m.id]=m});return by}
function nexts(by,m){var r=[];if(m.next_win)r.push([by[m.next_win],m.next_win_slot]);if(!m.bye&&m.next_lose)r.push([by[m.next_lose],m.next_lose_slot]);return r}
function routeOne(by,m,ch){
 if(m.winner&&m.next_win){var t=by[m.next_win];t['team'+m.next_win_slot]=m.winner;ch[t.id]=1}
 if(!m.bye&&m.next_lose&&m.winner){var l=m.winner===m.team1?m.team2:m.team1,t2=by[m.next_lose];t2['team'+m.next_lose_slot]=l;ch[t2.id]=1}}
function settle(M){var by=idx(M),ch={},go=true;
 while(go){go=false;M.forEach(function(m){if(m.status==='finished')return;
  if(m.dead1&&m.dead2){m.status='finished';m.bye=true;ch[m.id]=1;go=true;return}
  if(m.dead1!==m.dead2){var t=m.dead1?m.team2:m.team1;if(t){m.status='finished';m.bye=true;m.winner=t;ch[m.id]=1;routeOne(by,m,ch);go=true}}})}
 return ch}
function blocked(by,m){return nexts(by,m).some(function(x){var t=x[0];if(t.status==='upcoming')return false;if(t.bye&&t.status==='finished')return blocked(by,t);return true})}
function unroute(by,m,ch){nexts(by,m).forEach(function(x){var t=x[0];t['team'+x[1]]=null;ch[t.id]=1;
 if(t.bye&&t.status==='finished'&&!(t.dead1&&t.dead2)){unroute(by,t,ch);t.status='upcoming';t.bye=false;t.winner=null}})}
function applyRes(M,id,st,maps,when){var by=idx(M),m=by[id],ch={};
 if(m.bye||!m.team1||!m.team2)return{err:'Esta partida todavía no tiene los dos equipos.'};
 var ko=m.stage!=='group'&&m.stage!=null,sc=sers(maps),w=null;
 if(st==='finished'){if(!maps.length)return{err:'Cargá al menos un mapa.'};
  if(sc[0]===sc[1]){if(ko)return{err:'En eliminación no puede haber empate.'}}else w=sc[0]>sc[1]?m.team1:m.team2}
 var was=m.status==='finished';
 if(was&&(w!==m.winner||st!=='finished')){if(blocked(by,m))return{err:'Ya se jugaron partidas posteriores. Reabrí primero esas partidas.'};unroute(by,m,ch)}
 m.status=st;m.maps=maps.length?maps:null;m.score1=maps.length?sc[0]:null;m.score2=maps.length?sc[1]:null;m.winner=st==='finished'?w:null;m.starts_at=when;ch[m.id]=1;
 if(st==='finished'&&w)routeOne(by,m,ch);
 var c2=settle(M);for(var k in c2)ch[k]=1;return{ch:ch}}
function standings(M,ids,g){var r={};ids.forEach(function(id,i){r[id]={id:id,i:i,pj:0,w:0,d:0,l:0,pts:0,rf:0,ra:0}});
 M.forEach(function(m){if(m.stage!=='group'||m.status!=='finished'||m.bye||(g!=null&&m.grp!==g)||!r[m.team1]||!r[m.team2])return;
  var a=r[m.team1],b=r[m.team2],x=0,y=0;(m.maps||[]).forEach(function(k){x+=k.r1||0;y+=k.r2||0});
  a.pj++;b.pj++;a.rf+=x;a.ra+=y;b.rf+=y;b.ra+=x;
  if(m.winner===m.team1){a.w++;b.l++;a.pts+=3}else if(m.winner===m.team2){b.w++;a.l++;b.pts+=3}else{a.d++;b.d++;a.pts++;b.pts++}});
 return Object.keys(r).map(function(k){return r[k]}).sort(function(p,q){return q.pts-p.pts||(q.rf-q.ra)-(p.rf-p.ra)||q.rf-p.rf||p.i-q.i})}
function genPlayoffs(t,M){var gs=[],g,A=t.advance;
 for(g=1;g<=t.groups;g++){var ids=t.teams.filter(function(id){return M.some(function(m){return m.stage==='group'&&m.grp===g&&(m.team1===id||m.team2===id)})});gs.push(standings(M,ids,g).map(function(x){return x.id}))}
 function seeds(rev){var s=[];for(var p=0;p<A;p++){var row=gs.map(function(x){return x[p]}).filter(Boolean);if(rev&&p%2)row.reverse();s=s.concat(row)}return s}
 function gof(id){for(var i=0;i<gs.length;i++)if(gs[i].indexOf(id)>-1)return i;return-1}
 function conf(s){var S=2;while(S<s.length)S*=2;var o=seedOrder(S),c=0;for(var i=0;i<S;i+=2){var a=s[o[i]-1],b=s[o[i+1]-1];if(a&&b&&gof(a)===gof(b))c++}return c}
 var s1=seeds(false),s2=seeds(true),best=conf(s2)<conf(s1)?s2:s1;
 return genKO(t.id,best,t.best_of,t.final_bo,'ko')}
function champOf(t,M){var f=t.format;
 if(f==='single'||f==='groups'){var ko=M.filter(function(m){return m.stage==='ko'});if(!ko.length)return null;var k=Math.max.apply(null,ko.map(function(m){return m.round})),fin=ko.filter(function(m){return m.round===k})[0];return fin&&fin.status==='finished'?fin.winner:null}
 if(f==='double'){var g=M.filter(function(m){return m.stage==='grand'})[0];return g&&g.status==='finished'?g.winner:null}
 if(f==='rr'){var gm=M.filter(function(m){return m.stage==='group'});if(!gm.length||gm.some(function(m){return m.status!=='finished'}))return null;return standings(M,t.teams,1)[0].id}
 return null}
global.CSSTVTournamentEngine = Object.freeze({seedOrder,mkM,fillR1,computeDead,genKO,genDE,rrPairs,genGroups,sers,idx,nexts,routeOne,settle,blocked,unroute,applyRes,standings,genPlayoffs,champOf});
})(window);
