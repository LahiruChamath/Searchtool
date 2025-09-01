import React, { useEffect, useState } from "react";
import axios from "axios";
import "./AdminUsers.css";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

const ROLES = ["admin", "editor", "viewer"];

export default function AdminUsers() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get("/api/users");
        setUsers(data);
        setErr("");
      } catch (e) {
        setErr(e?.response?.data?.error || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (!user) {
    return (
      <div className="admin-page">
        <div className="admin-card">
          <h1>Users</h1>
          <div className="admin-error">Please sign in.</div>
        </div>
      </div>
    );
  }
  if (user.role !== "admin") {
    return (
      <div className="admin-page">
        <div className="admin-card">
          <h1>Users</h1>
          <div className="admin-error">You don’t have permission to view this page.</div>
          <button className="btn" onClick={() => nav("/")}>← Back</button>
        </div>
      </div>
    );
  }

  const onChangeRole = async (id, role) => {
    try {
      const { data } = await axios.patch(`/api/users/${id}`, { role });
      setUsers((prev) => prev.map((u) => (u._id === id ? data : u)));
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to update role");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-card">
        <div className="users-topbar">
          <h1>Users</h1>
          <button className="btn" onClick={() => nav("/")}>← Back</button>
        </div>

        {loading && <div className="admin-muted">Loading…</div>}
        {err && <div className="admin-error">{err}</div>}

        {!loading && !err && (
          <div className="table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th style={{width: "34%"}}>Name</th>
                  <th style={{width: "34%"}}>Email</th>
                  <th style={{width: "22%"}}>Role</th>
                  <th style={{width: "10%"}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={4} className="admin-muted">No users</td></tr>
                ) : users.map((u) => (
                  <tr key={u._id}>
                    <td className="wrap">{u.name}</td>
                    <td className="wrap">{u.email}</td>
                    <td>
                      <select
                        className="role-select"
                        value={u.role}
                        onChange={(e) => onChangeRole(u._id, e.target.value)}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className="admin-pill">{u.role}</span>
                  </td>
                  {/* delete user button */}
                  <td>
                      <button
                        className="btn btn-danger"
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to delete user "${u.name}"? This action cannot be undone.`)) {
                            try {
                              await axios.delete(`/api/users/${u._id}`);
                              setUsers((prev) => prev.filter((x) => x._id !== u._id));
                            } catch (e) {
                              alert(e?.response?.data?.error || "Failed to delete user");
                            }
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
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
