"""Genera _tienda_demo.html: copia de index.html con la tienda alimentada por catalogo.json, para verla antes de
aplicar la migración. Lee los datos públicos de la Supabase real pero no escribe nada (comprar o equipar falla).

Uso (desde la raíz del repo): python docs/bitacora/2026-10-29-tienda-web/pruebas/generar_demo.py
Abrir http://localhost:8099/_tienda_demo.html?demo=1#shop (sumar &vip=1 para verla como VIP y &admin=1 para Admin → Tienda).
_tienda_demo.html está en .gitignore.
"""
from pathlib import Path
R = Path(__file__).resolve().parents[4]
s = (R / "index.html").read_text(encoding="utf-8")
demo = r"""async function loadShopDemo(){
 var cat=await (await fetch('assets/perfil/catalogo.json')).json(),vip=/[?&]vip=1/.test(location.search);
 var pr=function(i){if(i.vip_only)return null;var cs=i.collection==='cs';return i.kind==='sticker'?(cs?150:200):i.kind==='name'?(cs?(i.animated?600:500):400):i.kind==='theme'?(cs?700:600):(cs?(i.animated?1200:900):(i.collection.indexOf('paises')===0?1000:900))};
 shopItems=cat.items.map(function(i,n){return Object.assign({},i,{price:pr(i),active:true,sort:(n+1)*10})});shopAll={};shopItems.forEach(function(i){shopAll[i.id]=i});
 var wk=['marco-fuego','sticker-gg','tema-mapa-dust2','nombre-pais-ar','marco-mapa-nuke','sticker-pais-mx'];
 shopCat=shopItems.map(function(i){var w=wk.indexOf(i.id)>=0;return Object.assign({},i,{base_price:i.price,price:i.price==null?null:w?Math.round(i.price*.75):i.price,weekly:w,weekly_ends:'2026-11-02T05:00:00Z'})});
 shopCatById={};shopCat.forEach(function(i){shopCatById[i.id]=i});
 if(/[?&]admin=1/.test(location.search))admin=true;var conP=players.filter(function(p){return p.user_id});if(!me&&conP[0])me=conP[0].user_id;
 pointsCfg={per_mix:10,per_win:5,vip_multiplier:1.5,weekly_count:6,weekly_discount:25};
 myPts={earned:1840,granted:100,spent:1100,balance:840,mixes:132,vip:vip};
 myItems={'marco-fuego':{},'sticker-gg':{},'tema-pais-ar':{},'nombre-brillo':{}};
 myCos={frame:vip?'marco-serie-guerrero':'marco-fuego',theme:vip?'tema-serie-guerrero':'tema-pais-ar',name:vip?'nombre-ki':'nombre-brillo',stickers:vip?['sticker-ace','sticker-gg']:['sticker-gg']};
 cosByPlayer={};vipByPlayer={};var F=['marco-pais-uy','marco-mapa-dust2','marco-arma-awp','marco-serie-portal','marco-neon'],N=['nombre-pais-uy','nombre-mapa-dust2','nombre-arma-awp','nombre-portal','nombre-neon'];
 players.slice(0,12).forEach(function(p,k){if(k%2)return;var j=(k/2)%5;cosByPlayer[p.id]={player_id:p.id,frame:F[j],name:N[j],theme:j===3?'tema-serie-portal':'tema-pais-uy',stickers:['sticker-pais-uy','sticker-serie-portal']};if(j>=2)vipByPlayer[p.id]=true});
 var mp=conP[0];if(mp){cosByPlayer[mp.id]=Object.assign({player_id:mp.id},myCos);if(vip)vipByPlayer[mp.id]=true}
 shopState='ok';if(shown('shop'))rShop();if(shown('players'))rViews();if(admin&&shown('shadm'))rShopAdm();if(shown('player-profile'))rProfile();if(shown('profile'))rCoverBox()}
"""
a = "async function loadShop(){"
assert s.count(a) == 1
s = s.replace(a, demo + a + "if(/[?&]demo=1/.test(location.search))return loadShopDemo();")
(R / "_tienda_demo.html").write_text(s, encoding="utf-8")
print("ok")
