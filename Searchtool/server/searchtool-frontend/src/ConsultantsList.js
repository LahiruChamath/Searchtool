import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './ConsultantsList.css';
import { useAuth } from './AuthContext';
import logo from './assets/EML-PLC-Logo (1).png';
import avatarIcon from './assets/images.png';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8081';

const toArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const getEmails = (c) =>
  (c.contacts?.emails?.length ? c.contacts.emails.map((e) => e.value) : c.emails) || [];
const getPhones = (c) =>
  (c.contacts?.phones?.length ? c.contacts.phones.map((p) => p.value) : c.phones) || [];

export default function ConsultantsList() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  // data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // URL-backed state
  const [nameQ, setNameQ] = useState(params.get('q') || '');
  const [expQ, setExpQ] = useState(params.get('exp') || '');
  const [expertise, setExpertise] = useState(params.get('expertise') || 'All');
  const [qual, setQual] = useState(params.get('qual') || 'All');
  const [ratingMin, setRatingMin] = useState(params.get('r') || 'All');
  const [sort, setSort] = useState(params.get('sort') || 'name-asc'); // name-asc | updated-desc | rating-desc | rating-asc
  const [view, setView] = useState(params.get('view') || 'list'); // list | grid

  // flash toast from /consultants/new
  const [flash, setFlash] = useState(location.state?.flash || '');

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 2500);
    if (location.state?.flash) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
    return () => clearTimeout(t);
  }, [flash, location.state]);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/api/consultants`)
      .then((res) => {
        setRows(res.data || []);
        setErr('');
      })
      .catch((e) => {
        console.error(e);
        setErr('Failed to load consultants');
      })
      .finally(() => setLoading(false));
  }, []);

  // dropdown options
  const expertiseOptions = useMemo(() => {
    const set = new Set(rows.flatMap((r) => toArr(r.expertise)).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [rows]);

  const qualOptions = useMemo(() => {
    const set = new Set(rows.flatMap((r) => toArr(r.qualifications)).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [rows]);

  // filtering
  const filtered = useMemo(() => {
    const q1 = nameQ.trim().toLowerCase();
    const q2 = expQ.trim().toLowerCase();

    return rows.filter((c) => {
      const basicsMatch =
        q1 === '' ||
        (c.name || '').toLowerCase().includes(q1) ||
        toArr(c.expertise).some((x) => (x || '').toLowerCase().includes(q1)) ||
        getEmails(c).some((x) => (x || '').toLowerCase().includes(q1)) ||
        getPhones(c).some((x) => (x || '').toLowerCase().includes(q1)) ||
        toArr(c.tags).some((x) => (x || '').toLowerCase().includes(q1));
      if (!basicsMatch) return false;

      const expMatch =
        q2 === '' ||
        toArr(c.experience).some(
          (e) =>
            (e.role || '').toLowerCase().includes(q2) ||
            (e.org || '').toLowerCase().includes(q2) ||
            (e.location || '').toLowerCase().includes(q2) ||
            toArr(e.highlights).some((h) => (h || '').toLowerCase().includes(q2))
        );
      if (!expMatch) return false;

      const expSelOk = expertise === 'All' || toArr(c.expertise).includes(expertise);
      if (!expSelOk) return false;

      const qualOk = qual === 'All' || toArr(c.qualifications).includes(qual);
      if (!qualOk) return false;

      const rmin = ratingMin === 'All' ? 0 : Number(ratingMin);
      const ravg = Number(c.ratingAvg || 0);
      return ravg >= rmin;
    });
  }, [rows, nameQ, expQ, expertise, qual, ratingMin]);

  // sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const [field, dir] = sort.split('-');
    const mul = dir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      if (field === 'name') return ((a.name || '').localeCompare(b.name || '')) * mul;
      if (field === 'updated') {
        const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return (ad - bd) * mul;
      }
      if (field === 'rating') {
        const ar = Number(a.ratingAvg || 0);
        const br = Number(b.ratingAvg || 0);
        return (ar - br) * mul;
      }
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  // sync to URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (nameQ) next.set('q', nameQ);
    if (expQ) next.set('exp', expQ);
    if (expertise !== 'All') next.set('expertise', expertise);
    if (qual !== 'All') next.set('qual', qual);
    if (ratingMin !== 'All') next.set('r', ratingMin);
    if (sort !== 'name-asc') next.set('sort', sort);
    if (view !== 'list') next.set('view', view);
    const current = params.toString();
    const nextStr = next.toString();
    if (current !== nextStr) setParams(next, { replace: true });
  }, [nameQ, expQ, expertise, qual, ratingMin, sort, view]); // eslint-disable-line

  const qs = params.toString() ? `?${params.toString()}` : '';

  // delete (admin only)
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this consultant?')) return;
    try {
      await axios.delete(`${API}/api/consultants/${id}`);
      setRows((prev) => prev.filter((x) => (x._id || x.id) !== id));
    } catch (e) {
      alert(e?.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="page">
      {flash && <div className="toast toast-success">{flash}</div>}

      {/* top bar with back buttons + auth + admin links (Users, Permissions, Manual) */}
      <div className="list-topbar">
  <div className="brand">
    <img
      className="brand-logo"
      src={logo}
      alt="EML Consultants"
      onClick={() => navigate('/')}
    />
    <div className="brand-text" onClick={() => navigate('/')}>
      Consultants Database
    </div>
  </div>

 {/*} <div className="top-left">
    <button className="btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>← Back</button>
    <button className="btn" onClick={() => navigate('/')}>← Back to list</button>
  </div> */}
        <div className="top-right">
          {user ? (
  <span className="user-pill">
    <img
      className="avatar"
      src={user.photo || user.avatarUrl || avatarIcon}
      alt="Profile"
      onError={(e) => { e.currentTarget.src = avatarIcon; }}
    />
    {user.name || user.email}
    <button className="link" onClick={logout}>&nbsp;Log out</button>
    {user.role === 'admin' && (
      <>
        <a className="link" href="/admin/users" style={{ marginLeft: 8 }}>Users</a>
        <a className="link" href="/admin/permissions" style={{ marginLeft: 8 }}>Permissions</a>
      </>
    )}
  </span>
) : (
  <a className="link" href="/login">Sign in</a>
)}
        </div>
      </div>

      {/* Add Consultant button (admin/editor) */}
      {(user?.role === 'admin' || user?.role === 'editor') && (
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={() => navigate('/consultants/new')}>
            + Add Consultant
          </button>
        </div>
      )}

      {/* filters */}
      <div className="filters-top">
        <div className="row">
          <div className="cell grow">
            <label className="lbl">Search consultants</label>
            <input
              className="input"
              placeholder="Name, email, phone, expertise, tags…"
              value={nameQ}
              onChange={(e) => { setNameQ(e.target.value); if (!e.target.value) setExpQ(''); }}
            />
          </div>
          <div className="cell exp">
            <label className="lbl">Search experience</label>
            <input
              className="input"
              placeholder="Role, organization, location, highlight…"
              value={expQ}
              disabled={!nameQ.trim()}
              onChange={(e) => setExpQ(e.target.value)}
              title={!nameQ.trim() ? "Type something in 'Search consultants' first" : ''}
            />
          </div>
        </div>

        <div className="row wrap">
          <div className="cell">
            <label className="lbl">Expertise</label>
            <select className="select" value={expertise} onChange={(e) => setExpertise(e.target.value)}>
              {expertiseOptions.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
         {/* <div className="cell">
            <label className="lbl">Qualification</label>
            <select className="select" value={qual} onChange={(e) => setQual(e.target.value)}>
              {qualOptions.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div> */}
          <div className="cell">
            <label className="lbl">Minimum rating</label>
            <select className="select" value={ratingMin} onChange={(e) => setRatingMin(e.target.value)}>
              <option>All</option>
              <option value="5">5 ★</option>
              <option value="4">4 ★ &amp; up</option>
              <option value="3">3 ★ &amp; up</option>
              <option value="2">2 ★ &amp; up</option>
              <option value="1">1 ★ &amp; up</option>
            </select>
          </div>
          <div className="cell">
            <label className="lbl">Sort by</label>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name-asc">Name (A–Z)</option>
              <option value="updated-desc">Last Updated</option>
              <option value="rating-desc">Rating (High → Low)</option>
              <option value="rating-asc">Rating (Low → High)</option>
            </select>
          </div>
          <div className="cell">
            <label className="lbl">View</label>
            <div className="view-toggle-row">
              <button className={`btn-toggle ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>☰ List</button>
              <button className={`btn-toggle ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>⬜ Grid</button>
            </div>
          </div>
          <div className="cell shrink">
            <label className="lbl">&nbsp;</label>
            <button
              className="btn-clear"
              onClick={() => { setNameQ(''); setExpQ(''); setExpertise('All'); setQual('All'); setRatingMin('All'); setSort('name-asc'); }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* content */}
      <section className="content">
        {loading && <div className="table-skel">Loading…</div>}
        {err && !loading && <div className="error">{err}</div>}

        {!loading && !err && (
          view === 'list' ? (
            <div className="table-wrap">
              <table className="consultants-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Expertise</th>
                    <th style={{ width: 140 }}>Rating</th>
                    {(user?.role === 'admin' || user?.role === 'editor') && <th className="th-actions">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={user?.role === 'admin' ? 6 : 5} className="no-results">No consultants found.</td>
                    </tr>
                  ) : (
                    sorted.map((c) => {
                      const phones = getPhones(c).join(', ') || '—';
                      const emails = getEmails(c).join(', ') || '—';
                      const exps = toArr(c.expertise).join(', ') || '—';
                      const ravg = Number(c.ratingAvg || 0);
                      return (
                        <tr key={c._id || c.id || c.name}>
                          <td className="cell-name"><Link to={`/consultants/${c._id}${qs}`}>{c.name || '—'}</Link></td>
                          <td>{phones}</td>
                          <td>{emails}</td>
                          <td>{exps}</td>
                          <td>
                            <div className="rating" aria-label={`${ravg} out of 5`}>
                              <span className="stars">
                                <span className="stars-fill" style={{ '--value': `${(ravg / 5) * 100}%` }} />
                              </span>
                              <span className="stars-text">{ravg ? ravg.toFixed(1) : '—'}</span>
                            </div>
                          </td>
                          <td className="cell-actions">
  {(user?.role === 'admin' || user?.role === 'editor') && (
    <button
      className="btn-small"
      onClick={() => navigate(`/consultants/${c._id}${qs}`)}
    >
      Edit
    </button>
  )}
  {(user?.role === 'admin' || user?.role === 'editor') && (
    <button className="btn-small danger" onClick={() => handleDelete(c._id)}>
      Delete
    </button>
  )}
</td>

                          
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="consultants-container grid">
              {sorted.length === 0 ? (
                <div className="no-results">No consultants found.</div>
              ) : (
                sorted.map((c) => {
                  const emails = getEmails(c).join(', ') || 'N/A';
                  const phones = getPhones(c).join(', ') || 'N/A';
                  const exps = toArr(c.expertise).join(', ') || 'N/A';
                  const ravg = Number(c.ratingAvg || 0);
                  return (
                    <div className="consultant-card grid" key={c._id || c.id || c.name}>
                      <img src={c.img || 'https://via.placeholder.com/100'} alt={c.name} className="consultant-img" />
                      <div className="consultant-info">
                        <h2 className="consultant-name">
                          <Link to={`/consultants/${c._id}${qs}`}>{c.name}</Link>
                        </h2>
                        <p><strong>Expertise:</strong> {exps}</p>
                        <p><strong>Email:</strong> {emails}</p>
                        <p><strong>Phone:</strong> {phones}</p>
                        <div className="rating">
                          <span className="stars">
                            <span className="stars-fill" style={{ '--value': `${(ravg / 5) * 100}%` }} />
                          </span>
                          <span className="stars-text">{ravg ? ravg.toFixed(1) : '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )
        )}
      </section>
    </div>
  );
}
