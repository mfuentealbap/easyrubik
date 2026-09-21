/* easyRubik Megaminx — motor independiente, sin dependencias.
 * Guardar como static/megaminx/megaminx.js (JavaScript, no .txt).
 * Resolver invierte el historial de esta sesión; no importa estados externos.
 */
(function (root) {
  'use strict';
  const EPS = 1e-7, CUT = 0.77, TURN = 2 * Math.PI / 5;
  const add = (a,b) => a.map((v,i)=>v+b[i]);
  const sub = (a,b) => a.map((v,i)=>v-b[i]);
  const mul = (a,s) => a.map(v=>v*s);
  const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const len = a => Math.hypot(...a);
  const unit = a => mul(a,1/(len(a)||1));
  const mean = vs => mul(vs.reduce(add,[0,0,0]),1/vs.length);
  function rotate(p,n,a) {
    const c=Math.cos(a),s=Math.sin(a);
    return add(add(mul(p,c),mul(cross(n,p),s)),mul(n,dot(n,p)*(1-c)));
  }
  const identity = () => [[1,0,0],[0,1,0],[0,0,1]];
  const transform = (m,p) => add(add(mul(m[0],p[0]),mul(m[1],p[1])),mul(m[2],p[2]));
  const colors = ['#f2f4f7','#57c990','#5ba7f4','#f1799b','#b296ed','#ffd45d',
    '#ff923e','#4ed5dd','#cd4b59','#386ebb','#b2dc60','#c9cbd1'];
  // Twelve equally spaced face normals: north, two staggered rings, south.
  const normals = [[0,1,0]];
  const ringY=1/Math.sqrt(5), ringR=2/Math.sqrt(5);
  for(let i=0;i<5;i++) normals.push([ringR*Math.sin(i*TURN),ringY,ringR*Math.cos(i*TURN)]);
  for(let i=0;i<5;i++) normals.push([ringR*Math.sin(i*TURN+TURN/2),-ringY,ringR*Math.cos(i*TURN+TURN/2)]);
  normals.push([0,-1,0]);
  function unique(vs) {
    return vs.filter((v,i)=>vs.findIndex(w=>len(sub(v,w))<EPS)===i);
  }
  function ordered(vs,n) {
    const c=mean(vs),u=unit(sub(vs[0],c)),v=cross(n,u);
    return vs.slice().sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));
  }
  function basePolyhedron() {
    const verts=[];
    for(let i=0;i<12;i++) for(let j=i+1;j<12;j++) for(let k=j+1;k<12;k++) {
      const a=normals[i],b=normals[j],c=normals[k],d=dot(a,cross(b,c));
      if(Math.abs(d)<EPS) continue;
      const p=mul(add(add(cross(b,c),cross(c,a)),cross(a,b)),1/d);
      if(normals.every(n=>dot(n,p)<=1+EPS)) verts.push(p);
    }
    return normals.map((n,i)=>({n,face:i,vs:ordered(unique(verts.filter(p=>Math.abs(dot(n,p)-1)<EPS)),n)}));
  }
  function clip(poly,n,d) {
    const result=[],cap=[];
    for(const f of poly) {
      const vs=[];
      for(let i=0;i<f.vs.length;i++) {
        const a=f.vs[i],b=f.vs[(i+1)%f.vs.length],da=dot(a,n)-d,db=dot(b,n)-d;
        if(da<=EPS) vs.push(a);
        if((da>EPS)!==(db>EPS)) {
          const p=add(a,mul(sub(b,a),da/(da-db)));vs.push(p);cap.push(p);
        }
      }
      const clean=unique(vs);
      if(clean.length>=3) result.push({...f,vs:clean});
    }
    const rim=unique(cap);
    if(rim.length>=3) result.push({n,face:-1,vs:ordered(rim,n)});
    return result;
  }
  function buildPieces() {
    const base=basePolyhedron(), masks=[];
    for(let a=0;a<12;a++) {
      masks.push([a]);
      for(let b=a+1;b<12;b++) if(dot(normals[a],normals[b])>0.44) {
        masks.push([a,b]);
        for(let c=b+1;c<12;c++) if(dot(normals[a],normals[c])>0.44&&dot(normals[b],normals[c])>0.44) masks.push([a,b,c]);
      }
    }
    return masks.map((faces,id)=>{
      let poly=base;
      for(let i=0;i<12;i++) poly=clip(poly,mul(normals[i],faces.includes(i)?-1:1),CUT*(faces.includes(i)?-1:1));
      if(!poly.length) throw new Error('Geometría vacía');
      const center=mean(unique(poly.flatMap(f=>f.vs)));
      const surfaces=poly.map(f=>({...f,vs:f.vs.map(p=>add(center,mul(sub(p,center),0.986))),color:'#181d26',sticker:false}));
      for(const f of poly.filter(f=>f.face>=0)) {
        const c=mean(f.vs),vs=f.vs.map(p=>add(c,mul(sub(p,c),0.91)));
        surfaces.push({...f,vs,color:colors[f.face],sticker:true});
      }
      return {id,faces,center,surfaces,m:identity()};
    });
  }
  class Model {
    constructor(){this.pieces=buildPieces();}
    layer(face){return this.pieces.filter(p=>p.faces.some(f=>dot(transform(p.m,normals[f]),normals[face])>1-EPS));}
    turn(face,dir){
      const layer=this.layer(face);
      if(layer.length!==11) throw new Error('Capa inválida: '+layer.length);
      for(const p of layer) p.m=p.m.map(v=>rotate(v,normals[face],dir*TURN));
    }
    reset(){for(const p of this.pieces) p.m=identity();}
    solved(){return this.pieces.every(p=>p.faces.every(f=>dot(transform(p.m,normals[f]),normals[f])>1-EPS));}
  }
  const API={Model,normals,rotate,transform,TURN,colors};
  if(typeof module!=='undefined'&&module.exports) module.exports=API;
  if(!root.document) return;

  function boot(){
    const $=id=>document.getElementById(id),canvas=$('stage'),status=$('status');
    if(!canvas) return;
    if(root.easyRubikMegaminx) return;
    const say=s=>{if(status&&status.textContent!==s)status.textContent=s;};
    let gl;
    try{gl=canvas.getContext('webgl',{antialias:true,alpha:true});}catch(_){}
    if(!gl){say('No se pudo iniciar WebGL. Activa la aceleración gráfica del navegador.');return;}
    const model=new Model();
    const vertex=`attribute vec3 position;attribute vec3 color;uniform float aspect;uniform float focal;varying vec3 tint;
      void main(){float d=position.z;gl_Position=vec4(position.x*focal/aspect,position.y*focal,1.020202*d-0.2020202,d);tint=color;}`;
    const fragment='precision mediump float;varying vec3 tint;void main(){gl_FragColor=vec4(tint,1.0);}';
    function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('No se pudo enlazar WebGL');
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [name,offset] of [['position',0],['color',12]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}
    const aspectLoc=gl.getUniformLocation(program,'aspect'),focalLoc=gl.getUniformLocation(program,'focal');
    gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    let yaw=-0.30,pitch=0.48,distance=4.65,width=1,height=1;
    let animation=null,queue=[],history=[],mode='',selected=0,drag=null,raf=0,drawFaces=[];
    const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);
    for(const p of model.pieces)for(const f of p.surfaces)f.rgb=rgb(f.color);
    const camera=p=>rotate(rotate(p,[0,1,0],yaw),[1,0,0],pitch);
    const focal=()=>2.7*Math.min(1,width/height);
    const project=p=>{const q=camera(p),d=distance-q[2];return [width/2+q[0]*focal()/d*height/2,height/2-q[1]*focal()/d*height/2];};
    const local=e=>{const r=drag?drag.rect:canvas.getBoundingClientRect(),w=drag?drag.width:width,h=drag?drag.height:height;return [(e.clientX-r.left)*w/r.width,(e.clientY-r.top)*h/r.height];};
    function sync(){
      const busy=!!animation||!!queue.length;
      if($('faceSelect'))$('faceSelect').disabled=busy;
      if($('btnCenter'))$('btnCenter').disabled=busy;
      for(const id of ['btnScramble','btnSolve','btnUndo']) if($(id))$(id).disabled=busy||((id==='btnSolve'||id==='btnUndo')&&!history.length);
      if($('btnStop')) $('btnStop').hidden=!busy;
      document.querySelectorAll('[data-turn]').forEach(b=>b.disabled=busy);
      if($('moveCount'))$('moveCount').textContent=history.length;
      if($('faceSelect'))$('faceSelect').value=String(selected);
    }
    function idle(){
      mode='';sync();say(model.solved()?'Megaminx listo · resuelto':`Cara ${selected+1} · ${history.length} movimientos en la sesión`);
    }
    function begin(move){
      const pieces=model.layer(move.face);
      if(pieces.length!==11)throw Error('Capa inválida');
      animation={from:0,angle:0,...move,ids:new Set(pieces.map(p=>p.id)),start:performance.now(),duration:mode?155:220};
      selected=move.face;sync();requestDraw();
    }
    function submit(face,dir){if(animation||queue.length)return;begin({face,dir,record:true});}
    function finish(){
      const a=animation;
      if(a.dir){model.turn(a.face,a.dir);if(a.record)history.push({face:a.face,dir:a.dir});else history.pop();}
      animation=null;
      if(queue.length)begin(queue.shift());else idle();
    }
    function requestDraw(){if(!raf)raf=requestAnimationFrame(render);}
    function render(now){
      raf=0;
      let angle=0;
      if(animation){
        if(animation.manual) angle=animation.angle;
        else {const t=Math.max(0,Math.min(1,(now-animation.start)/animation.duration));
          if(t===1)finish();else angle=animation.from+(animation.dir*TURN-animation.from)*(t*t*(3-2*t));}
      }
      const data=[];drawFaces=[];
      for(const p of model.pieces){
        const moving=animation&&animation.ids.has(p.id);
        const world=v=>{let w=transform(p.m,v);return moving?rotate(w,normals[animation.face],angle):w;};
        for(const f of p.surfaces){
          const n=camera(world(f.n)),shade=0.72+0.28*Math.max(0,dot(n,unit([-0.4,0.7,1])));
          const vs=f.vs.map(world),view=vs.map(camera);
          if(f.face>=0&&dot(n,sub([0,0,distance],mean(view)))>0){
            const wn=world(f.n),face=normals.findIndex(n=>dot(n,wn)>1-EPS);
            drawFaces.push({points:vs.map(project),vs,normal:wn,face,piece:p.id});
          }
          const tint=f.rgb.map(v=>v*shade);
          for(let i=1;i<view.length-1;i++)for(const v of [view[0],view[i],view[i+1]])data.push(v[0],v[1],distance-v[2],...tint);
        }
      }
      gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(aspectLoc,width/height);gl.uniform1f(focalLoc,focal());
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,data.length/6);
      if(animation&&!animation.manual)requestDraw();
    }
    function resize(){
      const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);
      const dpr=Math.min(root.devicePixelRatio||1,2),pw=Math.round(w*dpr),ph=Math.round(h*dpr);
      if(width===w&&height===h&&canvas.width===pw&&canvas.height===ph)return;
      if(drag)release({pointerId:drag.id},true);
      width=w;height=h;
      if(canvas.width!==pw)canvas.width=pw;
      if(canvas.height!==ph)canvas.height=ph;
      requestDraw();
    }
    function inside(p,poly){let sign=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],c=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);if(Math.abs(c)<0.01)continue;if(sign&&Math.sign(c)!==sign)return false;sign=Math.sign(c);}return true;}
    function hitAt(pos){
      // Intersect the camera ray with sticker planes; select nearest positive hit.
      const uncam=p=>rotate(rotate(p,[1,0,0],-pitch),[0,1,0],-yaw);
      const origin=uncam([0,0,distance]),ray=uncam([(pos[0]-width/2)/(height/2*focal()),-(pos[1]-height/2)/(height/2*focal()),-1]);
      let best=null,depth=Infinity;
      for(const f of drawFaces)if(f.face>=0&&inside(pos,f.points)){
        const t=dot(f.normal,sub(f.vs[0],origin))/dot(f.normal,ray);
        if(t>0&&t<depth){depth=t;best={...f,point:add(origin,mul(ray,t))};}
      }
      return best;
    }
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{
      if(drag||e.button>2)return;
      const pos=local(e),hit=(!animation&&e.button===0&&!e.shiftKey)?hitAt(pos):null;
      drag={id:e.pointerId,start:pos,last:pos,hit,active:false,rect:canvas.getBoundingClientRect(),width,height};
      canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});
      if(hit){
        selected=hit.face;
        const n=normals[hit.face],p=hit.point;
        drag.center=len(sub(p,mul(n,dot(n,p))))<0.20;
        const a=project(p),b=project(rotate(p,n,0.01));
        drag.tangent=[(b[0]-a[0])/0.01,(b[1]-a[1])/0.01];
        sync();say(`Cara ${selected+1} · arrastra y suelta para completar el giro`);
      }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const pos=local(e),delta=[pos[0]-drag.start[0],pos[1]-drag.start[1]];
      if(drag.hit){
        if(!drag.active&&Math.hypot(...delta)>5){
          drag.active=true;
          // Center gestures use the dominant initial direction, then keep it
          // locked for a predictable reversal when the pointer moves back.
          drag.centerAxis=Math.abs(delta[0])>=Math.abs(delta[1])?0:1;
          begin({face:drag.hit.face,dir:0,record:true,manual:true});
        }
        if(drag.active&&animation&&animation.manual){
          let angle;
          if(drag.center) angle=(drag.centerAxis===0?-delta[0]:delta[1])/80;
          else {const t=drag.tangent,l=Math.hypot(...t);angle=(delta[0]*t[0]+delta[1]*t[1])/(Math.max(l,40)*Math.max(l,1));}
          animation.angle=Math.max(-TURN,Math.min(TURN,angle));requestDraw();
        }
      }else{yaw+=(pos[0]-drag.last[0])*0.006;pitch+=(pos[1]-drag.last[1])*0.006;requestDraw();}
      drag.last=pos;e.preventDefault();
    });
    function release(e,cancel=false){
      if(!drag||drag.id!==e.pointerId)return;
      if(drag.active&&animation&&animation.manual){
        const a=animation;
        a.from=a.angle;a.dir=!cancel&&Math.abs(a.angle)>=TURN*0.18?Math.sign(a.angle):0;
        a.manual=false;a.start=performance.now();a.duration=160;requestDraw();
      }
      drag=null;
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    }
    canvas.addEventListener('pointerup',e=>release(e));
    canvas.addEventListener('pointercancel',e=>release(e,true));
    canvas.addEventListener('lostpointercapture',e=>release(e,true));
    root.addEventListener('blur',()=>{if(drag)release({pointerId:drag.id},true);});
    canvas.addEventListener('wheel',e=>{e.preventDefault();if(drag)return;distance=Math.max(3.9,Math.min(8,distance*Math.exp(e.deltaY*0.0007)));requestDraw();},{passive:false});
    canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();submit(selected,e.key==='ArrowLeft'?1:-1);}});
    const bind=(id,fn)=>{if($(id))$(id).addEventListener('click',fn);};
    bind('btnScramble',()=>{
      if(animation)return;mode='mezcla';let last=-1;
      for(let i=0;i<40;i++){let face;do{face=Math.floor(Math.random()*12);}while(face===last);last=face;queue.push({face,dir:Math.random()<0.5?1:-1,record:true});}
      say('Mezclando…');begin(queue.shift());
    });
    bind('btnSolve',()=>{
      if(animation||!history.length)return;mode='resolver';queue=history.slice().reverse().map(m=>({face:m.face,dir:-m.dir,record:false}));say('Deshaciendo los movimientos de esta sesión…');begin(queue.shift());
    });
    bind('btnUndo',()=>{if(animation||!history.length)return;const m=history[history.length-1];begin({face:m.face,dir:-m.dir,record:false});});
    bind('btnStop',()=>{queue=[];mode='';say('Deteniendo al terminar el giro actual…');});
    bind('btnReset',()=>{queue=[];animation=null;history=[];drag=null;model.reset();idle();requestDraw();});
    bind('btnCenter',()=>{yaw=-0.30;pitch=0.48;distance=4.65;requestDraw();});
    document.querySelectorAll('[data-turn]').forEach(b=>b.addEventListener('click',()=>submit(selected,Number(b.dataset.turn))));
    if($('faceSelect')){
      colors.forEach((color,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Cara ${i+1}`;$('faceSelect').appendChild(option);});
      $('faceSelect').addEventListener('change',()=>{
        selected=Number($('faceSelect').value);const n=normals[selected];yaw=-Math.atan2(n[0],n[2]);pitch=Math.atan2(n[1],Math.hypot(n[0],n[2]));say(`Cara ${selected+1} · usa ↶ o ↷ para girar`);requestDraw();
      });
    }
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();queue=[];if(raf)cancelAnimationFrame(raf);raf=0;say('Se perdió el contexto gráfico. Recarga la página para continuar.');});
    root.easyRubikMegaminx={version:'1.2',ready:true};
    new ResizeObserver(resize).observe(canvas.parentElement);root.addEventListener('resize',resize);
    resize();idle();
  }
  function start(){try{boot();}catch(err){const s=document.getElementById('status');if(s)s.textContent='No se pudo iniciar el Megaminx. Revisa la consola (F12).';console.error('easyRubik Megaminx:',err);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window==='undefined'?globalThis:window);
