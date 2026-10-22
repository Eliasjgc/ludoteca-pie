(function(root){
  'use strict';
  const codigoValido = value => /^J\d{3,8}(?:-\d{2,8})?$/.test(value);
  const normalizar = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').trim().replace(/\s+/g,' ');
  function extraerCodigo(texto, pagina, api) {
    const raw = String(texto || '').trim();
    if (codigoValido(raw.toUpperCase())) return raw.toUpperCase();
    let url, propia;
    try { url=new URL(raw); propia=new URL(pagina); } catch(error) { return ''; }
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const base = propia.pathname.replace(/index\.html$/,'').replace(/\/?$/,'/');
    const mismoSitio = url.origin === propia.origin && [base,base+'index.html',base.slice(0,-1)].includes(url.pathname);
    const apiPermitida = api && url.origin+url.pathname === new URL(api).origin+new URL(api).pathname;
    if (!mismoSitio && !apiPermitida) return '';
    const id = (url.searchParams.get('id') || '').toUpperCase();
    return codigoValido(id) ? id : '';
  }
  function fichaValida(g) {
    const keys=['nombre','fotografia','cantidadTotal','disponibilidad','categoria','descripcion'];
    return !!g && [6,7].includes(Object.keys(g).length) && keys.every(k=>Object.prototype.hasOwnProperty.call(g,k)) &&
      (Object.keys(g).length===6 || (Object.prototype.hasOwnProperty.call(g,'prestados') && Number.isInteger(g.prestados) && g.prestados>=0 && g.prestados<=g.cantidadTotal-g.disponibilidad)) &&
      ['nombre','fotografia','categoria','descripcion'].every(k=>typeof g[k]==='string') &&
      Number.isInteger(g.cantidadTotal) && Number.isInteger(g.disponibilidad) && g.disponibilidad>=0 && g.disponibilidad<=g.cantidadTotal;
  }
  function filtrarCatalogo(items,consulta,categoria) {
    const q=normalizar(consulta),cat=normalizar(categoria);
    const codigo=codigoValido(q.toUpperCase())?q.toUpperCase().split('-')[0]:'';
    return items.filter(g=>(!cat||normalizar(g.categoria)===cat) && (codigo?g.referencia===codigo:q.split(' ').every(term=>normalizar(g.nombre+' '+g.categoria+' '+g.referencia).includes(term))));
  }
  const tools={codigoValido,normalizar,extraerCodigo,fichaValida,filtrarCatalogo};
  if(typeof module==='object' && module.exports) module.exports=tools; else root.LudotecaTools=tools;
})(typeof globalThis!=='undefined'?globalThis:this);
