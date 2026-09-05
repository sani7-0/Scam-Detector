'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, FileSearch, ImagePlus, Link2, Menu, ShieldCheck, Sparkles, UploadCloud, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { checkUrl, checkText, checkImage, toDisplayResult, type DisplayResult } from '@/lib/api'
import { addHistoryEntry } from '@/lib/check-history'

function Mark(){return <div className="mark"><ShieldCheck size={18}/><span>SCAM DETECTOR</span></div>}
function Header(){const [open,setOpen]=useState(false);return <header className="site-header"><Link href="/"><Mark/></Link><nav className={open?'nav open':'nav'}><a href="/#how-it-works">How it works</a><a href="/#about">About</a><Link href="/dashboard">Dashboard</Link><Link className="nav-cta" href="/login">Sign in <ArrowRight size={14}/></Link></nav><button className="menu-button" onClick={()=>setOpen(!open)} aria-label="Toggle menu">{open?<X/>:<Menu/>}</button></header>}
function Verdict({result,onReset}:{result:DisplayResult;onReset:()=>void}){const danger=result.verdict!=='safe';return <section className="verdict"><div className="verdict-top"><span className={`status-badge ${danger?'danger':'safe'}`}>{result.verdict.toUpperCase()}</span><span className="confidence">{result.confidence}% confidence</span></div><div className="verdict-title"><span className={danger?'danger-dot':'safe-dot'}/><div><p className="eyebrow">VERDICT</p><h2>{result.verdict==='safe'?'Looks safe':result.verdict==='suspicious'?'Needs a closer look':'Likely a scam'}</h2></div></div><p className="verdict-copy">{result.summary}</p><div className="risk-meter"><span className={result.risk_score>20?'filled':''}/><span className={result.risk_score>40?'filled':''}/><span className={result.risk_score>60?'filled':''}/><span className={result.risk_score>80?'filled':''}/><span className={result.risk_score>90?'filled':''}/></div><div className="finding-list">{result.reasons.map(reason=><p key={reason}><CheckCircle2 size={14}/>{reason}</p>)}</div><button className="text-button" onClick={onReset}>← Check another</button></section>}
function HowItWorks(){const steps=[['1',FileSearch,'Paste a link or message','Share the link or message that made you pause.'],['2',Sparkles,'We analyze it instantly','We compare the signal against common fraud patterns.'],['3',ShieldCheck,'Get a clear verdict','See the answer and the exact reasons behind it.']];return <section className="how-section" id="how-it-works"><div className="section-heading centered"><p className="eyebrow">SIMPLE • FAST • FREE</p><h2>How it works</h2><p>From uncertainty to a clear next step in one calm, guided flow.</p></div><div className="process-flow">{steps.map(([number,Icon,title,copy])=><article className="process-step" key={String(number)}><div className="process-icon"><span className="step-badge">{number}</span><Icon size={30}/></div><h3>{title}</h3><p>{copy}</p></article>)}</div></section>}

type CheckerMode = 'input' | 'screenshot'

