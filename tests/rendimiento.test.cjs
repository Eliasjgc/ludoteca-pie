const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {CatalogPhotoLoader,PhotoStore}=require('../fotos.js');
const {catalogoValido,leerCatalogo,guardarCatalogo}=require('../catalogo-datos.js');
const {fichaValida,filtrarCatalogo,extraerCodigo}=require('../core.js');
const v='a'.repeat(64),v2='b'.repeat(64),foto='data:image/webp;base64,AAAA';
const almacen=()=>({leer:async()=>'',guardar:async()=>{}});
const image=()=>({hidden:true,complete:false,removeAttribute(){}});
const flush=()=>new Promise(r=>setImmediate(r));

test('las miniaturas y los juegos sin foto no consultan Apps Script',()=>{
  let calls=0;const loader=new CatalogPhotoLoader({cargar:()=>{calls++},Observer:null,almacen:almacen(),miniaturas:{J001:{versionFoto:v,src:'fotos/J001-0123456789ab.webp'}}});
  const img=image(),nota={hidden:false};loader.observar({},'J001',img,nota,v);
  assert.equal(img.src,'fotos/J001-0123456789ab.webp');assert.equal(img.hidden,false);
  img.onload();assert.equal(nota.hidden,true);
  const sin={};loader.observar({},'J002',image(),sin,'');assert.equal(sin.textContent,'Fotografía no disponible');
  assert.equal(calls,0);
});
test('al cambiar la versión se descarga la nueva foto y se comparte la petición',async()=>{
  const calls=[];const loader=new CatalogPhotoLoader({Observer:null,almacen:almacen(),miniaturas:{J001:{versionFoto:v,src:'fotos/J001-0123456789ab.webp'}},cargar:async(id,version)=>{calls.push(version);return {referencia:id,versionFoto:version,fotografia:foto}}});
  const [a,b]=await Promise.all([loader.obtener('J001',v),loader.obtener('J001',v)]);
  assert.equal(a,foto);assert.equal(b,foto);assert.equal(calls.length,1);
  const img=image();loader.observar({},'J001',img,{},v2);await flush();await flush();
  assert.equal(img.src,foto);assert.deepEqual(calls,[v,v2]);
});
test('una respuesta anterior no pinta sobre los resultados nuevos y sigue siendo reutilizable',async()=>{
  let release;let calls=0;const loader=new CatalogPhotoLoader({Observer:null,almacen:almacen(),cargar:id=>{calls++;return new Promise(r=>{release=()=>r({referencia:id,versionFoto:v,fotografia:foto})})}});
  const viejo=image();loader.observar({},'J001',viejo,{},v);await flush();loader.pausar();
  const nuevo=image();loader.observar({},'J001',nuevo,{},v);await flush();release();await flush();await flush();
  assert.equal(viejo.src,undefined);assert.equal(nuevo.src,foto);assert.equal(calls,1);
});
test('la cola limita concurrencia y continúa después de errores',async()=>{
  let running=0,max=0;const pending=[];
  const loader=new CatalogPhotoLoader({Observer:null,almacen:almacen(),limite:3,cargar:async id=>{running++;max=Math.max(max,running);await new Promise(r=>pending.push(r));running--;if(id==='J001')throw Error('red');return {referencia:id,versionFoto:v,fotografia:foto}}});
  const images=Array.from({length:7},()=>image());images.forEach((img,i)=>loader.observar({},'J00'+(i+1),img,{},v));
  for(let i=0;i<8;i++){await flush();pending.splice(0).forEach(r=>r())}await flush();
  assert.equal(max,3);assert.equal(loader.activos,0);assert.equal(images[0].hidden,true);assert.equal(images[6].src,foto);
});
test('el caché persistente se recupera en otra visita y se invalida por versión',async()=>{
  const contents=new Map();const cache={put:async(k,r)=>contents.set(k,r),match:async k=>contents.get(k)?.clone(),keys:async()=>[...contents.keys()].map(url=>({url})),delete:async k=>contents.delete(k.url||k)};
  const options={caches:{open:async()=>cache},base:'https://example.com/ludoteca/',api:'public-api'};
  const store=new PhotoStore(options);await store.guardar('J001',v,foto);
  let calls=0;const loader=new CatalogPhotoLoader({Observer:null,almacen:new PhotoStore(options),cargar:async id=>{calls++;return {referencia:id,versionFoto:v2,fotografia:foto}}});
  assert.equal(await loader.obtener('J001',v),foto);assert.equal(calls,0);
  await loader.obtener('J001',v2);assert.equal(calls,1);assert.equal(await store.leer('J001',v),'');
});
test('el listado guardado tiene vencimiento y rechaza contratos ajenos o dañados',()=>{
  let raw;const storage={getItem:()=>raw,setItem:(k,s)=>{raw=s}};
  const juegos=[{referencia:'J001',nombre:'Ajedrez',categoria:'Estrategia',versionFoto:v}];
  guardarCatalogo(storage,'test',juegos,1000);assert.equal(leerCatalogo(storage,'test',2000).juegos.length,1);
  assert.equal(leerCatalogo(storage,'test',1000+604800001),null);
  assert.equal(catalogoValido({juegos:[...juegos,...juegos]}),false);
  assert.equal(catalogoValido({juegos:[{...juegos[0],personaNombre:'privado'}]}),false);
  raw='{';assert.equal(leerCatalogo(storage,'test'),null);
  assert.equal(filtrarCatalogo(juegos,'ajédrez','Estrategia').length,1);
  assert.equal(extraerCodigo('J001-01','https://example.com/',''),'J001-01');
});
test('las fichas antiguas y nuevas se validan sin aceptar datos inesperados',()=>{
  const old={nombre:'Juego',categoria:'Cartas',descripcion:'Texto',fotografia:'',cantidadTotal:3,disponibilidad:1,prestados:1};
  assert.equal(fichaValida(old),true);assert.equal(fichaValida({...old,referencia:'J001',versionFoto:v}),true);
  assert.equal(fichaValida({...old,personaNombre:'privado'}),false);
});
test('el service worker reutiliza miniaturas y deja la disponibilidad en la red',async()=>{
  const handlers={},saved=new Map();let requests=0;
  const cache={match:async r=>saved.get(r.url)?.clone(),put:async(r,response)=>saved.set(r.url,response),keys:async()=>[...saved.keys()].map(url=>({url})),delete:async r=>saved.delete(r.url)};
  const context={URL,Set,Promise,Response,self:{registration:{scope:'https://example.com/ludoteca/'},addEventListener:(name,fn)=>{handlers[name]=fn}},caches:{open:async()=>cache},fetch:async()=>{requests++;return new Response('webp')}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../sw.js'),'utf8'),context);
  async function request(url){let response;const waits=[];handlers.fetch({request:{method:'GET',url,mode:'cors'},respondWith:p=>{response=p},waitUntil:p=>waits.push(p)});if(!response)return null;const r=await response;await Promise.all(waits);return r.text()}
  const src='https://example.com/ludoteca/fotos/J001-0123456789ab.webp';
  assert.equal(await request(src),'webp');assert.equal(await request(src),'webp');assert.equal(requests,1);
  assert.equal(await request('https://script.google.com/macros/s/public/exec?api=ficha'),null);assert.equal(requests,1);
});
test('todas las miniaturas publicadas existen y corresponden a su versión y huella',()=>{
  const path=require('node:path'),snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalogo-inicial.json'),'utf8'));
  assert.equal(catalogoValido(snapshot),true);
  for(const g of snapshot.juegos){
    const photo=snapshot.fotos[g.referencia];if(!photo){assert.equal(g.versionFoto,'');continue}
    assert.equal(photo.versionFoto,g.versionFoto);
    const bytes=fs.readFileSync(path.join(__dirname,'..',photo.src));
    assert.ok(bytes.length<50000);assert.ok(photo.width<=480&&photo.height<=400);
    assert.ok(photo.src.includes(crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12)));
  }
});
