const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function consulta({respuesta,preparar=()=>Promise.resolve()}={}){
 const elementos={},mostradas=[];
 const ctx={clearTimeout,setTimeout,Map,Date,navigator:{onLine:true},filtroPendiente:null,generacion:0,idActual:'',fichasEnCurso:new Map(),catalogo:[{referencia:'J001',nombre:'Juego',categoria:'Cartas',versionFoto:''}],ui:id=>elementos[id]||(elementos[id]={textContent:'99',hidden:false,scrollIntoView(){}}),limpiarVista(){},mostrarReintento(){},estado(){},fichaValida:()=>true,codigoValido:()=>true,prepararCatalogo:preparar,jsonp:respuesta,mostrarFicha:g=>mostradas.push(g),fotosCatalogo:{observar(){}},matchMedia:()=>({matches:true})};
 vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function anticiparFicha('),src.indexOf('function pintarCatalogo(')),ctx);return {ctx,elementos,mostradas};
}
test('una ficha no espera al catálogo cuando la disponibilidad ya respondió',async()=>{
 const t=consulta({preparar:()=>new Promise(()=>{}),respuesta:async()=>({disponibilidad:2})});
 await t.ctx.consultar('J001');assert.equal(t.mostradas.length,1);assert.equal(t.mostradas[0].disponibilidad,2);
});
test('la vista anticipada muestra cantidades pendientes, nunca disponibilidad guardada',async()=>{
 let fail;const t=consulta({respuesta:()=>new Promise((ok,no)=>fail=no)});const p=t.ctx.consultar('J001');await new Promise(r=>setImmediate(r));
 assert.equal(t.elementos.nombre.textContent,'Juego');for(const campo of ['total','disponibles','prestados'])assert.equal(t.elementos[campo].textContent,'…');
 fail(Error('Sin conexión'));await p;assert.equal(t.elementos.ficha.hidden,true);assert.equal(t.mostradas.length,0);
});
test('las fichas simultáneas comparten la petición y cada apertura posterior consulta de nuevo',async()=>{
 let calls=0,release;const t=consulta({respuesta:()=>{calls++;return new Promise(r=>release=r)}});
 const a=t.ctx.consultar('J001'),b=t.ctx.consultar('J001');assert.equal(calls,1);release({disponibilidad:2});await Promise.all([a,b]);assert.equal(t.mostradas.length,1);
 const c=t.ctx.consultar('J001');assert.equal(calls,2);release({disponibilidad:1});await c;assert.equal(t.mostradas[1].disponibilidad,1);
});
test('volver desde un QR prepara el catálogo remoto una vez, después de abrir la ficha',()=>{
 let peticiones=0,pintadas=0;
 const ctx={clearTimeout,filtroPendiente:null,generacion:0,idActual:'J001',catalogoCargado:true,catalogoSolicitado:false,mostrarReintento(){},limpiarVista(){},ui:()=>({}),pintarCatalogo:()=>pintadas++,cargarCatalogo:()=>{peticiones++;ctx.catalogoSolicitado=true}};
 vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function mostrarCatalogo('),src.indexOf('function leerUbicacion(')),ctx);
 assert.equal(peticiones,0);ctx.mostrarCatalogo();ctx.mostrarCatalogo();assert.equal(peticiones,1);assert.equal(pintadas,2);
});
test('el lector no forma parte de la carga inicial ni de la precarga del service worker',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(!/<script[^>]+(?:scanner|jsQR)/.test(html));
 const handlers={},loaded=[],ctx={URL,Set,Promise,self:{registration:{scope:'https://example.com/ludoteca/'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting(){}},caches:{open:async()=>({addAll:async urls=>loaded.push(...urls)})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),ctx);let job;handlers.install({waitUntil:p=>job=p});return job.then(()=>assert.ok(loaded.every(url=>!/scanner|jsQR/.test(url))));
});
test('actualizar la aplicación conserva la caché independiente de miniaturas',async()=>{
 const handlers={},deleted=[],ctx={URL,Set,Promise,self:{registration:{scope:'https://example.com/ludoteca/'},clients:{claim(){}},addEventListener:(n,f)=>handlers[n]=f},caches:{keys:async()=>['ludoteca-pie-/ludoteca/-2.7.2','ludoteca-miniaturas-/ludoteca/-v1','ludoteca-fotos-v1','otra-app'],delete:async name=>deleted.push(name)}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),ctx);let job;handlers.activate({waitUntil:p=>job=p});await job;assert.deepEqual(deleted,['ludoteca-pie-/ludoteca/-2.7.2']);
});
