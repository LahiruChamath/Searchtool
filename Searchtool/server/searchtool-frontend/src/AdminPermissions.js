import React, { useEffect, useState } from "react";
import axios from "axios";
import "./AdminUsers.css"; // reuse the same look
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

const KEYS = [
  { k:"canEditConsultant", label:"Edit consultant" },
  { k:"canDeleteConsultant", label:"Delete consultant" },
  { k:"canManageUsers", label:"Manage users" },
  { k:"canAddReview", label:"Add reviews" },
  { k:"canRate", label:"Rate consultants" },
  { k:"canEditExperience", label:"Edit experience" }
];

export default function AdminPermissions() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/permissions");
      setRows(data || []);
      setErr("");
    } catch (e) { setErr(e?.response?.data?.error || "Failed to load permissions"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (!user) return <div className="admin-page"><div className="admin-card"><h1>Permissions</h1><div className="admin-error">Please sign in.</div></div></div>;
  if (user.role !== "admin") return <div className="admin-page"><div className="admin-card"><h1>Permissions</h1><div className="admin-error">You don’t have permission.</div><button className="btn" onClick={() => nav("/")}>← Back</button></div></div>;

  const toggle = async (role, key, value) => {
    try {
      const { data } = await axios.patch(`/api/permissions/${role}`, { [key]: value });
      setRows((prev) => prev.map(r => r.role === role ? data : r));
    } catch (e) { alert(e?.response?.data?.error || "Update failed"); }
  };

  return (
    <div className="admin-page">
      <div className="admin-card">
        <div className="users-topbar">
          <h1>Permissions</h1>
          <button className="btn" onClick={() => nav("/")}>← Back</button>
        </div>

        {loading && <div className="admin-muted">Loading…</div>}
        {err && <div className="admin-error">{err}</div>}

        {!loading && !err && (
          <div className="table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th style={{width:120}}>Role</th>
                  {KEYS.map(({k,label}) => <th key={k}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.role}>
                    <td className="wrap" style={{fontWeight:700}}>{r.role}</td>
                    {KEYS.map(({k}) => (
                      <td key={k}>
                        <input
                          type="checkbox"
                          checked={!!r[k]}
                          onChange={(e)=>toggle(r.role, k, e.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
