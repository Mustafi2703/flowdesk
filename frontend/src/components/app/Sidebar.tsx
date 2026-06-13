'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SessionUser, NAV_ITEMS, ROLE_COLORS, ROLE_LABELS } from '@/types'

export default function Sidebar({ session }: { session: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const nav = NAV_ITEMS.filter(n => (n.roles as readonly string[]).includes(session.role))

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const roleColor = ROLE_COLORS[session.role] || '#E8630A'

  return (
    <aside style={{
      width: collapsed ? 58 : 214,
      background: '#111120',
      borderRight: '1px solid #1E1E35',
      display: 'flex',
      flexDirection: 'column',
      padding: '18px 10px',
      transition: 'width 0.2s',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <style>{`
        .sf-nav { display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;color:#6B6B8A;font-size:13px;font-weight:500;transition:all 0.15s;border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif }
        .sf-nav:hover { background:#1A1A2E;color:#A0A0C0 }
        .sf-nav.active { background:rgba(232,99,10,0.15);color:#E8630A }
        .sf-icon { font-size:15px;min-width:20px;text-align:center;line-height:1 }
      `}</style>

      {/* Logo */}
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'0 4px',marginBottom:22 }}>
        <div style={{ width:34,height:34,background:'#E8630A',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',fontSize:15,flexShrink:0,fontFamily:"'Space Grotesk',sans-serif" }}>S</div>
        {!collapsed && <span style={{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,color:'white',fontSize:15,whiteSpace:'nowrap' }}>Scrumfolks</span>}
      </div>

      {/* Nav */}
      <nav style={{ flex:1,display:'flex',flexDirection:'column',gap:1,overflowY:'auto' }}>
        {nav.map(item => {
          const active = pathname === `/${item.id}` || (pathname.startsWith(`/${item.id}/`) && item.id !== 'overview')
          return (
            <button key={item.id} className={`sf-nav ${active ? 'active' : ''}`} onClick={() => router.push(`/${item.id}`)}>
              <span className="sf-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ borderTop:'1px solid #1E1E35',paddingTop:14,marginTop:8 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 4px',marginBottom:6 }}>
          <div style={{ width:32,height:32,borderRadius:8,background:roleColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:12,flexShrink:0 }}>
            {session.avatar || session.name.slice(0,2).toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ overflow:'hidden' }}>
              <div style={{ color:'white',fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{session.name}</div>
              <div style={{ color:'#6B6B8A',fontSize:10 }}>{ROLE_LABELS[session.role]}</div>
            </div>
          )}
        </div>
        <button className="sf-nav" onClick={() => setCollapsed(c => !c)} style={{ marginBottom:2 }}>
          <span className="sf-icon">{collapsed ? '▶' : '◀'}</span>
          {!collapsed && 'Collapse'}
        </button>
        <button className="sf-nav" onClick={logout}>
          <span className="sf-icon">⇤</span>
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  )
}
