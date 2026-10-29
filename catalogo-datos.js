(function(root){
  'use strict';
  function catalogoValido(r){
    return !!r&&Array.isArray(r.juegos)&&r.juegos.length<=10000&&new Set(r.juegos.map(g=>g&&g.referencia)).size===r.juegos.length&&r.juegos.every(g=>g&&Object.keys(g).every(k=>['referencia','nombre','categoria','versionFoto','descripcion','cantidadTotal','disponibilidad','prestados'].includes(k))&&[4,5,8].includes(Object.keys(g).length)&&(Object.keys(g).length!==5||Object.hasOwn(g,'descripcion'))&&/^J\d{3,8}$/.test(g.referencia)&&typeof g.nombre==='string'&&g.nombre.length<=110&&typeof g.categoria==='string'&&(!('descripcion' in g)||typeof g.descripcion==='string'&&g.descripcion.length<=1200)&&(!('disponibilidad' in g)||Number.isInteger(g.cantidadTotal)&&g.cantidadTotal>=0&&Number.isInteger(g.disponibilidad)&&g.disponibilidad>=0&&Number.isInteger(g.prestados)&&g.prestados>=0&&g.disponibilidad+g.prestados<=g.cantidadTotal)&&typeof g.versionFoto==='string'&&/^(?:[a-f0-9]{64})?$/.test(g.versionFoto));
  }
  function leerCatalogo(storage,key,ahora=Date.now()){
    try{const r=JSON.parse(storage.getItem(key));return r&&Number.isFinite(r.fecha)&&r.fecha<=ahora&&ahora-r.fecha<604800000&&catalogoValido(r)?r:null}catch(error){return null}
  }
  function guardarCatalogo(storage,key,juegos,fecha=Date.now()){
    try{const r={juegos,fecha};if(catalogoValido(r))storage.setItem(key,JSON.stringify(r))}catch(error){/* Modo privado o almacenamiento lleno. */}
  }
  const exports={catalogoValido,leerCatalogo,guardarCatalogo};
  if(typeof module==='object'&&module.exports)module.exports=exports;else root.CatalogoDatos=exports;
})(typeof globalThis!=='undefined'?globalThis:this);

