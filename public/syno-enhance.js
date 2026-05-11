(function(){
  if(typeof window==='undefined')return;
  if(!window.location.pathname.includes('synomaster'))return;
  
  var st=document.createElement('style');
  st.id='syno-enhance-style';
  st.textContent='.grid.gap-3 button{font-size:1.75rem!important;padding:1.5rem 2rem!important;min-height:6rem!important;line-height:1.6!important;position:relative!important;font-weight:700!important}.grid.gap-3 button[data-m]::after{content:attr(data-m);display:block;font-size:1.25rem!important;color:#9ca3af;font-weight:400;margin-top:6px;line-height:1.3;pointer-events:none;opacity:0;transition:opacity .15s ease}body.syno-alt .grid.gap-3 button[data-m]::after{opacity:1!important;color:#dc2626!important;font-weight:700!important}.syno-error-meaning{display:block;font-size:1.25rem;color:#dc2626;font-weight:700;margin-top:6px;line-height:1.3;opacity:0;animation:synoFadeIn 0.3s ease forwards}@keyframes synoFadeIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(st);
  
  var mm={};
  function rebuildMm(){
    mm={};
    try{
      ['synomaster_synonym_data','synomaster_logic_data','synomaster_attitude_data'].forEach(function(k){
        JSON.parse(localStorage.getItem(k)||'[]').forEach(function(c){
          if(c.group&&Array.isArray(c.group))c.group.forEach(function(w){
            mm[w.toLowerCase().trim()]=c.meaning;
          });
        });
      });
    }catch(e){console.error('rebuildMm error:',e)}
  }
  rebuildMm();
  
  window.addEventListener('storage',function(e){
    if(e.key&&e.key.startsWith('synomaster_')){
      rebuildMm();
    }
  });
  
  function addMeaningAttrs(){
    document.querySelectorAll('.grid.gap-3 button').forEach(function(b){
      var w=b.textContent.trim();
      var m=mm[w.toLowerCase()];
      if(m&&!b.hasAttribute('data-m'))b.setAttribute('data-m',m);
    });
  }
  
  function setupSubmitHandler(){
    var sbtn=Array.from(document.querySelectorAll('button')).find(function(b){
      return b.textContent.trim()==='提交答案'||b.textContent.trim()==='提交'
    });
    if(!sbtn||sbtn.dataset.sd)return;
    
    sbtn.dataset.sd='1';
    sbtn.addEventListener('click',function(){
      setTimeout(function(){
        var rd=null;
        var divs=document.querySelectorAll('div');
        divs.forEach(function(d){
          if(d.textContent&&d.textContent.includes('正确答案')){
            rd=d;
          }
        });
        
        if(!rd){
          console.log('未找到正确答案元素');
          return;
        }
        
        var ct=rd.textContent.replace('正确答案：','').replace('正确答案:','').trim();
        var cs={};
        ct.split(/[、，,\\s]+/).forEach(function(w){cs[w.trim().toLowerCase()]=true});
        
        var selectedButtons=document.querySelectorAll('.grid.gap-3 button');
        selectedButtons.forEach(function(b){
          var btnText=b.textContent.trim();
          if(!btnText)return;
          
          var isSelected=b.classList.contains('border-emerald-400') || 
                         b.classList.contains('border-green-400') || 
                         b.classList.contains('ring-2') ||
                         b.style.borderColor ||
                         b.style.boxShadow;
          
          if(!isSelected)return;
          
          var w=btnText.toLowerCase();
          var origText=btnText;
          var m=mm[w];
          
          if(!cs[w]&&m){
            var meaningSpan=document.createElement('span');
            meaningSpan.className='syno-error-meaning';
            meaningSpan.textContent=m;
            b.appendChild(meaningSpan);
            
            setTimeout(function(){
              if(meaningSpan.parentNode===b){
                b.removeChild(meaningSpan);
              }
            },1000);
          }
        });
      },100);
    });
  }
  
  function en(){
    addMeaningAttrs();
    setupSubmitHandler();
  }
  
  var obs=new MutationObserver(function(){
    try{en()}catch(e){console.error('MutationObserver error:',e)}
  });
  obs.observe(document.body,{childList:true,subtree:true});
  
  document.addEventListener('keydown',function(e){
    if(e.key!=='Alt'||e.repeat)return;
    document.body.classList.add('syno-alt');
  });
  
  document.addEventListener('keyup',function(e){
    if(e.key!=='Alt')return;
    document.body.classList.remove('syno-alt');
  });
  
  setTimeout(en,200);
})();