function Checker(){
  const [mode,setMode]=useState<CheckerMode>('input')
  const [inputType,setInputType]=useState<'link'|'message'>('link')
  const [value,setValue]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState('')
  const [loading,setLoading]=useState(false)
  const [result,setResult]=useState<DisplayResult|null>(null)
  const [error,setError]=useState('')
  const fileRef=useRef<HTMLInputElement>(null)

  const submit=async()=>{
    if((mode==='input'&&!value.trim())||(mode==='screenshot'&&!file))return
    setLoading(true)
    setError('')
    try{
      let raw: Awaited<ReturnType<typeof checkUrl>>
      if(mode==='screenshot'&&file){
        raw = await checkImage(file) // sends the actual image bytes, not just the filename
        addHistoryEntry({ target: file.name, type: 'Screenshot', verdict: raw.verdict, riskScore: raw.risk_score })
      }else if(inputType==='message'){
        raw = await checkText(value)
        addHistoryEntry({ target: value, type: 'Message', verdict: raw.verdict, riskScore: raw.risk_score })
      }else{
        raw = await checkUrl(value)
        addHistoryEntry({ target: value, type: 'URL', verdict: raw.verdict, riskScore: raw.risk_score })
      }
      setResult(toDisplayResult(raw))
    }catch(err){
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }finally{
      setLoading(false)
    }
  }

  const reset=()=>{setValue('');setFile(null);setPreview('');setResult(null);setLoading(false);setError('')}

  return <div className="checker-wrap">
    <div className="checker-tabs">
      <button className={mode==='input'?'active':''} onClick={()=>{setMode('input');setInputType('link');setResult(null);setError('')}}><Link2 size={16}/> URL or message</button>
      <button className={mode==='screenshot'?'active':''} onClick={()=>{setMode('screenshot');setResult(null);setError('')}}><ImagePlus size={16}/> Screenshot</button>
    </div>
    {result?<Verdict result={result} onReset={reset}/>:<div className="checker-body">
      {mode==='input'?<>
        <div className="input-toggle"><button className={inputType==='link'?'selected':''} onClick={()=>setInputType('link')}>Link</button><button className={inputType==='message'?'selected':''} onClick={()=>setInputType('message')}>Message</button></div>
        <label htmlFor="check-input">{inputType==='link'?'Paste a URL to analyze':'Paste a message to analyze'}</label>
        {inputType==='link'?<div className="input-row"><Link2 size={17}/><input id="check-input" value={value} onChange={e=>setValue(e.target.value)} placeholder="https://example.com/offer"/></div>:<textarea id="check-input" value={value} onChange={e=>setValue(e.target.value)} placeholder="Paste the suspicious message here..." rows={6}/>}
      </>:<>
        <label>Upload a screenshot</label>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e=>{const next=e.target.files?.[0];if(next){setFile(next);setPreview(URL.createObjectURL(next))}}}/>
        {file?<div className="upload-preview"><img src={preview} alt="Selected screenshot preview"/><button onClick={()=>{setFile(null);setPreview('');if(fileRef.current)fileRef.current.value=''}} aria-label="Remove screenshot"><X size={16}/></button></div>:<button className="drop-zone" onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const next=e.dataTransfer.files[0];if(next?.type.startsWith('image/')){setFile(next);setPreview(URL.createObjectURL(next))}}}><UploadCloud size={24}/><strong>Drop an image here</strong><span>or click to browse</span></button>}
      </>}
      <button className="primary-button full" disabled={loading||(!value.trim()&&!file)} onClick={submit}>{loading?<><Loader2 className="spin" size={16}/> Checking signals...</>:<>Check for scams <ArrowRight size={16}/></>}</button>
      {error&&<p className="form-error">{error}</p>}
      <p className="privacy-note"><CheckCircle2 size={13}/> Nothing is stored without your permission</p>
    </div>}
  </div>
}

