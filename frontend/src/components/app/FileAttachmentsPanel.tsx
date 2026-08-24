'use client'

import { useEffect, useState } from 'react'
import { DocumentViewer } from '@/components/app/DocumentViewer'
import { formatApiError } from '@/lib/apiErrors'

export function FileAttachmentsPanel({
  entityType,
  entityId,
  canUpload = true,
  title = 'Documents',
  excludeIds = [],
  onUploadComplete,
}: {
  entityType: 'task' | 'brand'
  entityId: string
  canUpload?: boolean
  title?: string
  excludeIds?: string[]
  onUploadComplete?: (payload: { task_status?: string }) => void
}) {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewing, setViewing] = useState<any | null>(null)

  async function load() {
    if (!entityId) {
      setFiles([])
      setLoading(false)
      return
    }
    setError('')
    const res = await fetch(`/api/attachments?entity_type=${entityType}&entity_id=${entityId}`)
    const data = await res.json().catch(() => [])
    if (!res.ok) {
      setError(formatApiError(data, 'Could not load files'))
      setFiles([])
    } else {
      setFiles(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, excludeIds.join('|')])

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !entityId) return
    const maxBytes = 100 * 1024 * 1024
    if (file.size > maxBytes) {
      setError('File is too large (max 100 MB)')
      e.target.value = ''
      return
    }
    setUploading(true)
    setError('')
    setNotice('')
    const form = new FormData()
    form.append('entity_type', entityType)
    form.append('entity_id', entityId)
    form.append('file', file)
    const res = await fetch('/api/attachments', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setUploading(false)
    e.target.value = ''
    if (!res.ok) {
      setError(formatApiError(data, 'Upload failed'))
      return
    }
    if (data.task_status) {
      setNotice(`Task moved to ${data.task_status} — manager will be notified for review.`)
      onUploadComplete?.({ task_status: data.task_status })
    }
    load()
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this file?')) return
    const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(formatApiError(data, 'Could not delete'))
      return
    }
    if (viewing?.id === id) setViewing(null)
    load()
  }

  function fmtSize(n: number) {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  const hidden = new Set(excludeIds.map(String))
  const visibleFiles = files.filter(f => !hidden.has(String(f.id)))

  if (!entityId) {
    return (
      <div className="sf-files-panel" style={{ borderStyle: 'dashed' }}>
        <p className="sf-files-panel-sub" style={{ margin: 0 }}>Save the brand first to upload and view documents.</p>
      </div>
    )
  }

  return (
    <div className="sf-files-panel">
      <div className="sf-files-panel-head">
        <div>
          <h3 className="sf-files-panel-title">{title}</h3>
          <p className="sf-files-panel-sub">Secure cloud storage — your existing files are kept safe.</p>
        </div>
        {canUpload && (
          <label className="sf-btn sf-btn-primary" style={{ fontSize: 11, padding: '6px 12px', cursor: uploading ? 'wait' : 'pointer', flexShrink: 0 }}>
            {uploading ? 'Uploading…' : '+ Upload'}
            <input type="file" hidden disabled={uploading} onChange={onUpload} />
          </label>
        )}
      </div>
      <div className="sf-files-trust">
        <span aria-hidden>☁️</span>
        <span>Files are stored in secure cloud storage (R2). Upload, preview, and download anytime.</span>
      </div>
      {error && <div style={{ color: '#F87171', fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {notice && <div style={{ color: 'var(--sf-success)', fontSize: 12, marginBottom: 8 }}>{notice}</div>}
      {loading ? (
        <div style={{ color: 'var(--sf-muted)', fontSize: 12 }}>Loading files…</div>
      ) : visibleFiles.length === 0 ? (
        <div style={{ color: 'var(--sf-muted-2)', fontSize: 12, padding: '8px 0' }}>
          No files yet. Upload briefs, designs, exports, or any deliverable.
        </div>
      ) : (
        <div>
          {visibleFiles.map((f) => (
            <div key={f.id} className="sf-files-row">
              <button type="button" className="sf-files-row-btn" onClick={() => setViewing(f)}>
                <div className="sf-files-row-name" title={f.file_name}>{f.file_name}</div>
                <div className="sf-files-row-meta">
                  {fmtSize(f.file_size || 0)}
                  {f.created_at ? ` · ${new Date(f.created_at).toLocaleString()}` : ''}
                  {f.review_status ? ` · ${f.review_status}` : ''}
                  {f.review_version ? ` · v${f.review_version}` : ''}
                </div>
              </button>
              {(f.review_history || []).length > 0 && (
                <ul className="sf-review-history sf-review-history-compact">
                  {[...(f.review_history || [])].reverse().slice(0, 4).map((h: any, i: number) => (
                    <li key={`${h.version}-${h.at}-${i}`} className={`sf-review-history-item sf-review-history-${h.status}`}>
                      <span>v{h.version} {h.status}</span>
                      <span>{h.at ? new Date(h.at).toLocaleString() : ''}</span>
                      {h.notes ? <span className="sf-review-history-notes-inline">{h.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              <div className="sf-doc-actions">
                <button type="button" onClick={() => setViewing(f)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>View</button>
                <a
                  href={`/api/attachments/${f.id}/download`}
                  download={f.file_name}
                  className="sf-btn sf-btn-ghost"
                  style={{ fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}
                >
                  Download
                </a>
                {canUpload && (
                  <button type="button" onClick={() => remove(f.id)} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 11 }}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <DocumentViewer file={viewing} open={!!viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
