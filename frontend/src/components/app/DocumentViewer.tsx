'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/app/Modal'

function isImage(mime?: string | null, name?: string) {
  if (mime?.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(name || '')
}

function isPdf(mime?: string | null, name?: string) {
  if (mime === 'application/pdf') return true
  return /\.pdf$/i.test(name || '')
}

function isText(mime?: string | null, name?: string) {
  if (mime?.startsWith('text/')) return true
  return /\.(txt|md|csv|json|log)$/i.test(name || '')
}

/** In-app document viewer — opens on click instead of relying on a raw download tab. */
export function DocumentViewer({
  file,
  open,
  onClose,
}: {
  file: { id: string; file_name: string; mime_type?: string | null; file_size?: number } | null
  open: boolean
  onClose: () => void
}) {
  const [textPreview, setTextPreview] = useState('')
  const [loadingText, setLoadingText] = useState(false)
  const url = file ? `/api/attachments/${file.id}` : ''

  useEffect(() => {
    if (!open || !file || !isText(file.mime_type, file.file_name)) {
      setTextPreview('')
      return
    }
    setLoadingText(true)
    fetch(url)
      .then(r => r.text())
      .then(t => setTextPreview(t.slice(0, 20000)))
      .catch(() => setTextPreview('Could not load preview.'))
      .finally(() => setLoadingText(false))
  }, [open, file?.id, url])

  if (!file) return null

  const image = isImage(file.mime_type, file.file_name)
  const pdf = isPdf(file.mime_type, file.file_name)
  const text = isText(file.mime_type, file.file_name)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={file.file_name}
      subtitle={file.mime_type || 'Document'}
      width={860}
      zIndex={1200}
      footer={
        <>
          <a href={url} download={file.file_name} className="sf-btn sf-btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
            Download
          </a>
          <a href={url} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
            Open tab
          </a>
          <button type="button" className="sf-btn sf-btn-primary" onClick={onClose}>Close</button>
        </>
      }
    >
      <div style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sf-bg)', borderRadius: 10, border: '1px solid var(--sf-border)', overflow: 'hidden' }}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.file_name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
        )}
        {pdf && (
          <iframe title={file.file_name} src={url} style={{ width: '100%', height: '70vh', border: 'none' }} />
        )}
        {text && (
          <pre style={{ margin: 0, padding: 16, width: '100%', maxHeight: '70vh', overflow: 'auto', color: 'var(--sf-text-secondary)', fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {loadingText ? 'Loading…' : textPreview}
          </pre>
        )}
        {!image && !pdf && !text && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ color: 'var(--sf-text)', fontWeight: 600, marginBottom: 8 }}>Preview not available</div>
            <div style={{ color: 'var(--sf-muted)', fontSize: 13, marginBottom: 14 }}>Use Download or Open tab for this file type.</div>
            <a href={url} target="_blank" rel="noreferrer" className="sf-btn sf-btn-primary" style={{ textDecoration: 'none' }}>Open file</a>
          </div>
        )}
      </div>
    </Modal>
  )
}
