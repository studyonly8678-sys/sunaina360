/* أدوات مشتركة: أصوات مولّدة، قصاصات احتفال، قراءة صوتية، ملء الشاشة */
var T = (function(){
  var ac=null, muted=false;
  function ctx(){ if(!ac){ try{ ac=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(ac&&ac.state==='suspended') ac.resume(); return ac; }
  function tone(f,d,type,vol,when,slide){
    var a=ctx(); if(!a||muted) return;
    var t=a.currentTime+(when||0), o=a.createOscillator(), g=a.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(slide,t+d);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||.25,t+.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+d+.05);
  }
  var S={
    correct:function(){ tone(660,.14,'triangle',.3); tone(880,.14,'triangle',.3,.12); tone(1320,.25,'triangle',.28,.24); },
    wrong:function(){ tone(300,.25,'sawtooth',.15,0,180); tone(200,.35,'sawtooth',.12,.2,120); },
    coin:function(){ tone(988,.08,'square',.12); tone(1319,.3,'square',.12,.08); },
    pop:function(){ tone(500,.12,'sine',.3,0,900); },
    whoosh:function(){ var a=ctx(); if(!a||muted) return; var b=a.createBuffer(1,a.sampleRate*.4,a.sampleRate),d=b.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length); var s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain(); f.type='bandpass'; f.frequency.setValueAtTime(400,a.currentTime); f.frequency.exponentialRampToValueAtTime(2500,a.currentTime+.35); g.gain.value=.35; s.buffer=b; s.connect(f); f.connect(g); g.connect(a.destination); s.start(); },
    grow:function(){ [523,659,784,1047].forEach(function(f,i){ tone(f,.22,'sine',.22,i*.08); }); },
    fanfare:function(){ [[523,0],[659,.15],[784,.3],[1047,.45],[784,.62],[1047,.78]].forEach(function(n){ tone(n[0],.3,'triangle',.28,n[1]); }); tone(1568,.8,'triangle',.22,.95); },
    tick:function(){ tone(1200,.04,'square',.06); },
    stamp:function(){ tone(140,.18,'square',.3,0,60); }
  };
  function play(n){ try{ S[n]&&S[n](); }catch(e){} }
  function say(text){
    if(muted||!window.speechSynthesis) return;
    try{ speechSynthesis.cancel(); var u=new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu,'')); u.lang='ar-SA'; u.rate=.9;
      var v=speechSynthesis.getVoices().filter(function(x){return /^ar/i.test(x.lang)})[0]; if(v) u.voice=v; speechSynthesis.speak(u); }catch(e){}
  }
  /* قصاصات */
  var cv,cx,parts=[],running=false;
  function confetti(n){
    if(!cv){ cv=document.createElement('canvas'); cv.id='confetti'; document.body.appendChild(cv); cx=cv.getContext('2d'); }
    cv.width=innerWidth; cv.height=innerHeight;
    var cols=['#ffb703','#2fbf71','#f0545c','#2b8cee','#9b5de5','#ff8fab'];
    for(var i=0;i<(n||120);i++) parts.push({x:innerWidth/2+(Math.random()-.5)*200,y:innerHeight*.45,vx:(Math.random()-.5)*16,vy:-Math.random()*18-6,r:Math.random()*8+5,c:cols[i%cols.length],a:Math.random()*6,va:(Math.random()-.5)*.4,life:0});
    if(!running){ running=true; loop(); }
  }
  function loop(){
    cx.clearRect(0,0,cv.width,cv.height);
    parts.forEach(function(p){ p.vy+=.45; p.vx*=.99; p.x+=p.vx; p.y+=p.vy; p.a+=p.va; p.life++;
      cx.save(); cx.translate(p.x,p.y); cx.rotate(p.a); cx.fillStyle=p.c; cx.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); cx.restore(); });
    parts=parts.filter(function(p){ return p.y<cv.height+40 && p.life<400; });
    if(parts.length) requestAnimationFrame(loop); else { running=false; cx.clearRect(0,0,cv.width,cv.height); }
  }
  function topbar(){
    var b=document.createElement('div'); b.className='topbar';
    b.innerHTML='<button class="ic" id="fsBtn" title="ملء الشاشة">⛶</button><button class="ic" id="muteBtn" title="الصوت">🔊</button>';
    document.body.appendChild(b);
    document.getElementById('fsBtn').onclick=function(){ try{ if(!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }catch(e){} };
    document.getElementById('muteBtn').onclick=function(){ muted=!muted; this.textContent=muted?'🔇':'🔊'; if(muted&&window.speechSynthesis) speechSynthesis.cancel(); };
    document.addEventListener('pointerdown',function(){ ctx(); },{once:true});
  }
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function $(s){ return document.querySelector(s); }
  function show(id){ document.querySelectorAll('.screen').forEach(function(s){ s.classList.toggle('on',s.id===id); }); }
  function restart(el,cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  return {play:play,say:say,confetti:confetti,topbar:topbar,shuffle:shuffle,$:$,show:show,restart:restart};
})();
