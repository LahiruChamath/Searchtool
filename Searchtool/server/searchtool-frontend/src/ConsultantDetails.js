import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './ConsultantDetails.css';
import { useAuth } from './AuthContext';

const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const csvShow = (v) => arr(v).join(', ');
const csvParse = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);
const emails = (c) => (c.contacts?.emails?.length ? c.contacts.emails.map(e => e.value) : c.emails) || [];
const phones = (c) => (c.contacts?.phones?.length ? c.contacts.phones.map(p => p.value) : c.phones) || [];

// Month formatting: "YYYY-MM[-DD]" -> "Mon YYYY"
const fmtMonth = (d) => {
  if (!d) return '';
  // accept "YYYY-MM", "YYYY-MM-DD", ISO
  const s = String(d);
  const y = s.slice(0, 4);
  const m = s.slice(5, 7);
  if (!y || !m) return '';
  const short = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1];
  return `${short} ${y}`;
};

// Convert <input type="month"> value (YYYY-MM) to ISO ("YYYY-MM-01T00:00:00.000Z")
const monthToISO = (m) => (m ? new Date(`${m}-01T00:00:00Z`).toISOString() : null);

// Convert Date/ISO to month-input value "YYYY-MM"
const dateToMonthValue = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) {
    // maybe in "YYYY-MM" shape already
    const s = String(d);
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    return '';
  }
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth()+1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

