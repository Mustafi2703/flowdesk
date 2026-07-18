'use client'

import { useEffect, useState } from 'react'

export function FileAttachmentsPanel({
  entityType,
  entityId,
  canUpload = true,
  title = 'Files',
}: {
  entityType: 'task' | 'brand'
  entityId: string
  canUpload?: boolean
  title?: string
}) {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const res = await fetch(`/api/attachments?entity_type=${entityType}&entity_id=${entityId}`)
    const data = await res.json().catch(() => [])
    if (!res.ok) {
      setError(data.error || data.detail || 'Could not load files')
      setFiles([])
    } else {
      setFiles(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (entityId) load()
  }, [entityType, entityId])

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const form = new FormData()
    form.append('entity_type', entityType)
    form.append('entity_id', entityId)
    form.append('file', file)
    const res = await fetch('/api/attachments', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setUploading(false)
    e.target.value = ''
    if (!res.ok) {
      setError(data.error || data.detail || 'Upload failed')
      return
    }
    load()
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this file?')) return
    const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || data.detail || 'Could not delete')
      return
    }
    load()
  }

  function fmtSize(n: number) {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div style={{ background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</div>
        {canUpload && (
          <label className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 10px', cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? 'Uploading…' : '+ Upload'}
            <input type="file" hidden disabled={uploading} onChange={onUpload} />
          </label>
        )}
      </div>
      {error && <div style={{ color: '#F87171', fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--sf-muted)', fontSize: 12 }}>Loading files…</div>
      ) : files.length === 0 ? (
        <div style={{ color: 'var(--sf-muted-2)', fontSize: 12 }}>No files yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((f) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--sf-border)' }}>
              <div style={{ minWidth: 0 }}>
                <a href={`/api/attachments/${f.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  {f.file_name}
                </a>
                <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{fmtSize(f.file_size || 0)}</div>
              </div>
              <button type="button" onClick={() => remove(f.id)} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 11 }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
