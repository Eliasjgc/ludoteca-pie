(function(root){
  'use strict';
  const fotoValida=src=>typeof src==='string'&&src.length<=1400000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(src);
  /** Solo fotos públicas, caché temporal en memoria y dos consultas simultáneas. */
  class CatalogPhotoLoader{
    constructor({cargar,Observer=root.IntersectionObserver,limite=2,maxBytes=12000000,ahora=()=>Date.now()}){
      this.cargar=cargar;this.limite=limite;this.maxBytes=maxBytes;this.ahora=ahora;this.activos=0;this.epoca=0;this.cola=[];this.cache=new Map();this.bytes=0;
      this.observer=typeof Observer==='function'?new Observer(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;this.observer.unobserve(entry.target);const tarea=this.pendientes.get(entry.target);if(tarea){this.pendientes.delete(entry.target);this.encolar(tarea)}}},{rootMargin:'160px 0px'}):null;
      this.pendientes=new Map();
    }
    pausar(){this.epoca++;this.cola=[];this.pendientes.clear();if(this.observer)this.observer.disconnect()}
    limpiar(){this.pausar();this.cache.clear();this.bytes=0}
    observar(nodo,id,imagen,nota){const tarea={id,imagen,nota,epoca:this.epoca};if(this.observer){this.pendientes.set(nodo,tarea);this.observer.observe(nodo)}else this.encolar(tarea)}
    encolar(tarea){this.cola.push(tarea);this.procesar()}
    recordar(id,foto){
      if(this.cache.has(id)){this.bytes-=this.cache.get(id).foto.length;this.cache.delete(id)}
      this.cache.set(id,{foto,fecha:this.ahora()});this.bytes+=foto.length;
      while(this.bytes>this.maxBytes||this.cache.size>100){const [key,item]=this.cache.entries().next().value;this.bytes-=item.foto.length;this.cache.delete(key)}
    }
    pintar(tarea,foto){
      if(tarea.epoca!==this.epoca)return;
      const {imagen,nota}=tarea;nota.textContent='Fotografía no disponible';
      if(!fotoValida(foto)){imagen.hidden=true;nota.hidden=false;return}
      imagen.onerror=()=>{imagen.hidden=true;nota.hidden=false;const item=this.cache.get(tarea.id);if(item){this.bytes-=item.foto.length;this.cache.delete(tarea.id)}};
      imagen.src=foto;imagen.hidden=false;nota.hidden=true;
    }
    procesar(){
      while(this.activos<this.limite&&this.cola.length){
        const tarea=this.cola.shift();if(tarea.epoca!==this.epoca)continue;
        const anterior=this.cache.get(tarea.id);
        if(anterior&&this.ahora()-anterior.fecha<120000){this.pintar(tarea,anterior.foto);continue}
        this.activos++;
        Promise.resolve().then(()=>this.cargar(tarea.id)).then(foto=>{if(tarea.epoca!==this.epoca)return;const segura=fotoValida(foto)?foto:'';this.recordar(tarea.id,segura);this.pintar(tarea,segura)}).catch(()=>this.pintar(tarea,'')).finally(()=>{this.activos--;this.procesar()});
      }
    }
  }
  if(typeof module==='object'&&module.exports)module.exports={CatalogPhotoLoader,fotoValida};else root.CatalogPhotoLoader=CatalogPhotoLoader;
})(typeof globalThis!=='undefined'?globalThis:this);