export default function ConsultantDetails() {
  const { id } = useParams();
  const { user, getMyPermissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const API = process.env.REACT_APP_API_URL || 'http://localhost:8081';

  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [perms, setPerms] = useState({});

  const [form, setForm] = useState({
    name: '', category: '', expertise: '',
    emails: '', phones: '', qualifications: '', tags: '',
    summary: '', img: ''
  });

  // Photo upload state
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Reviews
  const [revText, setRevText] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [postingReview, setPostingReview] = useState(false);

  // Experience form UI state (now month pickers)
  const [showExpForm, setShowExpForm] = useState(false);
  const [expForm, setExpForm] = useState({
    role: '',
    org: '',
    location: '',
    startMonth: '', // YYYY-MM
    endMonth: '',   // YYYY-MM
    highlights: ''
  });
  const [savingExp, setSavingExp] = useState(false);

  useEffect(() => {
    (async () => {
      if (user) setPerms(await getMyPermissions());
    })();
  }, [user, getMyPermissions]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/consultants/${id}`);
      setC(res.data); setErr('');
    } catch {
      setErr('Failed to load consultant');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (c && edit) {
      setForm({
        name: c.name || '',
        category: c.category || '',
        expertise: csvShow(c.expertise),
        emails: csvShow(emails(c)),
        phones: csvShow(phones(c)),
        qualifications: csvShow(c.qualifications),
        tags: csvShow(c.tags),
        summary: c.summary || c.info || '',
        img: c.img || c.media?.photo || ''
      });
    }
  }, [c, edit]);

  const qs = location.search || '';
  const backHref = '/' + (qs.startsWith('?') ? qs : qs ? `?${qs}` : '');
  const onBack = () => { if (window.history.length > 1) navigate(-1); else navigate(backHref,{replace:true}); };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        name: form.name,
        category: form.category,
        expertise: csvParse(form.expertise),
        emails: csvParse(form.emails),
        phones: csvParse(form.phones),
        qualifications: csvParse(form.qualifications),
        tags: csvParse(form.tags),
        summary: form.summary,
        info: form.summary,
        img: form.img,
        contacts: {
          emails: csvParse(form.emails).map((v,i)=>({ value:v, label:"work", primary:i===0 })),
          phones: csvParse(form.phones).map((v,i)=>({ value:v, label:"mobile", primary:i===0 }))
        }
      };
      const { data } = await axios.put(`${API}/api/consultants/${id}`, payload);
      setC(data); setEdit(false);
    } catch (e) {
      alert(e?.response?.data?.error || 'Save failed (admin only)');
    } finally { setSaving(false); }
  };

  const submitExperience = async (e) => {
    e.preventDefault();
    try {
      setSavingExp(true);
      await axios.post(`${API}/api/consultants/${id}/experience`, {
        role: expForm.role,
        org: expForm.org,
        location: expForm.location,
        start: monthToISO(expForm.startMonth), // store ISO at day 1
        end: monthToISO(expForm.endMonth),
        highlights: expForm.highlights
          ? expForm.highlights.split('\n').map(s => s.trim()).filter(Boolean)
          : []
      });
      setShowExpForm(false);
      setExpForm({ role:'', org:'', location:'', startMonth:'', endMonth:'', highlights:'' });
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || "Couldn't add experience");
    } finally { setSavingExp(false); }
  };

  const postReview = async (e) => {
    e.preventDefault();
    try {
      setPostingReview(true);
      await axios.post(`${API}/api/consultants/${id}/reviews`, { rating: revRating, comment: revText });
      setRevText(''); setRevRating(5);
      await load();
    } catch (e) { alert(e?.response?.data?.error || "Couldn't post review"); }
    finally { setPostingReview(false); }
  };

  // Photo upload handler
  const uploadPhoto = async (e) => {
    e.preventDefault();
    if (!photoFile) return;
    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('photo', photoFile);
      await axios.post(`${API}/api/consultants/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoFile(null);
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const ravg = Number(c?.ratingAvg || 0);
  const rcount = Number(c?.ratingCount || (c?.reviews?.length || 0));

  return (
    <div className="consultant-details">
      <div className="detail-topbar">
        <div className="topbar-inner">
          <button className="btn" onClick={onBack}>← Back</button>
          <button className="btn" onClick={()=>navigate('/')}>← Back to list</button>
          <div className="spacer" />
          {user ? (
            <>
              <span className="user-pill">{user.name || user.email}</span>
              {user.role === 'admin' && c && (
                <button className="btn btn-primary" onClick={() => setEdit(v => !v)}>{edit ? 'Exit Edit' : 'Edit'}</button>
              )}
            </>
          ) : <a className="link" href="/login">Sign in</a>}
        </div>
      </div>

      {loading && <div className="detail-skel"><div className="skel-avatar" /><div className="skel-title"><div className="skel-line w-60" /><div className="skel-line w-40" /></div></div>}
      {err && !loading && <div className="error">{err}</div>}

      {!loading && !err && c && (
        <>
          <div className="consultant-header card">
            <img className="consultant-avatar" src={c.img || c.media?.photo || 'https://via.placeholder.com/160'} alt={c.name} />
            <div className="consultant-title">
              <h1>{c.name}</h1>
              <div className="consultant-meta">
                <span>{c.category || 'No category'}</span>
                <span>•</span>
                <span>{arr(c.expertise).join(', ') || 'No expertise'}</span>
              </div>
              <p className="muted">{c.summary || c.info || ''}</p>

              {/* Photo uploader (admin/permitted users) */}
              {user?.role === 'admin' && (
                <form className="photo-upload" onSubmit={uploadPhoto}>
                  <input
                    className="input-file"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e)=>setPhotoFile(e.target.files?.[0] || null)}
                  />
                  <button className="btn" type="submit" disabled={!photoFile || uploadingPhoto}>
                    {uploadingPhoto ? 'Uploading…' : 'Upload / Replace photo'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="consultant-grid">
            <div className="details card section">
              <h2>Details</h2>
              {!edit ? (
                <>
                  <div className="kv"><div className="k">Emails</div><div>{csvShow(emails(c)) || 'N/A'}</div></div>
                  <div className="kv"><div className="k">Phones</div><div>{csvShow(phones(c)) || 'N/A'}</div></div>
                  <div className="kv"><div className="k">Qualifications</div><div>{csvShow(c.qualifications) || 'N/A'}</div></div>
                  <div className="kv"><div className="k">Tags</div>
                    <div className="badges">
                      {arr(c.tags).length ? arr(c.tags).map(t => <span className="badge" key={t}>{t}</span>) : "N/A"}
                    </div>
                  </div>
                  <div className="divider"></div>
                  <p className="muted small">Last updated: {c.updatedAt || c.createdAt ? new Date(c.updatedAt || c.createdAt).toLocaleString() : '—'}</p>
                </>
              ) : (
                <form className="edit-form" onSubmit={onSave}>
                  <label>Full name</label>
                  <input className="input" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} required />

                  <label>Category</label>
                  <input className="input" value={form.category} onChange={(e)=>setForm({...form, category: e.target.value})} />

                  <label>Expertise (comma-separated)</label>
                  <input className="input" value={form.expertise} onChange={(e)=>setForm({...form, expertise: e.target.value})} />

                  <label>Emails (comma-separated)</label>
                  <input className="input" value={form.emails} onChange={(e)=>setForm({...form, emails: e.target.value})} />

                  <label>Phones (comma-separated)</label>
                  <input className="input" value={form.phones} onChange={(e)=>setForm({...form, phones: e.target.value})} />

                  <label>Qualifications (comma-separated)</label>
                  <input className="input" value={form.qualifications} onChange={(e)=>setForm({...form, qualifications: e.target.value})} />

                  <label>Tags (comma-separated)</label>
                  <input className="input" value={form.tags} onChange={(e)=>setForm({...form, tags: e.target.value})} />

                  <label>Summary</label>
                  <textarea className="input textarea" rows={4} value={form.summary} onChange={(e)=>setForm({...form, summary: e.target.value})} />

                  <label>Image URL</label>
                  <input className="input" value={form.img} onChange={(e)=>setForm({...form, img: e.target.value})} placeholder="https://… or leave blank if you upload" />

                  <div className="actions-row">
                    <button className="btn" type="button" onClick={()=>setEdit(false)}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                  </div>
                </form>
              )}
            </div>

            <div className="exp card section">
              <h2>Experience</h2>

              {(!c.experience || c.experience.length === 0) ? (
                <div className="muted">No experience entries.</div>
              ) : (
                <ul className="exp-list">
                  {c.experience.map((e,i) => (
                    <li key={i}>
                      <div className="exp-title"><strong>{e.role || '—'}</strong>{e.org ? ` @ ${e.org}` : ''}</div>
                      <div className="exp-sub">
                        {(e.start || e.end) ? `${fmtMonth(e.start)} – ${e.end ? fmtMonth(e.end) : 'Present'}` : ''}
                        {e.location ? ` • ${e.location}` : ''}
                      </div>
                      {arr(e.highlights).length > 0 && (
                        <ul className="exp-highlights">
                          {e.highlights.map((h,hi)=><li key={hi}>{h}</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {(perms?.canEditExperience) && (
                <>
                  {!showExpForm ? (
                    <button className="btn" onClick={() => {
                      // If you have typical existing values on the last exp, pre-fill months:
                      setShowExpForm(true);
                      setExpForm(f => ({ ...f }));
                    }}>+ Add experience</button>
                  ) : (
                    <form className="exp-form" onSubmit={submitExperience}>
                      <div className="row">
                        <div className="col">
                          <label className="lbl">Role*</label>
                          <input
                            className="input"
                            value={expForm.role}
                            onChange={(e)=>setExpForm({...expForm, role: e.target.value})}
                            required
                            placeholder="e.g., Team Leader"
                          />
                        </div>
                        <div className="col">
                          <label className="lbl">Organization / Client</label>
                          <input
                            className="input"
                            value={expForm.org}
                            onChange={(e)=>setExpForm({...expForm, org: e.target.value})}
                            placeholder="e.g., UNDP"
                          />
                        </div>
                      </div>

                      <div className="row">
                        <div className="col">
                          <label className="lbl">Location</label>
                          <input
                            className="input"
                            value={expForm.location}
                            onChange={(e)=>setExpForm({...expForm, location: e.target.value})}
                            placeholder="e.g., Colombo, Sri Lanka"
                          />
                        </div>
                        <div className="col">
                          <label className="lbl">Start (Month & Year)</label>
                          <input
                            className="input"
                            type="month"
                            value={expForm.startMonth}
                            onChange={(e)=>setExpForm({...expForm, startMonth: e.target.value})}
                          />
                        </div>
                        <div className="col">
                          <label className="lbl">End (Month & Year)</label>
                          <input
                            className="input"
                            type="month"
                            value={expForm.endMonth}
                            onChange={(e)=>setExpForm({...expForm, endMonth: e.target.value})}
                          />
                        </div>
                      </div>

                      <label className="lbl">Highlights (one per line)</label>
                      <textarea
                        className="input textarea"
                        rows={3}
                        placeholder={"Led baseline evaluation\nDesigned M&E framework"}
                        value={expForm.highlights}
                        onChange={(e)=>setExpForm({...expForm, highlights: e.target.value})}
                      />

                      <div className="actions-row">
                        <button className="btn" type="button" onClick={() => setShowExpForm(false)}>Cancel</button>
                        <button className="btn btn-primary" type="submit" disabled={savingExp}>
                          {savingExp ? "Saving…" : "Save experience"}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>

            <div className="reviews card section">
              <div className="reviews-header">
                <h2>Reviews</h2>
                <div className="stars big">
                  <span className="stars-fill" style={{'--value': (ravg/5)*100 + '%'}} />
                </div>
                <div className="avg-text">{ravg ? `${ravg.toFixed(1)} / 5 (${rcount} reviews)` : 'No ratings yet'}</div>
              </div>

              {(!c.reviews || c.reviews.length === 0) ? (
                <div className="muted">No reviews yet.</div>
              ) : (
                <ul className="review-list">
                  {c.reviews.slice().reverse().map((r, i) => (
                    <li key={i} className="review-item">
                      <div className="review-head">
                        <div className="reviewer">{r.userName || 'User'}</div>
                        <div className="stars small">
                          <span className="stars-fill" style={{'--value': ((r.rating||0)/5)*100 + '%'}} />
                        </div>
                      </div>
                      <div className="review-body">{r.comment || ''}</div>
                      <div className="review-date">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                    </li>
                  ))}
                </ul>
              )}

              {(perms?.canAddReview) ? (
                <form className="review-form" onSubmit={postReview}>
                  <label className="lbl">Your rating</label>
                  <select className="select" value={revRating} onChange={e => setRevRating(Number(e.target.value))}>
                    <option value={5}>5</option>
                    <option value={4}>4</option>
                    <option value={3}>3</option>
                    <option value={2}>2</option>
                    <option value={1}>1</option>
                  </select>

                  <label className="lbl">Your review</label>
                  <textarea
                    className="input textarea"
                    rows={3}
                    value={revText}
                    onChange={e => setRevText(e.target.value)}
                    placeholder="Share brief feedback…"
                  />

                  <div className="actions-row">
                    <button className="btn btn-primary" type="submit" disabled={postingReview}>
                      {postingReview ? 'Posting…' : 'Post review'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="muted small">You don’t have permission to review.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
