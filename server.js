const express=require('express'),axios=require('axios'),cors=require('cors'),path=require('path'),https=require('https'),fs=require('fs');
const app=express();const PORT=process.env.PORT||3000;
app.use(cors());
app.use(express.json({limit:'10mb'})); 
app.use(express.static(path.join(__dirname,'public')));
const agent=new https.Agent({keepAlive:true, rejectUnauthorized: false});
const CFG_PATH=path.join(__dirname,'config.json');

function load(){
  try{
    if(fs.existsSync(CFG_PATH)){
      return JSON.parse(fs.readFileSync(CFG_PATH,'utf8'))
    }
  }catch(e){}
  return {
    ads:{page1:{code:''},page2:{code:''},modal:{code:'',height_4k:320,height_720:260}},
    site:{logo:'TikTok 4K Downloader.com',pill:'No watermark • Fast • HD 4K',headline:'Download TikTok Videos in 4K',sub:'Paste link below and save HD videos without watermark',footer:'Trusted by 10M+ downloads worldwide'},
    downloads:{btn4k_label:'Download 4K HD • 10s ad',btn720_label:'Download 720p • 5s ad',countdown_4k:10,countdown_720:5},
    greetings:{PH:'Kumusta kaibigan'}
  }
}

let MEMORY_CFG = load();
function save(c){
  MEMORY_CFG = JSON.parse(JSON.stringify(c)); 
  try{
    if(process.env.NODE_ENV !== 'production'){
      fs.writeFileSync(CFG_PATH,JSON.stringify(c,null,2))
    }
  }catch(e){ console.log('Save skip on Vercel:', e.message) }
}

app.get('/api/geo',async(req,res)=>{
  let country=(req.headers['x-vercel-ip-country']||'').toUpperCase();
  if(!country||country.length!=2){
    try{const r=await axios.get('https://ipapi.co/json/',{timeout:3000});country=(r.data.country_code||'US').toUpperCase()}catch(e){country='US'}
  }
  res.json({country_code:country})
});

app.get('/api/config',(req,res)=>{
  const c = process.env.NODE_ENV === 'production' ? MEMORY_CFG : load();
  res.json({ads:c.ads,site:c.site,downloads:c.downloads,greetings:c.greetings})
});

// OPTIMIZED DOWNLOAD ROUTE (DIRECT REQUEST, NO DELAY)
app.post('/api/download', async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response = await axios.get(apiUrl, {
      httpsAgent: agent,
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.tikwm.com/'
      }
    });

    if (response.data && response.data.data && response.data.data.play) {
      const d = response.data.data;
      return res.json({
        title: d.title || 'TikTok Video',
        author: d.author ? (d.author.nickname || d.author.unique_id || '@creator') : '@creator',
        cover: d.cover || d.origin_cover || d.ai_dynamic_cover || '',
        play: d.play || '',
        hdplay: d.hdplay || d.play || ''
      });
    }
    return res.status(500).json({ error: 'Failed to fetch video' });
  } catch (e) {
    console.log('API Error:', e.message);
    return res.status(500).json({ error: 'API error: TikTok blocked on Vercel. Try again.' });
  }
});

app.get('/api/force-download',async(req,res)=>{
  try{
    const r=await axios.get(req.query.url,{responseType:'stream',timeout:20000,httpsAgent:agent, headers:{'User-Agent':'Mozilla/5.0'}});
    res.setHeader('Content-Disposition','attachment; filename="tiktok-4k.mp4"');
    res.setHeader('Content-Type','video/mp4');
    r.data.pipe(res)
  }catch(e){res.status(500).send('failed')}
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT,()=>console.log('Running '+PORT));
}
module.exports = app;
