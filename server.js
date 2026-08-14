const express=require('express'),axios=require('axios'),cors=require('cors'),path=require('path'),https=require('https'),fs=require('fs');
const app=express();const PORT=process.env.PORT||3000;
app.use(cors());
app.use(express.json({limit:'10mb'})); 
app.use(express.static(path.join(__dirname,'public')));
const agent=new https.Agent({keepAlive:true,keepAliveMsecs:1000,maxSockets:50,rejectUnauthorized:false});
const CFG_PATH=path.join(__dirname,'config.json');

// --- 3 SEC SECRET: CACHE! ---
const CACHE=new Map();
const getCache=u=>{const c=CACHE.get(u);if(c&&Date.now()-c.t<600000)return c.d;return null};
const setCache=(u,d)=>{CACHE.set(u,{d,t:Date.now()});if(CACHE.size>200)CACHE.clear()};

function load(){
  try{if(fs.existsSync(CFG_PATH))return JSON.parse(fs.readFileSync(CFG_PATH,'utf8'))}catch(e){}
  return {
    ads:{page1:{code:''},page2:{code:''},modal:{code:'',height_4k:320,height_720:260}},
    site:{logo:'TikTok 4K Downloader.com',pill:'No watermark • Fast • HD 4K',headline:'Download TikTok Videos in 4K',sub:'Paste link below and save HD videos without watermark',footer:'Trusted by 10M+ downloads worldwide'},
    downloads:{btn4k_label:'Download 4K HD • 10s ad',btn720_label:'Download 720p • 5s ad',countdown_4k:10,countdown_720:5},
    admin:{email:process.env.ADMIN_EMAIL||'admin@admin.com',password:process.env.ADMIN_PASSWORD||'admin123'},
    greetings:{PH:'Kumusta kaibigan'}
  }
}

let MEMORY_CFG=load();
function save(c){
  MEMORY_CFG=JSON.parse(JSON.stringify(c)); 
  try{if(process.env.NODE_ENV!=='production')fs.writeFileSync(CFG_PATH,JSON.stringify(c,null,2))}catch(e){}
}

let TOKENS=new Set();
app.get('/api/geo',async(req,res)=>{
  let country=(req.headers['x-vercel-ip-country']||'').toUpperCase();
  if(!country||country.length!=2){
    try{const r=await axios.get('https://ipapi.co/json/',{timeout:2500});country=(r.data.country_code||'US').toUpperCase()}catch(e){country='US'}
  }
  res.json({country_code:country})
});
app.get('/api/config',(req,res)=>{
  const c=process.env.NODE_ENV==='production'?MEMORY_CFG:load();
  res.json({ads:c.ads,site:c.site,downloads:c.downloads,greetings:c.greetings})
});
app.post('/api/admin/login',(req,res)=>{
  const c=process.env.NODE_ENV==='production'?MEMORY_CFG:load();
  const {email,password}=req.body;
  if(email===(process.env.ADMIN_EMAIL||c.admin.email)&&password===(process.env.ADMIN_PASSWORD||c.admin.password)){
    const token=Buffer.from(Date.now()+':admin').toString('base64');TOKENS.add(token);return res.json({ok:true,token})
  }
  res.status(401).json({error:'Invalid'})
});
function auth(req,res,next){const t=req.headers['x-admin-token'];if(t&&TOKENS.has(t))return next();res.status(401).json({error:'Unauthorized'})}
app.get('/api/admin/config',auth,(req,res)=>res.json(process.env.NODE_ENV==='production'?MEMORY_CFG:load()));
app.post('/api/admin/config',auth,(req,res)=>{
  const c=process.env.NODE_ENV==='production'?MEMORY_CFG:load();const b=req.body;
  if(b.ads){c.ads.page1.code=b.ads.page1?.code??c.ads.page1.code;c.ads.page2.code=b.ads.page2?.code??c.ads.page2.code;c.ads.modal.code=b.ads.modal?.code??c.ads.modal.code}
  if(b.site)c.site={...c.site,...b.site};if(b.downloads)c.downloads={...c.downloads,...b.downloads};if(b.greetings)c.greetings={...c.greetings,...b.greetings};
  save(c);res.json({ok:true,config:c})
});

// --- OPTIMIZED 3 SEC DOWNLOAD! ---
app.post('/api/download',async(req,res)=>{
  let {url}=req.body;if(!url)return res.status(400).json({error:'URL required'});

  // CACHE: 0.2 SEC NA LANG PAG NAULIT!
  const cached=getCache(url);
  if(cached) return res.json(cached);

  try{
    const apiUrl=`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response=await axios.get(apiUrl,{
      httpsAgent:agent,
      timeout:4000, // DATI 12000 → NGAYON 4000 = 3x FASTER!
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Accept':'application/json',
        'Referer':'https://www.tikwm.com/'
      }
    });
    if(response.data?.data?.play){
      const d=response.data.data;
      const result={
        title:d.title||'TikTok Video',
        author:d.author?.nickname||d.author?.unique_id||'@creator',
        cover:d.cover||d.origin_cover||'',
        play:d.play||'',
        hdplay:d.hdplay||d.play||''
      };
      setCache(url,result);
      setCache(req.body.url,result);
      return res.json(result);
    }
    return res.status(500).json({error:'Failed to fetch video'});
  }catch(e){
    console.log('API Error:',e.message);
    return res.status(500).json({error:'API error: Try full tiktok.com link'});
  }
});

app.get('/api/force-download',async(req,res)=>{
  try{
    const r=await axios.get(req.query.url,{responseType:'stream',timeout:15000,httpsAgent:agent,headers:{'User-Agent':'Mozilla/5.0'}});
    res.setHeader('Content-Disposition','attachment; filename="tiktok-4k.mp4"');res.setHeader('Content-Type','video/mp4');r.data.pipe(res)
  }catch(e){res.status(500).send('failed')}
});
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
if(process.env.NODE_ENV!=='production'){app.listen(PORT,()=>console.log('Running '+PORT));}
module.exports=app;