export function LandingPage(){return <div className="app-shell"><Header/><main><section className="hero"><div className="hero-copy"><div className="live-pill"><span/> LIVE PROTECTION FOR THE WEB</div><h1>Don&apos;t get <em>scammed.</em><br/>Get a second opinion.</h1><p className="hero-sub">Scam Detector spots subtle signs of fraud in links, messages, and checkout pages before you click, pay, or share.</p><div className="hero-actions"><a className="primary-button" href="#check">Check something now <ArrowRight size={16}/></a><a className="quiet-link" href="#how-it-works">See how it works <ArrowRight size={15}/></a></div></div><div className="hero-signal"><div className="signal-header"><span>● ANALYSIS ENGINE</span><span>v2.4.1</span></div><div className="signal-grid"><p className="eyebrow">SIGNAL STATUS</p><strong>Ready when you are</strong><div className="scan-lines"><i/><i/><i/><i/><i/></div></div><div className="signal-footer"><span>Private signal review</span><span>Updated today</span></div></div></section><section className="check-section" id="check"><div className="section-heading"><div><p className="eyebrow">THE QUICK CHECK</p><h2>Before you trust it,<br/><span>run it through us.</span></h2></div><p>Drop in anything that feels off. We&apos;ll explain what we find in plain English.</p></div><Checker/></section><HowItWorks/><section className="about-section" id="about"><p className="eyebrow">THE BROWSER EXTENSION</p><h2>Protection that stays close to the moment.</h2><p>Install the Scam Detector extension to check suspicious links and messages without leaving the page you are viewing. Open the popup, paste what feels off, and get a concise verdict with the signals that influenced it.</p><div className="extension-info"><div><span className="eyebrow">QUICK ACCESS</span><strong>One click from your toolbar</strong><p>Keep the detector available while browsing email, shopping pages, social feeds, and support chats.</p></div><div><span className="eyebrow">PRIVATE BY DEFAULT</span><strong>Review before you act</strong><p>The extension gives you context first, so you can decide what to share and what to ignore.</p></div><div><span className="eyebrow">BUILT FOR CLARITY</span><strong>Reasons, not just warnings</strong><p>Every result explains the suspicious patterns in plain language instead of relying on a vague red flag.</p></div></div><a className="primary-button" href="#extension">See extension preview <ArrowRight size={15}/></a></section></main><footer><Mark/><span>Built for the moment before you click.</span></footer></div>}
export function AppPage({title,children}:{title:string;children:React.ReactNode}){return <div className="app-shell"><Header/><main className="subpage"><p className="eyebrow">SCAM DETECTOR</p><h1>{title}</h1>{children}</main><footer><Mark/><span>Built for the moment before you click.</span></footer></div>}

export function LoginPage(){
  const router=useRouter()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(password.length<8){setError('Password must be at least 8 characters.');return}
    setLoading(true)
    setError('')
    const supabase=createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if(authError){setError(authError.message);setLoading(false);return}
    router.push('/dashboard')
    router.refresh()
  }
  return <AppPage title="Welcome back"><form className="auth-card" onSubmit={submit}><p>Sign in to save checks and see your scan history.</p><label>Email address</label><input required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" type="email"/><label>Password</label><input required value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 characters minimum" type="password"/><button className="primary-button full" disabled={loading}>{loading?'Signing in...':<>Sign in <ArrowRight size={15}/></>}</button>{error&&<p className="form-error">{error}</p>}<p className="muted center">New here? <Link href="/signup">Create an account</Link></p></form></AppPage>
}

export function SignupPage(){
  const router=useRouter()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [error,setError]=useState('')
  const [info,setInfo]=useState('')
  const [loading,setLoading]=useState(false)
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(password.length<8)return setError('Password must be at least 8 characters.')
    if(password!==confirm)return setError('Passwords do not match.')
    setLoading(true)
    setError('')
    setInfo('')
    const supabase=createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if(authError){setError(authError.message);setLoading(false);return}
    if(data.session){
      router.push('/dashboard')
      router.refresh()
      return
    }
    // Email confirmation required before a session exists.
    setInfo('Check your email to confirm your account before signing in.')
    setLoading(false)
  }
  return <AppPage title="Create your account"><form className="auth-card" onSubmit={submit}><p>Start checking suspicious links and messages with your account.</p><label>Email address</label><input required value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com"/><label>Password</label><input required value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="8 characters minimum"/><label>Confirm password</label><input required value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" placeholder="Repeat your password"/><button className="primary-button full" disabled={loading}>{loading?'Creating account...':<>Create account <ArrowRight size={15}/></>}</button>{error&&<p className="form-error">{error}</p>}{info&&<p className="muted center">{info}</p>}<p className="muted center">Already have an account? <Link href="/login">Sign in</Link></p></form></AppPage>
}