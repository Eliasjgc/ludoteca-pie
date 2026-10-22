(function(root){
  'use strict';
  /** Solo procesa imágenes locales; nunca abre enlaces ni envía fotogramas. */
  class QrImageReader {
    constructor(decode) {
      this.decode=decode;this.detector=null;
      this.canvas=document.createElement('canvas');
      this.context=this.canvas.getContext('2d',{willReadFrequently:true});
      this.ready=this.prepareNative();
    }
    async prepareNative() {
      try {
        if(typeof root.BarcodeDetector!=='function')return;
        if(typeof root.BarcodeDetector.getSupportedFormats==='function' && !(await root.BarcodeDetector.getSupportedFormats()).includes('qr_code'))return;
        this.detector=new root.BarcodeDetector({formats:['qr_code']});
      } catch(error) { this.detector=null; }
    }
    async read(source,width,height) {
      if(!width||!height)return '';
      if(this.detector){
        let timeout;
        try {
          const results=await Promise.race([this.detector.detect(source),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('NATIVE_TIMEOUT')),450)})]);
          const result=results.find(item=>typeof item.rawValue==='string'&&item.rawValue.trim());
          if(result)return result.rawValue;
        } catch(error) { this.detector=null; }
        finally { clearTimeout(timeout); }
      }
      if(typeof this.decode!=='function')throw Error('DECODER_UNAVAILABLE');
      if(!this.context)throw Error('CANVAS_UNAVAILABLE');
      // Centro con detalle original, y campo completo para los QR fuera del recuadro.
      const side=Math.floor(Math.min(width,height)*0.9);
      const regions=[{x:Math.floor((width-side)/2),y:Math.floor((height-side)/2),w:side,h:side,max:1000},{x:0,y:0,w:width,h:height,max:1440}];
      for(const region of regions){
        const ratio=Math.min(1,region.max/Math.max(region.w,region.h));
        this.canvas.width=Math.max(1,Math.round(region.w*ratio));this.canvas.height=Math.max(1,Math.round(region.h*ratio));
        this.context.drawImage(source,region.x,region.y,region.w,region.h,0,0,this.canvas.width,this.canvas.height);
        const frame=this.context.getImageData(0,0,this.canvas.width,this.canvas.height);
        const result=this.decode(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
        if(result&&typeof result.data==='string'&&result.data.trim())return result.data;
      }
      return '';
    }
  }
  class CameraQrScanner {
    constructor(video,{decode,onRead,onError,onProgress=()=>{}}) {
      this.video=video;this.reader=new QrImageReader(decode);this.onRead=onRead;this.onError=onError;this.onProgress=onProgress;
      this.session=0;this.stream=null;this.timer=null;this.active=false;this.frames=0;
    }
    async start() {
      this.stop();const session=this.session;this.active=true;this.frames=0;
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){this.active=false;throw Error('CAMERA_UNAVAILABLE')}
      if(typeof this.reader.decode!=='function'&&typeof root.BarcodeDetector!=='function'){this.active=false;throw Error('DECODER_UNAVAILABLE')}
      try {
        let stream;
        try {stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}})}
        catch(error){
          if(!this.active||session!==this.session)return false;
          if(!['OverconstrainedError','ConstraintNotSatisfiedError'].includes(error.name))throw error;
          stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
        }
        if(!this.active||session!==this.session){stream.getTracks().forEach(t=>t.stop());return false}
        this.stream=stream;this.video.srcObject=stream;this.video.muted=true;
        this.video.setAttribute&&this.video.setAttribute('playsinline','');
        const track=stream.getVideoTracks?stream.getVideoTracks()[0]:null;
        if(track&&typeof track.getCapabilities==='function'&&typeof track.applyConstraints==='function'){
          try {const caps=track.getCapabilities();if(caps.focusMode&&caps.focusMode.includes('continuous'))Promise.resolve(track.applyConstraints({advanced:[{focusMode:'continuous'}]})).catch(()=>{})}catch(error){}
        }
        await this.video.play();
        if(!this.active||session!==this.session)return false;
        this.tick(session);return true;
      }catch(error){if(session===this.session)this.stop();throw error}
    }
    async tick(session) {
      if(!this.active||session!==this.session)return;
      try {
        if(this.video.readyState>=2&&this.video.videoWidth>0&&this.video.videoHeight>0){
          const raw=await this.reader.read(this.video,this.video.videoWidth,this.video.videoHeight);
          if(!this.active||session!==this.session)return;
          this.frames++;
          if(raw){if(this.onRead(raw)){this.stop();return}}
          else if(this.frames===1||this.frames%10===0)this.onProgress('Analizando la imagen… Mantén el QR completo dentro del recuadro, con buena luz y sin reflejos.');
        }else this.onProgress('Esperando la imagen de la cámara…');
      }catch(error){if(this.active&&session===this.session){this.stop();this.onError(error)}return}
      // Una sola lectura pendiente evita acumular trabajo en los teléfonos más lentos.
      if(this.active&&session===this.session)this.timer=setTimeout(()=>this.tick(session),180);
    }
    stop() {
      this.active=false;this.session++;clearTimeout(this.timer);this.timer=null;
      if(this.stream)this.stream.getTracks().forEach(t=>t.stop());
      this.stream=null;this.video.pause();this.video.srcObject=null;
    }
  }
  root.QrImageReader=QrImageReader;root.CameraQrScanner=CameraQrScanner;
})(typeof globalThis!=='undefined'?globalThis:this);
