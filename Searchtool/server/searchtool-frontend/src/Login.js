import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      setErr("");
      await login(email, password);
      nav("/");
    } catch (e) {
      setErr(e?.response?.data?.error || "Login failed");
    }
  };

  return (
    <div style={{maxWidth: 380, margin: "60px auto", padding: 20, background:"#fff", border:"1px solid #eee", borderRadius:12}}>
      <h2>Sign in</h2>
      {err && <div style={{color:"#B42318", background:"#FFF6F6", border:"1px solid #F1C0C0", padding:8, borderRadius:8, margin:"8px 0"}}>{err}</div>}
      <form onSubmit={onSubmit} style={{display:"grid", gap:10}}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" required style={{padding:10, border:"1px solid #e5e7eb", borderRadius:8}} />
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" required style={{padding:10, border:"1px solid #e5e7eb", borderRadius:8}} />
        <button type="submit" style={{padding:"10px 12px", borderRadius:10, background:"#2e7d32", color:"#fff", border:"none"}}>Login</button>
      </form>
    </div>
  );
}
