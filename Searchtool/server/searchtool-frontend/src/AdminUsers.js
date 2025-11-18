import React, { useEffect, useState } from "react";
import axios from "axios";
import "./AdminUsers.css";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

const ROLES = ["admin", "editor", "viewer"];

/* ---------- Add User Modal ---------- */
function AddUserModal({ open, onClose, onCreated }) {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: "",
    role: "viewer",
  });
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const { data } = await axios.post("/api/users", form);
      onCreated?.(data);
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-head">
          <h3>Add User</h3>
          <button className="btn btn-text" onClick={onClose}>
            ✕
          </button>
        </div>
        {err && <p className="error">{err}</p>}
        <form onSubmit={submit} className="form-grid">
          <label>
            Name
            <input required value={form.name} onChange={set("name")} />
          </label>
          <label>
            Email
            <input type="email" required value={form.email} onChange={set("email")} />
          </label>
          <label>
            Password
            <input type="password" required value={form.password} onChange={set("password")} />
          </label>
          <label>
            Role
            <select value={form.role} onChange={set("role")}>
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
          <div className="actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function AdminUsers() {
  const [showAdd, setShowAdd] = useState(false);
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
          <button className="btn" onClick={() => nav("/")}>
            ← Back
          </button>
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
    <>
      <AddUserModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(u) => setUsers((prev) => [u, ...prev])}
      />

      <div className="admin-page">
        <div className="admin-card">
          <div className="users-topbar">
            <h1>Users</h1>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => nav("/")}>
                ← Back
              </button>
              <button className="btn primary" onClick={() => setShowAdd(true)}>
                + Add User
              </button>
            </div>
          </div>

          {loading && <div className="admin-muted">Loading…</div>}
          {err && <div className="admin-error">{err}</div>}

          {!loading && !err && (
            <div className="table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th style={{ width: "34%" }}>Name</th>
                    <th style={{ width: "34%" }}>Email</th>
                    <th style={{ width: "22%" }}>Role</th>
                    <th style={{ width: "10%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="admin-muted">
                        No users
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u._id}>
                        <td className="wrap">{u.name}</td>
                        <td className="wrap">{u.email}</td>
                        <td>
                          <select
                            className="role-select"
                            value={u.role}
                            onChange={(e) => onChangeRole(u._id, e.target.value)}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            className="btn btn-danger"
                            onClick={async () => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete user "${u.name}"? This action cannot be undone.`
                                )
                              ) {
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
