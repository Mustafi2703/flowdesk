// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, ROLE_COLORS } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'

export default function PerformanceClient({ session }: { session: SessionUser }) {
  const [users, setUsers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [sel, setSel] = useState('all')
  const [period, setPeriod] = useState('monthly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(r=>r.json()),
      fetch('/api/tasks').then(r=>r.json()),
      fetch('/api/attendance').then(r=>r.json()),
      fetch('/api/leave').then(r=>r.json()),
    ]).then(([u,t,a,l]) => { setUsers(Array.isArray(u)?u:[]); setTasks(Array.isArray(t)?t:[]); setAttendance(Array.isArray(a)?a:[]); setLeaves(Array.isArray(l)?l:[]); setLoading(false) })
  }, [])

  function metrics(uid:string) {
    const ut = tasks.filter(t => t.assigned_to?.includes(uid))
    const total = ut.length
    const done = ut.filter(t=>t.status==='Completed').length
    const ip = ut.filter(t=>t.status==='In Progress').length
    const today = new Date().toISOString().split('T')[0]
    const overdue = ut.filter(t => t.due_date && t.due_date<today && t.status!=='Completed').length
    const strug = ut.filter(t => ['Struggling','Needs Attention'].includes(t.status)).length
    const ontime = total>0 ? Math.max(0, Math.round((done/Math.max(total,1))*100 - (overdue/Math.max(total,1))*30)) : 0
    const rate = total>0 ? Math.round(done/total*100) : 0
    const ua = attendance.filter(a => a.user_id===uid && a.hours_worked>0)
    const days = ua.length
    const avg = days>0 ? (ua.reduce((s,a) => s+(a.hours_worked||0), 0)/days).toFixed(1) : '0'
    const taken = leaves.filter(l => l.user_id===uid && l.status==='Approved').reduce((s,l) => s+l.days, 0)
    const perf = rate>=80?{label:'Excellent',color:'#10B981'}:rate>=60?{label:'Good',color:'#3B82F6'}:rate>=40?{label:'Average',color:'#FBBF24'}:{label:'Needs Support',color:'#EF4444'}
    return { total, done, ip, overdue, strug, ontime, rate, days, avg, taken, perf }
  }

  const teamU = users.filter(u => ['team','developer'].includes(u.role))
  const tm = teamU.map(u => ({user:u, ...metrics(u.id)}))
  const sm = sel!=='all' ? metrics(sel) : null
  const su = users.find(u => u.id===sel)

  if (loading) return <div style={{color:'var(--sf-muted)',padding:40,textAlign:'center'}}>Loading…</div>

  return (
    <PageShell>
      <PageHeader title="Performance" subtitle="Team metrics and individual drill-down" />
      <Section title="Filters" style={{ flexShrink: 0 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:'8px 12px',background:'var(--sf-surface-2)',border:'1px solid var(--sf-border)',borderRadius:9,color:'var(--sf-text)',fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
          <option value="all">All Team — Overview</option>
          {teamU.map(u=><option key={u.id} value={u.id}>{u.name} ({u.designation})</option>)}
        </select>
        <div style={{display:'flex',background:'var(--sf-surface-2)',border:'1px solid var(--sf-border)',borderRadius:9,overflow:'hidden'}}>
          {['monthly','quarterly','yearly'].map(p => <button key={p} onClick={()=>setPeriod(p)} style={{padding:'7px 14px',background:period===p?'var(--sf-accent)':'transparent',border:'none',color:period===p?'white':'var(--sf-muted)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",textTransform:'capitalize'}}>{p}</button>)}
        </div>
        </div>
      </Section>
      {sel!=='all' && sm && su && (
        <Section title={su.name} subtitle={`${su.designation} · ${su.department}`} flex={1}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:14}}>
            {[['Assigned',sm.total,'#3B82F6'],['Completed',sm.done,'#10B981'],['In Progress',sm.ip,'var(--sf-accent)'],['Overdue',sm.overdue,'#EF4444']].map(([l,v,c]) => (
              <StatCard key={String(l)} label={String(l)} value={v as any} accent={String(c)} />
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            {[['Flagged',sm.strug,'#F59E0B'],['Days Present',sm.days,'#8B5CF6'],['Avg Hours',`${sm.avg}h`,'#06B6D4'],['Leaves',sm.taken,'#EC4899']].map(([l,v,c]) => (
              <StatCard key={String(l)} label={String(l)} value={v as any} accent={String(c)} />
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
            <div style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:20}}>
              <div style={{color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Metrics</div>
              {[['Completion Rate',sm.rate,'#10B981'],['On-Time Delivery',sm.ontime,'#3B82F6'],['Attendance',Math.min(100,Math.round(sm.days/22*100)),'var(--sf-accent)']].map(([l,v,c]) => (
                <div key={String(l)} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{color:'#A0A0C0',fontSize:12}}>{l}</span><span style={{color:String(c),fontWeight:700,fontSize:12}}>{v}%</span></div>
                  <div style={{height:6,background:'var(--sf-surface-2)',borderRadius:3,overflow:'hidden'}}><div style={{width:`${v}%`,height:'100%',background:String(c),borderRadius:3}}/></div>
                </div>
              ))}
            </div>
            <div style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:20}}>
              <div style={{color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Monthly Activity</div>
              <Bars data={['Jan','Feb','Mar','Apr','May'].map((m,i)=>({label:m,value:Math.max(0,sm.done-(4-i)*2)}))} color="#10B981" />
            </div>
          </div>
          <div style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:20}}>
            <div style={{color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Task Breakdown</div>
            {[['Completed',sm.done,'#10B981'],['In Progress',sm.ip,'#3B82F6'],['Overdue',sm.overdue,'#EF4444'],['Struggling',sm.strug,'#F59E0B']].map(([l,v,c]) => (
              <div key={String(l)} style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <div style={{width:90,color:'#A0A0C0',fontSize:12}}>{l}</div>
                <div style={{flex:1,height:6,background:'var(--sf-surface-2)',borderRadius:3,overflow:'hidden'}}><div style={{width:sm.total>0?`${(v as number)/sm.total*100}%`:'0%',height:'100%',background:String(c),borderRadius:3}}/></div>
                <div style={{color:String(c),fontWeight:700,fontSize:13,width:22,textAlign:'right'}}>{v}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {sel==='all' && (
        <>
          <StatGrid>
            <StatCard label="Team size" value={teamU.length} accent="var(--sf-accent)" />
            <StatCard label="Total tasks" value={tasks.length} accent="#3B82F6" />
            <StatCard label="Avg completion" value={`${Math.round(tm.reduce((s,m)=>s+m.rate,0)/Math.max(tm.length,1))}%`} accent="#10B981" />
            <StatCard label="Total overdue" value={tm.reduce((s,m)=>s+m.overdue,0)} accent="#EF4444" />
          </StatGrid>
          <Section title="Team tasks" subtitle="Jan to May" style={{ flexShrink: 0 }}>
            <Bars data={[{label:'Jan',value:18},{label:'Feb',value:22},{label:'Mar',value:19},{label:'Apr',value:28},{label:'May',value:24}]} color="#10B981" height={80} />
          </Section>
          <Section title="Team overview" subtitle="Click a row to drill into individual performance" flush flex={1}>
            <div style={{ minWidth: 900 }}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 1.5fr',padding:'12px 20px',borderBottom:'1px solid var(--sf-border)',background:'var(--sf-surface-2)'}}>
              {['Member','Assigned','Done','Overdue','On-Time%','Attendance','Performance'].map(h=><div key={h} style={{color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</div>)}
            </div>
            {tm.map(({user,total,done,overdue,ontime,days,perf}) => (
              <div key={user.id} onClick={()=>setSel(user.id)} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 1.5fr',padding:'13px 20px',borderBottom:'1px solid #1A1A2E',alignItems:'center',cursor:'pointer'}}>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <div style={{width:30,height:30,borderRadius:7,background:ROLE_COLORS[user.role]||'var(--sf-accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sf-text)',fontWeight:700,fontSize:11}}>{user.avatar||user.name?.slice(0,2)}</div>
                  <div><div style={{color:'var(--sf-text)',fontSize:12,fontWeight:600}}>{user.name}</div><div style={{color:'var(--sf-muted)',fontSize:10}}>{user.designation}</div></div>
                </div>
                <div style={{color:'#A0A0C0',fontWeight:700}}>{total}</div>
                <div style={{color:'#10B981',fontWeight:700}}>{done}</div>
                <div style={{color:overdue>0?'#EF4444':'var(--sf-muted)',fontWeight:700}}>{overdue}</div>
                <div>
                  <div style={{color:ontime>=80?'#10B981':ontime>=60?'#FBBF24':'#EF4444',fontWeight:700,fontSize:13}}>{ontime}%</div>
                </div>
                <div style={{color:'#A0A0C0',fontSize:12}}>{days}d</div>
                <span style={{background:perf.color+'20',color:perf.color,fontSize:11,padding:'3px 8px',borderRadius:5,fontWeight:700}}>{perf.label}</span>
              </div>
            ))}
            </div>
          </Section>
        </>
      )}
    </PageShell>
  )
}

function Bars({ data, color, height=60 }: any) {
  const max = Math.max(...data.map((d:any) => d.value), 1)
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height}}>
      {data.map((d:any, i:number) => (
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
          <div style={{color:'var(--sf-muted)',fontSize:10,fontWeight:700}}>{d.value}</div>
          <div style={{width:'100%',background:color,borderRadius:'3px 3px 0 0',height:`${Math.max(4,(d.value/max)*(height-24))}px`}} />
          <div style={{color:'var(--sf-muted-2)',fontSize:9}}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}