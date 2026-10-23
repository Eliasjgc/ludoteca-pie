(function(root){
  'use strict';
  const fotoValida=src=>typeof src==='string'&&src.length<=1400000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(src);
  const versionValida=v=>typeof v==='string'&&/^(?:[a-f0-9]{64})?$/.test(v);
  const miniaturaValida=src=>typeof src==='string'&&/^fotos\/J\d{3,8}-[a-f0-9]{12}\.webp$/.test(src);
  class PhotoStore{
    constructor({caches=root.caches,base=root.location&&root.location.href,api=''}={}){this.caches=caches;this.base=base;this.api=api}
    clave(id,version){const u=new URL('./fotos-guardadas/'+id,this.base);u.search=new URLSearchParams({version,api:this.api}).toString();return u.href}
    async leer(id,version){
      try{if(!this.caches)return '';const cache=await this.caches.open('ludoteca-fotos-v1'),r=await cache.match(this.clave(id,version));if(!r)return '';const foto=await r.text();return fotoValida(foto)?foto:''}catch(error){return ''}
    }
    async guardar(id,version,foto){
      if(!fotoValida(foto)||!versionValida(version)||!version)return;
      try{
        if(!this.caches)return;
        const cache=await this.caches.open('ludoteca-fotos-v1'),key=this.clave(id,version);
        await cache.put(key,new Response(foto,{headers:{'Content-Type':'text/plain'}}));
        const keys=await cache.keys();
        for(const k of keys){const u=new URL(k.url);if(u.pathname===new URL(key).pathname&&u.searchParams.get('api')===this.api&&k.url!==key)await cache.delete(k)}
        const restantes=await cache.keys();
        for(const k of restantes.slice(0,Math.max(0,restantes.length-100)))await cache.delete(k);
      }catch(error){/* Funciona también sin almacenamiento disponible. */}
    }
  }
  class CatalogPhotoLoader{
    constructor({cargar,miniaturas={},almacen=new PhotoStore(),Observer=root.IntersectionObserver,limite=3,maxBytes=12000000,ahora=()=>Date.now()}){
      this.cargar=cargar;this.miniaturas=miniaturas;this.almacen=almacen;this.limite=limite;this.maxBytes=maxBytes;this.ahora=ahora;
      this.activos=0;this.epoca=0;this.cola=[];this.cache=new Map();this.bytes=0;this.enCurso=new Map();this.pendientes=new Map();
      this.observer=typeof Observer==='function'?new Observer(entries=>{for(const e of entries){if(!e.isIntersecting)continue;this.observer.unobserve(e.target);const tarea=this.pendientes.get(e.target);if(tarea){this.pendientes.delete(e.target);this.encolar(tarea)}}},{rootMargin:'500px 0px'}):null;
    }
    pausar(){this.epoca++;this.cola=[];this.pendientes.clear();if(this.observer)this.observer.disconnect()}
    limpiar(){this.pausar()}
    observar(nodo,id,imagen,nota,version){
      const tarea={id,version,imagen,nota,epoca:this.epoca};
      if(!versionValida(version)||!/^J\d{3,8}$/.test(id)||!version){this.pintar(tarea,'');return}
      const mini=this.miniaturas[id];
      if(mini&&mini.versionFoto===version&&miniaturaValida(mini.src)){this.pintar(tarea,mini.src,true);return}
      if(this.observer){this.pendientes.set(nodo,tarea);this.observer.observe(nodo)}else this.encolar(tarea);
    }
    encolar(tarea){this.cola.push(tarea);this.procesar()}
    recordar(key,foto){
      if(this.cache.has(key)){this.bytes-=this.cache.get(key).foto.length;this.cache.delete(key)}
      this.cache.set(key,{foto,fecha:this.ahora()});this.bytes+=foto.length;
      while(this.bytes>this.maxBytes||this.cache.size>100){const [id,item]=this.cache.entries().next().value;this.bytes-=item.foto.length;this.cache.delete(id)}
    }
    pintar(tarea,foto,estatica=false){
      if(tarea.epoca!==this.epoca)return;
      const {imagen,nota}=tarea;
      const ausente=()=>{if(tarea.epoca!==this.epoca)return;imagen.hidden=true;nota.textContent='Fotografía no disponible';nota.hidden=false};
      if(!(estatica?miniaturaValida(foto):fotoValida(foto))){ausente();return}
      imagen.onload=()=>{if(tarea.epoca!==this.epoca)return;imagen.hidden=false;nota.hidden=true};
      imagen.onerror=()=>{if(tarea.epoca!==this.epoca)return;if(estatica){imagen.removeAttribute('src');this.encolar(tarea)}else ausente()};
      imagen.hidden=false;imagen.src=foto;
      if(imagen.complete&&imagen.naturalWidth>0){imagen.hidden=false;nota.hidden=true}
    }
    async obtener(id,version){
      const key=id+':'+version,anterior=this.cache.get(key);
      if(anterior&&(anterior.foto||this.ahora()-anterior.fecha<60000))return anterior.foto;
      if(this.enCurso.has(key))return this.enCurso.get(key);
      const promesa=(async()=>{
        const guardada=await this.almacen.leer(id,version);
        if(fotoValida(guardada)){this.recordar(key,guardada);return guardada}
        const r=await this.cargar(id,version);
        if(!r||r.referencia!==id||!versionValida(r.versionFoto)||!fotoValida(r.fotografia)){this.recordar(key,'');return ''}
        this.recordar(id+':'+r.versionFoto,r.fotografia);
        await this.almacen.guardar(id,r.versionFoto,r.fotografia);
        return r.fotografia;
      })();
      this.enCurso.set(key,promesa);
      try{return await promesa}finally{this.enCurso.delete(key)}
    }
    procesar(){
      while(this.activos<this.limite&&this.cola.length){
        const tarea=this.cola.shift();if(tarea.epoca!==this.epoca)continue;
        this.activos++;
        this.obtener(tarea.id,tarea.version).then(foto=>this.pintar(tarea,foto)).catch(()=>this.pintar(tarea,'')).finally(()=>{this.activos--;this.procesar()});
      }
    }
  }
  const exports={CatalogPhotoLoader,PhotoStore,fotoValida,versionValida,miniaturaValida};
  if(typeof module==='object'&&module.exports)module.exports=exports;else Object.assign(root,exports);
})(typeof globalThis!=='undefined'?globalThis:this);
