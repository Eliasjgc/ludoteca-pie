(function(root){
  'use strict';
  class CameraQrScanner {
    constructor(video,{decode,onRead,onError}) {
      this.video=video; this.decode=decode; this.onRead=onRead; this.onError=onError;
      this.canvas=document.createElement('canvas'); this.context=this.canvas.getContext('2d',{willReadFrequently:true});
      this.session=0; this.stream=null; this.timer=null; this.active=false;
    }
    async start() {
      this.stop(); const session=this.session; this.active=true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.active=false; throw Error('CAMERA_UNAVAILABLE'); }
      if (typeof this.decode!=='function') { this.active=false; throw Error('DECODER_UNAVAILABLE'); }
      try {
        const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
        if (!this.active || session!==this.session) { stream.getTracks().forEach(t=>t.stop()); return false; }
        this.stream=stream; this.video.srcObject=stream; this.video.muted=true;
        await this.video.play();
        if (!this.active || session!==this.session) return false;
        this.tick(session); return true;
      } catch(error) { if(session===this.session)this.stop(); throw error; }
    }
    tick(session) {
      if(!this.active || session!==this.session)return;
      try {
        if(this.video.readyState>=2 && this.video.videoWidth>0){
          const ratio=Math.min(1,960/this.video.videoWidth);
          this.canvas.width=Math.round(this.video.videoWidth*ratio); this.canvas.height=Math.round(this.video.videoHeight*ratio);
          this.context.drawImage(this.video,0,0,this.canvas.width,this.canvas.height);
          const frame=this.context.getImageData(0,0,this.canvas.width,this.canvas.height);
          const code=this.decode(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
          if(code && this.onRead(code.data)) { this.stop(); return; }
        }
      } catch(error) { this.stop(); this.onError(error); return; }
      if(this.active && session===this.session)this.timer=setTimeout(()=>this.tick(session),140);
    }
    stop() {
      this.active=false; this.session++; clearTimeout(this.timer); this.timer=null;
      if(this.stream)this.stream.getTracks().forEach(t=>t.stop());
      this.stream=null; this.video.pause(); this.video.srcObject=null;
    }
  }
  root.CameraQrScanner=CameraQrScanner;
})(typeof globalThis!=='undefined'?globalThis:this);
