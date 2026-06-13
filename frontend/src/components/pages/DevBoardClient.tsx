// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, ROLE_COLORS, STATUS_BG, STATUS_TEXT } from '@/types'

export default function DevBoardClient({ session }: { session: SessionUser }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetch('/api/tasks').then(r=>r.json()), fetch('/api/users').then(r=>r.json()), fetch('/api/brands').then(r=>r.json())]).then(([t,u,b]) => { setTasks(Array.isArray(t)?t:[]); setUsers(Array.isArray(u)?u:[]); setBrands(Array.isArray(b)?b:[]); setLoading(false) })
  }, [])

  const devTasks = ['owner','manager'].includes(session.role) ? tasks.filter(t => t.type==='Development' || t.task_mode==='project') : tasks.filter(t => t.assigned_to?.includes(session.id) || (t.sub_tasks||[]).some((s:any) => s.assigned_to?.includes(session.id)))
  const mySub = devTasks.flatMap(t => (t.sub_tasks||[]).filter((s:any) => ['owner','manager'].includes(session.role) || s.assigned_to?.includes(session.id)).map((s:any) => ({...s, parent:t})))
  const subDone = mySub.filter(s => s.status==='Completed').length
  const getBrand = (id:string) => brands.find(b=>b.id===id)
  const getUser  = (id:string) => users.find(u=>u.id===id)

  if (loading) return <div style={{color:'var(--sf-muted)',padding:40,textAlign:'center'}}>Loading…</div>

  return (
    <div>
      <h2 style={{color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,marginBottom:20}}>Developer Board</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        {[['Tasks',devTasks.length,'#06B6D4'],['In Progress',devTasks.filter(t=>t.status==='In Progress').length,'#3B82F6'],['Sub-Tasks',mySub.length,'#8B5CF6'],['ST Done',subDone,'#10B981']].map(([l,v,c]) => (
          <div key={String(l)} style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:'18px 20px',borderLeft:`3px solid ${c}`}}>
            <div style={{color:'var(--sf-muted)',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{l}</div>
            <div style={{color:'var(--sf-text)',fontSize:26,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{v}</div>
          </div>
        ))}
      </div>
      {mySub.length>0 && (
        <div style={{marginBottom:26}}>
          <div style={{color:'var(--sf-text)',fontWeight:700,fontSize:15,fontFamily:"'Space Grotesk',sans-serif",marginBottom:12}}>My Sub-Task Assignments</div>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {mySub.map((st:any) => {
              const dl = st.due_date ? Math.ceil((new Date(st.due_date).getTime()-Date.now())/86400000) : null
              const late = dl!==null && dl<0 && st.status!=='Completed'
              return (
                <div key={st.id} style={{background:'var(--sf-surface)',border:'1px solid',borderColor:st.status==='Completed'?'rgba(16,185,129,0.3)':late?'rgba(239,68,68,0.3)':'var(--sf-border)',borderLeft:`3px solid ${st.status==='Completed'?'#10B981':late?'#EF4444':'#06B6D4'}`,borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',gap:14}}>
                  <div style={{flex:1}}>
                    <div style={{color:'var(--sf-muted)',fontSize:10,marginBottom:2}}>↳ {st.parent.title}</div>
                    <div style={{color:'var(--sf-text)',fontWeight:600,fontSize:13}}>{st.title}</div>
                    <div style={{color:'var(--sf-muted)',fontSize:11}}>{getBrand(st.parent.brand_id)?.name}</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{background:STATUS_BG[st.status]||'#F3F4F6',color:STATUS_TEXT[st.status]||'#374151',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5}}>{st.status}</span>
                    {dl!==null && <span style={{color:late?'#F87171':'var(--sf-muted)',fontSize:11}}>{late?`${Math.abs(dl)}d late`:`${dl}d`}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div style={{color:'var(--sf-text)',fontWeight:700,fontSize:15,fontFamily:"'Space Grotesk',sans-serif",marginBottom:12}}>Project Tasks</div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {devTasks.map((task:any) => {
          const brand = getBrand(task.brand_id)
          const sub = task.sub_tasks||[]
          const stDone = sub.filter((s:any) => s.status==='Completed').length
          const dl = task.due_date ? Math.ceil((new Date(task.due_date).getTime()-Date.now())/86400000) : null
          const late = dl!==null && dl<0 && task.status!=='Completed'
          return (
            <div key={task.id} style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:14,padding:'18px 20px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
                    {task.task_mode==='project' && <span style={{background:'rgba(6,182,212,0.15)',color:'#06B6D4',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4}}>PROJECT</span>}
                    <span style={{color:'var(--sf-text)',fontWeight:700,fontSize:15}}>{task.title}</span>
                  </div>
                  <div style={{color:'var(--sf-muted)',fontSize:11}}>{brand?.name} · {task.type}</div>
                </div>
                <div style={{display:'flex',gap:7,alignItems:'center'}}>
                  <span style={{background:STATUS_BG[task.status]||'#F3F4F6',color:STATUS_TEXT[task.status]||'#374151',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:5}}>{task.status}</span>
                </div>
              </div>
              {sub.length>0 && (
                <div style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <span style={{color:'var(--sf-muted)',fontSize:11}}>Sub-task progress</span>
                    <span style={{color:'#06B6D4',fontWeight:700,fontSize:11}}>{stDone}/{sub.length}</span>
                  </div>
                  <div style={{height:5,background:'var(--sf-surface-2)',borderRadius:3,marginBottom:10,overflow:'hidden'}}><div style={{width:`${sub.length>0?stDone/sub.length*100:0}%`,height:'100%',background:'#06B6D4',borderRadius:3}}/></div>
                  {sub.map((st:any) => (
                    <div key={st.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'var(--sf-surface-2)',borderRadius:7,marginBottom:5,border:`1px solid ${st.status==='Completed'?'#10B98130':'var(--sf-border-strong)'}`}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:st.status==='Completed'?'#10B981':st.status==='In Progress'?'#3B82F6':'var(--sf-muted-2)',flexShrink:0}}/>
                      <span style={{flex:1,color:st.status==='Completed'?'var(--sf-muted-2)':'#C0C0D0',fontSize:12,textDecoration:st.status==='Completed'?'line-through':'none'}}>{st.title}</span>
                      {(st.assigned_to||[]).map((uid:string) => { const u=getUser(uid); return u ? <div key={uid} style={{width:20,height:20,borderRadius:4,background:ROLE_COLORS[u.role]||'var(--sf-accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sf-text)',fontSize:8,fontWeight:700}}>{u.avatar||u.name?.slice(0,2)}</div> : null })}
                      <span style={{color:'var(--sf-muted-2)',fontSize:10}}>{st.due_date}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',gap:4}}>{(task.assigned_to||[]).slice(0,4).map((uid:string) => { const u=getUser(uid); return u ? <div key={uid} title={u.name} style={{width:24,height:24,borderRadius:5,background:ROLE_COLORS[u.role]||'var(--sf-accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sf-text)',fontWeight:700,fontSize:9}}>{u.avatar||u.name?.slice(0,2)}</div> : null })}</div>
                <div style={{display:'flex',gap:10}}>
                  <span style={{color:'var(--sf-muted)',fontSize:11}}>Due {task.due_date}</span>
                  <span style={{color:late?'#F87171':dl!==null&&dl<=7?'#FBBF24':'var(--sf-muted)',fontWeight:600,fontSize:11}}>{dl===null?'':late?`${Math.abs(dl)}d late`:`${dl}d`}</span>
                </div>
              </div>
            </div>
          )
        })}
        {devTasks.length===0 && <div style={{textAlign:'center',padding:48,color:'var(--sf-muted-2)'}}><div style={{fontSize:36,marginBottom:12}}>⌨</div><div>No development tasks yet.</div></div>}
      </div>
    </div>
  )
}