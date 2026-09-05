'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ClipboardCheck, LogOut, Search, Settings, Shield, Sparkles, Table2 } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { checkUrl, checkText, toDisplayResult, verdictLabel, getStats, ApiError, type DisplayResult, type StatsResponse } from '@/lib/api'
import { useCheckHistory, relativeTime, weeklyActivity, verdictSplit } from '@/lib/check-history'

function Sidebar({ section, setSection, onLogout }:{section:string;setSection:(value:string)=>void;onLogout:()=>void}) { return <aside className="app-sidebar"><Link href="/" className="brand sidebar-brand"><span className="brand-mark"><Shield size={17}/></span><span>Scam Detector</span></Link><div className="sidebar-label">WORKSPACE</div><nav className="sidebar-nav">{[['check','Check scam',ClipboardCheck],['history','History',Table2],['insights','Insights',BarChart3]].map(([id,label,Icon])=><button key={String(id)} className={section===id?'selected':''} onClick={()=>setSection(String(id))}><Icon size={17}/><span>{String(label)}</span></button>)}</nav><div className="sidebar-spacer"/><div className="sidebar-nav"><button className={section==='settings'?'selected':''} onClick={()=>setSection('settings')}><Settings size={17}/><span>Settings</span></button><button onClick={onLogout}><LogOut size={17}/><span>Log out</span></button></div></aside> }

function CheckView(){
  const [kind,setKind]=useState<'url'|'message'>('url')
  const [value,setValue]=useState('')
  const [loading,setLoading]=useState(false)
  const [result,setResult]=useState<DisplayResult|null>(null)
  const [error,setError]=useState('')
  const { add: addToHistory } = useCheckHistory()

  async function check(){
    if(!value.trim())return
    setLoading(true)
    setResult(null)
    setError('')
    try{
      const raw = kind==='url' ? await checkUrl(value) : await checkText(value)
      setResult(toDisplayResult(raw))
      addToHistory({ target: value, type: kind==='url'?'URL':'Message', verdict: raw.verdict, riskScore: raw.risk_score })
    }catch(err){
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }finally{
      setLoading(false)
    }
  }

  return <div className="dashboard-view">
    <div className="view-heading"><div><p className="eyebrow">QUICK CHECK</p><h1>Check before you click.</h1><p>Paste a URL or message and get a clear signal with the reasoning behind it.</p></div><span className="live-pill"><Sparkles size={13}/> Engine online</span></div>
    <div className="dashboard-check-card">
      <div className="input-toggle"><button className={kind==='url'?'selected':''} onClick={()=>setKind('url')}>URL</button><button className={kind==='message'?'selected':''} onClick={()=>setKind('message')}>Message</button></div>
      {kind==='url'?<input value={value} onChange={e=>setValue(e.target.value)} placeholder="https://example.com/offer" onKeyDown={e=>e.key==='Enter'&&!e.nativeEvent.isComposing&&check()}/>:<textarea value={value} onChange={e=>setValue(e.target.value)} placeholder="Paste a suspicious message..." rows={6}/>}
      <button className="primary-button" disabled={loading||!value.trim()} onClick={check}>{loading?'Analyzing…':'Analyze now'} <ClipboardCheck size={16}/></button>
      {error&&<p className="form-error">{error}</p>}
      {result&&<div className={`dashboard-result ${result.verdict==='safe'?'safe':'risk'}`}><div><strong>{verdictLabel(result.verdict)}</strong><p>{result.summary}</p></div><span>{result.confidence}% confidence</span></div>}
    </div>
  </div>
}

function HistoryView(){
  const { entries } = useCheckHistory()
  const [query,setQuery]=useState('')
  const filtered=useMemo(()=>entries.filter(item=>item.target.toLowerCase().includes(query.toLowerCase())||item.verdict.toLowerCase().includes(query.toLowerCase())),[entries,query])

  return <div className="dashboard-view">
    <div className="view-heading"><div><p className="eyebrow">CHECK HISTORY</p><h1>Your scan history.</h1><p>Checks you run in this dashboard, saved on this device.</p></div><div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search checks"/></div></div>
    {entries.length===0?<div className="empty-state"><Table2 size={28}/><h3>No checks yet</h3><p>Run a check from the Check scam tab and it will show up here.</p></div>:
    <div className="data-table-wrap"><table><thead><tr><th>Target</th><th>Type</th><th>Verdict</th><th>Risk</th><th>Checked</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><strong>{item.target}</strong></td><td>{item.type}</td><td>{verdictLabel(item.verdict)}</td><td><span className={`risk-dot ${item.verdict==='scam'?'high':item.verdict==='suspicious'?'medium':'low'}`}>{item.riskScore}</span></td><td>{relativeTime(item.time)}</td></tr>)}</tbody></table></div>}
  </div>
}

