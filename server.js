async function doSave(){
  const url = document.getElementById('urlInput').value.trim();
  if(!url) return alert('Paste link');
  const btn = document.querySelector('.save-btn');
  btn.textContent = 'Fetching...';
  btn.disabled = true;

  // Controller para i-abort ang request kung lumampas ng 8 segundo
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
    
    const data = await r.json();
    if(data.error) throw new Error(data.error);
    
    videoData = data;
    document.getElementById('vTitle').textContent = data.title;
    document.getElementById('vCreator').textContent = data.author;
    if(data.cover) document.getElementById('cover').innerHTML = `<img src="${data.cover}">`;
    document.getElementById('page1').style.display = 'none';
    document.getElementById('page2').style.display = 'block';
    window.scrollTo(0,0);
    document.getElementById('urlInput').value = '';
  } catch(e) {
    if (e.name === 'AbortError') {
      alert('Nag-timeout ang koneksyon. Subukan ulit o gumamit ng full tiktok.com link.');
    } else {
      alert('Failed: ' + e.message);
    }
  } finally {
    btn.textContent = 'Save HD Video';
    btn.disabled = false;
  }
}
