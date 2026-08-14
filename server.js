Const express=require('express'),axios=require('axios'),cors=require('cors'),path=require('path'),https=require('https'),fs=require('fs');
const app=express();const PORT=process.env.PORT||3000;
app.use(cors());app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const agent=new https.Agent({keepAlive:true, rejectUnauthorized: false});
const CFG_PATH=path.join(__dirname,'config.json');

// --- SUPER FAST CACHE 10 MINS ---
const CACHE = new Map();
function getCache(url){
  const c = CACHE.get(url);
  if(c && Date.now() - c.time < 10*60*1000) return c.data;
  if(c) CACHE.delete(url);
  return null;
}
function setCache(url,data){
  CACHE.set(url,{data,time:Date.now()});
  if(CACHE.size>200) CACHE.delete(CACHE.keys().next().value);
}

function load(){
  try{if(fs.existsSync(CFG_PATH)) return JSON.parse(fs.readFileSync(CFG_PATH,'utf8'))}catch(e){}
  return {
    ads:{page1:{code:''},page2:{code:''},modal:{code:'',height_4k:320,height_720:260}},
    site:{logo:'TikTok 4K Downloader.com',pill:'No watermark • Fast • HD 4K',headline:'Download TikTok Videos in 4K',sub:'Paste link below and save HD videos without watermark',footer:'Trusted by 10M+ downloads worldwide'},
    downloads:{btn4k_label:'Download 4K HD • 10s ad',btn720_label:'Download 720p • 5s ad',countdown_4k:10,countdown_720:5},
    admin:{email:process.env.ADMIN_EMAIL||'admin@admin.com',password:process.env.ADMIN_PASSWORD||'admin123'},
    greetings:{PH:'Kumusta kaibigan'}
  }
}
let MEMORY_CFG = load();
function save(c){
  MEMORY_CFG=c;
  try{if(process.env.NODE_ENV!=='production') fs.writeFileSync(CFG_PATH,JSON.stringify(c,null,2))}catch(e){}
}
let TOKENS=new Set();
app.get('/api/geo',async(req,res)=>{
  let country=(req.headers['x-vercel-ip-country']||'').toUpperCase();
  if(!country||country.length!=2) country='US'; // WAG NA TUMAWAG SA ipapi.co - super bagal!
  res.json({country_code:country})
});
app.get('/api/config',(req,res)=>{
  const c = process.env.NODE_ENV === 'production' ? MEMORY_CFG : load();
  res.json({ads:c.ads,site:c.site,downloads:c.downloads,greetings:c.greetings})
});
app.post('/api/admin/login',(req,res)=>{
  const c=load();const {email,password}=req.body;
  const adminEmail=process.env.ADMIN_EMAIL||c.admin?.email||'admin@admin.com';
  const adminPass=process.env.ADMIN_PASSWORD||c.admin?.password||'admin123';
  if(email===adminEmail&&password===adminPass){
    const token=Buffer.from(Date.now()+':admin:'+email).toString('base64');TOKENS.add(token);
    return res.json({ok:true,token})
  }
  res.status(401).json({error:'Invalid credentials'})
});
function auth(req,res,next){const t=req.headers['x-admin-token'];if(t&&TOKENS.has(t))return next();res.status(401).json({error:'Unauthorized'})}
app.get('/api/admin/config',auth,(req,res)=>res.json(process.env.NODE_ENV==='production'?MEMORY_CFG:load()));
app.post('/api/admin/config',auth,(req,res)=>{
  const c=process.env.NODE_ENV==='production'?MEMORY_CFG:load();const b=req.body;
  if(b.ads)c.ads=b.ads;if(b.site)c.site=b.site;if(b.downloads)c.downloads=b.downloads;if(b.greetings)c.greetings=b.greetings;if(b.admin)c.admin=b.admin;
  save(c);res.json({ok:true,config:c})
});

// --- SUPER FAST DOWNLOAD API - 2-3x BILIS ---
app.post('/api/download', async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  
  // CHECK CACHE FIRST - INSTANT!
  const cached = getCache(url);
  if(cached) return res.json(cached);

  try {
    // FAST expand vt/vm links - HEAD lang, hindi full GET
    if (url.includes('vt.tiktok.com') || url.includes('vm.tiktok.com') || url.includes('tiktok.com/t/')) {
      try{
        const r = await axios.head(url, { maxRedirects: 5, timeout: 3000, httpsAgent: agent });
        // fallback if head doesn't give final url
        url = r.request.res.responseUrl || url;
      }catch(e){
        try{
          const r2 = await axios.get(url, { maxRedirects: 5, timeout: 3500, httpsAgent: agent, headers:{'User-Agent':'Mozilla/5.0'} });
          url = r2.request.res.responseUrl || r2.request._redirectable?._currentUrl || url;
        }catch(e2){}
      }
    }

    // 3 APIS SABAY SABAY - KUNG SINO MAUNA, SYA MANANALO! (Promise.any)
    const fetchTikWM = async () => {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
      const r = await axios.get(apiUrl, { httpsAgent: agent, timeout: 4000, headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.tikwm.com/'} });
      if(r.data?.data?.play){
        const d=r.data.data;
        return { title:d.title||'TikTok Video', author:d.author?.nickname||d.author?.unique_id||'@creator', cover:d.cover||d.origin_cover||'', play:d.play||'', hdplay:d.hdplay||d.play||'' };
      }
      throw new Error('tikwm no play');
    };
    const fetchTikly = async () => {
      const r = await axios.post('https://api.tiklydown.eu.org/api/download', {url}, { timeout: 4000, headers:{'User-Agent':'Mozilla/5.0'} });
      if(r.data?.video?.noWatermark){
        return { title:r.data.title||'TikTok Video', author:r.data.author||'@creator', cover:r.data.cover||'', play:r.data.video.noWatermark, hdplay:r.data.video.noWatermarkHD||r.data.video.noWatermark };
      }
      throw new Error('tikly fail');
    };
    const fetchSSSTik = async () => {
      // backup 3
      const r = await axios.get(`https://tikcdn.io/api/download?url=${encodeURIComponent(url)}`, { timeout: 4000, httpsAgent: agent, headers:{'User-Agent':'Mozilla/5.0'} });
      if(r.data?.video?.noWatermark){
        return { title:r.data.title||'TikTok Video', author:'@creator', cover:'', play:r.data.video.noWatermark, hdplay:r.data.video.noWatermark };
      }
      throw new Error('ssstik fail');
    };

    let data;
    try{
      data = await Promise.any([fetchTikWM(), fetchTikly(), fetchSSSTik()]);
    }catch(e){
      // fallback to single tikwm if Promise.any all fail
      data = await fetchTikWM();
    }

    setCache(req.body.url, data); // cache original url
    setCache(url, data); // cache expanded url
    return res.json(data);

  } catch (e) {
    console.log('API Error:', e.message);
    return res.status(500).json({ error: 'Failed - Try full tiktok.com/video link' });
  }
});

app.get('/api/force-download',async(req,res)=>{
  try{
    const r=await axios.get(req.query.url,{responseType:'stream',timeout:15000,httpsAgent:agent, headers:{'User-Agent':'Mozilla/5.0'}});
    res.setHeader('Content-Disposition','attachment; filename="tiktok-4k.mp4"');
    res.setHeader('Content-Type','video/mp4');
    r.data.pipe(res)
  }catch(e){res.status(500).send('failed')}
});
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT,()=>console.log('Running '+PORT));
}
module.exports = app;