function InsightsView(){
  const { entries } = useCheckHistory()
  const activity = useMemo(()=>weeklyActivity(entries),[entries])
  const split = useMemo(()=>verdictSplit(entries),[entries])
  const totalThisWeek = activity.reduce((sum,day)=>sum+day.checks,0)

  if(entries.length===0){
    return <div className="dashboard-view"><div className="view-heading"><div><p className="eyebrow">YOUR INSIGHTS</p><h1>Patterns worth knowing.</h1><p>A simple view of how your checks are trending.</p></div></div><div className="empty-state"><BarChart3 size={28}/><h3>Nothing to show yet</h3><p>Run a few checks and your trends will appear here.</p></div></div>
  }

  return <div className="dashboard-view">
    <div className="view-heading"><div><p className="eyebrow">YOUR INSIGHTS</p><h1>Patterns worth knowing.</h1><p>A simple view of how your checks are trending.</p></div></div>
    <div className="chart-grid">
      <div className="chart-card"><div className="chart-card-title"><span>Checks this week</span><strong>{totalThisWeek}</strong></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={activity}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="day" stroke="var(--muted-foreground)"/><YAxis stroke="var(--muted-foreground)" allowDecimals={false}/><Tooltip/><Area type="monotone" dataKey="checks" stroke="var(--primary)" fill="color-mix(in srgb,var(--primary) 18%,transparent)"/></AreaChart></ResponsiveContainer></div></div>
      <div className="chart-card"><div className="chart-card-title"><span>Verdict mix</span><strong>This device</strong></div><div className="chart-box donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={split} dataKey="value" innerRadius={55} outerRadius={82} paddingAngle={4}>{split.map(item=><Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="legend">{split.map(item=><span key={item.name}><i style={{background:item.color}}/>{item.name} {item.value}%</span>)}</div></div></div>
    </div>
  </div>
}

export function UserDashboard(){
  const [section,setSection]=useState('check')
  const router=useRouter()
  const logout=async()=>{
    const supabase=createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return <div className="dashboard-layout"><Sidebar section={section} setSection={setSection} onLogout={logout}/><main className="dashboard-main"><div className="dashboard-topbar"><span className="mobile-brand">Scam Detector</span><Link href="/" className="back-link">Back to site</Link></div>{section==='check'?<CheckView/>:section==='history'?<HistoryView/>:section==='insights'?<InsightsView/>:<div className="dashboard-view"><div className="empty-state"><Settings size={28}/><h3>Workspace settings</h3><p>Settings and account controls will appear here.</p></div></div>}</main></div>
}

function AdminOverview(){
  const [stats,setStats]=useState<StatsResponse|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    let cancelled=false
    getStats()
      .then(data=>{ if(!cancelled) setStats(data) })
      .catch(err=>{ if(!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load stats.') })
      .finally(()=>{ if(!cancelled) setLoading(false) })
    return ()=>{ cancelled=true }
  },[])

  const categoryData = useMemo(()=>Object.entries(stats?.byCategory ?? {}).map(([category,count])=>({category,count})),[stats])
  const total = stats?.total ?? categoryData.reduce((sum,item)=>sum+item.count,0)

  return <div className="dashboard-view">
    <div className="view-heading"><div><p className="eyebrow">ADMIN OVERVIEW</p><h1>System intelligence.</h1><p>Monitor scans across the Scam Detector network.</p></div></div>
    {/* Only showing metrics the backend actually returns from /check/stats.
        High-risk rate / avg confidence / active users were hardcoded fake
        numbers in the old UI and have been dropped rather than kept as
        placeholders — wire them up here once the backend exposes them. */}
    <div className="admin-metrics">
      <div><span>Total checks</span><strong>{loading?'—':total.toLocaleString()}</strong></div>
    </div>
    {error&&<p className="form-error">Couldn&apos;t load stats: {error}</p>}
    {categoryData.length>0&&<div className="chart-card admin-chart"><div className="chart-card-title"><span>Checks by category</span><strong>All time</strong></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="category" stroke="var(--muted-foreground)"/><YAxis stroke="var(--muted-foreground)" allowDecimals={false}/><Tooltip/><Bar dataKey="count" fill="var(--primary)" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div></div>}
  </div>
}

export function AdminDashboard(){
  return <div className="dashboard-layout"><aside className="app-sidebar"><Link href="/" className="brand sidebar-brand"><span className="brand-mark"><Shield size={17}/></span><span>Scam Detector</span></Link><div className="sidebar-label">ADMIN CONSOLE</div><nav className="sidebar-nav"><button className="selected"><BarChart3 size={17}/><span>Overview</span></button></nav><div className="sidebar-spacer"/><Link className="sidebar-link" href="/">Exit console</Link></aside><main className="dashboard-main"><div className="dashboard-topbar"><span className="mobile-brand">Admin console</span><span className="status-badge safe">SYSTEM NOMINAL</span></div><AdminOverview/></main></div>
}