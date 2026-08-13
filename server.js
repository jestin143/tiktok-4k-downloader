
const express=require('express'),axios=require('axios'),cors=require('cors'),path=require('path'),https=require('https'),fs=require('fs');
const app=express();const PORT=process.env.PORT||3000;
app.use(cors());app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const agent=new https.Agent({keepAlive:true});
const CFG_PATH=path.join(__dirname,'config.json');
function load(){try{return JSON.parse(fs.readFileSync(CFG_PATH,'utf8'))}catch(e){return {ads:{page1:{code:''},page2:{code:''},modal:{code:'',height_4k:320,height_720:260}},site:{logo:'TikTok 4K Downloader.com',pill:'No watermark • Fast • HD 4K',headline:'Download TikTok Videos in 4K',sub:'Paste link below and save HD videos without watermark',footer:'Trusted by 10M+ downloads worldwide'},downloads:{btn4k_label:'Download 4K HD • 10s ad',btn720_label:'Download 720p • 5s ad',countdown_4k:10,countdown_720:5},admin:{email:process.env.ADMIN_EMAIL||'admin@admin.com',password:process.env.ADMIN_PASSWORD||'admin123'},greetings:{PH:'Kumusta kaibigan'}}}}
function save(c){try{fs.writeFileSync(CFG_PATH,JSON.stringify(c,null,2))}catch(e){}}
let TOKENS=new Set();
app.get('/api/geo',async(req,res)=>{let country=(req.headers['x-vercel-ip-country']||'').toUpperCase();if(!country||country.length!=2){try{const r=await axios.get('https://ipapi.co/json/',{timeout:3000});country=(r.data.country_code||'US').toUpperCase()}catch(e){country='US'}}res.json({country_code:country})});
app.get('/api/config',(req,res)=>{const c=load();res.json({ads:c.ads,site:c.site,downloads:c.downloads,greetings:c.greetings})});
app.post('/api/admin/login',(req,res)=>{const c=load();const {email,password}=req.body;const adminEmail=process.env.ADMIN_EMAIL||c.admin?.email||'admin@admin.com';const adminPass=process.env.ADMIN_PASSWORD||c.admin?.password||'admin123';if(email===adminEmail&&password===adminPass){const token=Buffer.from(Date.now()+':admin:'+email).toString('base64');TOKENS.add(token);return res.json({ok:true,token})}res.status(401).json({error:'Invalid credentials - Check ENV or config'})});
function auth(req,res,next){const t=req.headers['x-admin-token'];if(t&&TOKENS.has(t))return next();res.status(401).json({error:'Unauthorized'})}
app.get('/api/admin/config',auth,(req,res)=>res.json(load()));
app.post('/api/admin/config',auth,(req,res)=>{const c=load();const b=req.body;if(b.ads)c.ads=b.ads;if(b.site)c.site=b.site;if(b.downloads)c.downloads=b.downloads;if(b.greetings)c.greetings=b.greetings;if(b.admin){c.admin=b.admin;}save(c);res.json({ok:true,config:c})});
app.post('/api/download',async(req,res)=>{const{url}=req.body;if(!url)return res.status(400).json({error:'URL required'});try{const apiUrl=`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;const r=await axios.get(apiUrl,{httpsAgent:agent,timeout:12000});if(r.data&&r.data.data){const d=r.data.data;return res.json({title:d.title||'TikTok Video',author:d.author?(d.author.nickname||'@creator'):'@creator',cover:d.cover||'',play:d.play||'',hdplay:d.hdplay||d.play||''})}res.status(500).json({error:'Failed'})}catch(e){res.status(500).json({error:'API error'})}});
app.get('/api/force-download',async(req,res)=>{try{const r=await axios.get(req.query.url,{responseType:'stream',timeout:15000,httpsAgent:agent});res.setHeader('Content-Disposition','attachment; filename="tiktok-4k.mp4"');res.setHeader('Content-Type','video/mp4');r.data.pipe(res)}catch(e){res.status(500).send('failed')}});
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log('Running '+PORT));
