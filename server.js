async function doSave(){
  const url = document.getElementById('urlInput').value.trim();
  if(!url) return alert('Paste link');
  const btn = document.querySelector('.save-btn');
  const originalText = btn.textContent;
  
  // --- BROWSER CACHE PARA INSTANT PAG INULIT ---
  const cacheKey = 'tiktok_cache_'+url;
  const cached = localStorage.getItem(cacheKey);
  if(cached){
    try{
      const data = JSON.parse(cached);
      if(Date.now() - data._time < 600000){ // 10 mins
        videoData = data;
        document.getElementById('vTitle').textContent = data.title;
        document.getElementById('vCreator').textContent = data.author;
        if(data.cover) document.getElementById('cover').innerHTML = `<img src="${data.cover}">`;
        document.getElementById('page1').style.display='none';
        document.getElementById('page2').style.display='block';
        window.scrollTo(0,0);
        document.getElementById('urlInput').value='';
        return;
      }
    }catch(e){}
  }

  btn.textContent = 'Fetching...';
  btn.disabled = true;
  let dots = 0;
  const dotInt = setInterval(()=>{ dots=(dots+1)%4; btn.textContent='Fetching'+'.'.repeat(dots); }, 250);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const r = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    clearInterval(dotInt);
    
    const data = await r.json();
    if(data.error) throw new Error(data.error);
    
    // SAVE TO BROWSER CACHE
    data._time = Date.now();
    try{ localStorage.setItem(cacheKey, JSON.stringify(data)); }catch(e){}
    
    videoData = data;
    document.getElementById('vTitle').textContent = data.title;
    document.getElementById('vCreator').textContent = data.author;
    if(data.cover) document.getElementById('cover').innerHTML = `<img src="${data.cover}">`;
    document.getElementById('page1').style.display = 'none';
    document.getElementById('page2').style.display = 'block';
    window.scrollTo(0,0);
    document.getElementById('urlInput').value = '';
  } catch(e) {
    clearInterval(dotInt);
    if (e.name === 'AbortError') {
      alert('⏱️ Mabagal si TikTok! Subukan ulit o gumamit ng full tiktok.com/video link.');
    } else {
      alert('Failed: ' + e.message);
    }
  } finally {
    clearTimeout(timeoutId);
    clearInterval(dotInt);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
