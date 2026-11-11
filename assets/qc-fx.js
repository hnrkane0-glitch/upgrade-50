/* QuickCart FX: click ripple, magnetic CTA buttons, top flow bar, icon pop on click. Zero dependencies. */
(function(){
  'use strict';
  var RIP='.tb-btn,.pm,.cp,.co-btn,.lp-btn,.reg-cta,.btn,.dapp,.cqb,.qc-btn,.qc-ripple,.nav-item,.sb-item,button.primary,.btn-p';
  document.addEventListener('pointerdown',function(e){
    var t=e.target.closest&&e.target.closest(RIP); if(!t||t.disabled) return;
    var cs=getComputedStyle(t); if(cs.position==='static') t.style.position='relative';
    t.classList.add('qc-ripple-host');
    var r=t.getBoundingClientRect(),d=Math.max(r.width,r.height)*2,s=document.createElement('span');
    s.className='qc-rip';s.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-r.left-d/2)+'px;top:'+(e.clientY-r.top-d/2)+'px';
    t.appendChild(s);setTimeout(function(){s.remove();},650);
  },{passive:true});
  // magnetic hover on big CTAs (fine pointers only)
  if(matchMedia('(hover:hover) and (pointer:fine)').matches){
    document.addEventListener('pointermove',function(e){
      var t=e.target.closest&&e.target.closest('.lp-btn.lg,.reg-cta,.qc-mag'); 
      if(!t){return;} var r=t.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)*.14,y=(e.clientY-r.top-r.height/2)*.22;
      t.classList.add('qc-mag');t.style.transform='translate('+x+'px,'+y+'px)';
    },{passive:true});
    document.addEventListener('pointerout',function(e){var t=e.target.closest&&e.target.closest('.qc-mag');if(t)t.style.transform='';},{passive:true});
  }
  // flow bar — public API used by the router and any page: QCFlow.start() / QCFlow.done()
  var bar,tm;
  function el(){if(!bar){bar=document.createElement('div');bar.id='qc-flow';(document.body||document.documentElement).appendChild(bar);}return bar;}
  window.QCFlow={
    start:function(){var b=el();clearInterval(tm);b.style.opacity=1;b.style.width='8%';var w=8;tm=setInterval(function(){w+=(92-w)*.12;b.style.width=w+'%';},180);},
    done:function(){var b=el();clearInterval(tm);b.style.width='100%';setTimeout(function(){b.style.opacity=0;setTimeout(function(){b.style.width='0'},300);},260);}
  };
  window.addEventListener('beforeunload',function(){window.QCFlow.start();});
})();
