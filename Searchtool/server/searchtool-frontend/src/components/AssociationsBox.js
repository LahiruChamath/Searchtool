// src/components/AssociationsBox.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

export default function AssociationsBox({
  API,
  consultantId,
  initial = [],
  canEdit = false,
  onSaved, // (newArray) => void
}) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(initial);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setItems(initial || []); }, [initial]);

  const hasChanges = useMemo(
    () => JSON.stringify(items) !== JSON.stringify(initial || []),
    [items, initial]
  );

  const add = () => {
    const v = newItem.trim();
    if (!v) return;
    setItems(prev => Array.from(new Set([...(prev || []), v])));
    setNewItem('');
  };

  const removeAt = (i) => {
    setItems(prev => (prev || []).filter((_, idx) => idx !== i));
  };

  const save = async () => {
    try {
      setSaving(true);
      setErr('');
      const { data } = await axios.put(
        `${API}/api/consultants/${consultantId}/associations`,
        { associations: items },
        { withCredentials: true }
      );
      const next = Array.isArray(data) ? data
        : Array.isArray(data?.associations) ? data.associations
        : items;
      setItems(next);
      setEditing(false);
      onSaved?.(next);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to save associations');
    } finally {
      setSaving(false);
    }
  };

  // Read-only
  if (!canEdit) {
    return (items?.length
      ? <ul className="assoc-readonly">{items.map((a,i)=><li key={i}>{a}</li>)}</ul>
      : <p className="muted">No associations.</p>
    );
  }

  return (
    <div className="card section">
      <div className="assoc-head">
        <h2>Associations</h2>
        {!editing ? (
          <button className="btn" onClick={() => setEditing(true)}>Edit</button>
        ) : (
          <div className="actions-row">
            <button
              className="btn"
              onClick={()=>{ setItems(initial||[]); setEditing(false); setErr(''); }}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={!hasChanges || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        items?.length
          ? <ul className="assoc-readonly">{items.map((a,i)=><li key={i}>{a}</li>)}</ul>
          : <p className="muted">No associations.</p>
      ) : (
        <>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              placeholder="e.g., IEEE, PMI, SLASSCOM"
              value={newItem}
              onChange={(e)=>setNewItem(e.target.value)}
              onKeyDown={(e)=>{ if (e.key==='Enter') add(); }}
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={add} disabled={!newItem.trim()}>Add</button>
          </div>

          <ul className="assoc-edit">
            {items.map((a, i) => (
              <li key={i} className="assoc-item">
                <span className="assoc-text">{a}</span>
                <button className="btn danger" onClick={() => removeAt(i)}>Remove</button>
              </li>
            ))}
          </ul>

          {err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}
        </>
      )}
    </div>
  );
}
