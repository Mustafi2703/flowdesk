'use client'

import { useEffect, useState } from 'react'

type LinkRow = { label?: string; url?: string; drive_id?: string }

export function ExternalLinksEditor({
  links,
  canEdit,
  saving,
  onSave,
  hint,
}: {
  links: LinkRow[]
  canEdit: boolean
  saving?: boolean
  onSave: (next: LinkRow[]) => Promise<boolean>
  hint?: string
}) {
  const [draft, setDraft] = useState<LinkRow[]>(links || [])

  useEffect(() => {
    setDraft(links || [])
  }, [links])

  function updateRow(idx: number, patch: Partial<LinkRow>) {
    setDraft((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  async function persist(next: LinkRow[]) {
    const cleaned = next
      .map((r) => ({
        label: (r.label || 'Google Drive').trim(),
        url: (r.url || '').trim(),
        ...(r.drive_id ? { drive_id: r.drive_id } : {}),
      }))
      .filter((r) => r.url.length > 0)
    const ok = await onSave(cleaned)
    if (ok) setDraft(cleaned)
  }

  return (
    <div className="sf-ext-links">
      {hint && <p className="sf-ext-links-hint">{hint}</p>}
      {draft.length === 0 && !canEdit && (
        <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No Drive or external links yet.</div>
      )}
      <div className="sf-ext-links-list">
        {draft.map((row, idx) => (
          <div key={idx} className="sf-ext-links-row">
            {canEdit ? (
              <>
                <input
                  className="sf-input"
                  placeholder="Label (e.g. Review folder)"
                  value={row.label || ''}
                  onChange={(e) => updateRow(idx, { label: e.target.value })}
                />
                <input
                  className="sf-input"
                  placeholder="https://drive.google.com/…"
                  value={row.url || ''}
                  onChange={(e) => updateRow(idx, { url: e.target.value })}
                />
                <button
                  type="button"
                  className="sf-btn sf-btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => persist(draft.filter((_, i) => i !== idx))}
                  disabled={saving}
                >
                  Remove
                </button>
              </>
            ) : (
              <a href={row.url} target="_blank" rel="noreferrer" className="sf-ext-links-anchor">
                {row.label || 'Open link'} →
              </a>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="sf-ext-links-actions">
          <button
            type="button"
            className="sf-btn sf-btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => setDraft([...draft, { label: 'Google Drive', url: '' }])}
          >
            + Add link
          </button>
          <button
            type="button"
            className="sf-btn sf-btn-primary"
            style={{ fontSize: 12 }}
            disabled={saving}
            onClick={() => persist(draft)}
          >
            {saving ? 'Saving…' : 'Save links'}
          </button>
        </div>
      )}
    </div>
  )
}
