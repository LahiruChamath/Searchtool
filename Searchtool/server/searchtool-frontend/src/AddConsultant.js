// frontend/src/AddConsultant.js
import React from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./AddConsultant.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:8081";
const toArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

export default function AddConsultant() {
  const nav = useNavigate();

  // ----- form state -----
  const [form, setForm] = React.useState({
    name: "",
    emails: "",
    phones: "",
    qualifications: "",
    tags: "",
    expertise: [], // final selected values that will be submitted
  });

  // experience block (can add multiple)
  const [experience, setExperience] = React.useState([
    { role: "", org: "", location: "", start: "", end: "", highlights: "" },
  ]);

  // expertise options (dynamic)
  const [expertiseOptions, setExpertiseOptions] = React.useState([]);
  const [expOptsLoading, setExpOptsLoading] = React.useState(true);
  const [expOptsError, setExpOptsError] = React.useState("");

  // expertise picker UI
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // temp selection inside the picker (confirmed into form.expertise only when pressing "Save")
  const [expertiseTemp, setExpertiseTemp] = React.useState([]);

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");

  // fetch expertise options from DB
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setExpOptsLoading(true);
        const { data } = await axios.get(`${API}/api/consultants`);
        const uniq = Array.from(
          new Set(
            (data || [])
              .flatMap((c) => toArr(c.expertise))
              .map((s) => String(s || "").trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));
        if (mounted) {
          setExpertiseOptions(uniq);
          setExpOptsError("");
        }
      } catch (e) {
        if (mounted) setExpOptsError(e?.response?.data?.error || e.message);
      } finally {
        if (mounted) setExpOptsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // keep temp in sync when opening the picker
  const openPicker = () => {
    setExpertiseTemp(form.expertise || []);
    setPickerOpen(true);
  };
  const closePicker = () => setPickerOpen(false);

  // picker actions
  const addTempExpertise = (val) => {
    const v = String(val || "").trim();
    if (!v) return;
    setExpertiseTemp((prev) => (prev.includes(v) ? prev : [...prev, v]));
  };
  const removeTempExpertise = (val) => {
    setExpertiseTemp((prev) => prev.filter((x) => x !== val));
  };
  const savePicker = () => {
    setForm((f) => ({ ...f, expertise: [...expertiseTemp] }));
    setPickerOpen(false);
  };

  // allow free text (optional – useful if option not in DB yet)
  const [expertiseFree, setExpertiseFree] = React.useState("");
  const addFreeExpertise = () => {
    const extra = expertiseFree
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!extra.length) return;
    // add to temp first (user still needs to press Save in picker)
    setExpertiseTemp((prev) => Array.from(new Set([...prev, ...extra])));
    // also show them in the dropdown options so they appear selectable
    setExpertiseOptions((prev) =>
      Array.from(new Set([...(prev || []), ...extra])).sort((a, b) => a.localeCompare(b))
    );
    setExpertiseFree("");
  };

  // normal field setters
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // experience handlers
  const updateExperience = (i, k, v) => {
    setExperience((exp) => exp.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)));
  };
  const addExperience = () =>
    setExperience((exp) => [
      ...exp,
      { role: "", org: "", location: "", start: "", end: "", highlights: "" },
    ]);
  const removeExperience = (i) =>
    setExperience((exp) => exp.filter((_, idx) => idx !== i));

  // submit
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        // category removed by request
        emails: form.emails.split(",").map((s) => s.trim()).filter(Boolean),
        phones: form.phones.split(",").map((s) => s.trim()).filter(Boolean),
        qualifications: form.qualifications.split(",").map((s) => s.trim()).filter(Boolean),
        tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),

        expertise: (form.expertise || []).map((s) => s.trim()).filter(Boolean),

        experience: experience.map((e) => ({
          role: e.role || undefined,
          org: e.org || undefined,
          location: e.location || undefined,
          start: e.start ? new Date(`${e.start}-01T00:00:00Z`) : null,
          end: e.end ? new Date(`${e.end}-01T00:00:00Z`) : null,
          highlights: e.highlights
            ? e.highlights.split("\n").map((s) => s.trim()).filter(Boolean)
            : [],
        })),
      };

      await axios.post(`${API}/api/consultants`, payload);
      nav("/", { state: { flash: "Consultant added" }, replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.error || e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-page">
      <div className="add-card">
        <div className="add-title">
          <h1>Add Consultant</h1>
          <button className="btn" onClick={() => nav(-1)}>← Back</button>
        </div>

        {err && <div className="error" style={{ marginBottom: 12 }}>{err}</div>}

        <form onSubmit={submit} className="add-form">
          <label>
            Name
            <input required value={form.name} onChange={setField("name")} />
          </label>

          {/* Expertise custom picker (closed by default) */}
          <div className="label-stack">
            <span className="lbl">Expertise</span>
            {/* chips that reflect the confirmed form.expertise */}
            <div className="chips">
              {(form.expertise || []).length === 0 ? (
                <span className="muted">None selected</span>
              ) : (
                form.expertise.map((tag) => (
                  <span key={tag} className="chip" title={tag}>
                    {tag}
                    <button
                      type="button"
                      className="chip-x"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          expertise: f.expertise.filter((t) => t !== tag),
                        }))
                      }
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <button
              type="button"
              className="picker-toggle"
              onClick={() => (pickerOpen ? closePicker() : openPicker())}
              aria-expanded={pickerOpen}
            >
              {pickerOpen ? "▲ Hide expertise list" : "▼ Choose expertise"}
            </button>

            {pickerOpen && (
              <div className="picker-panel">
                {expOptsLoading && <div className="muted">Loading options…</div>}
                {expOptsError && <div className="error">{expOptsError}</div>}

                {!expOptsLoading && !expOptsError && (
                  <ul className="picker-options" role="listbox" aria-multiselectable="true">
                    {expertiseOptions.length === 0 ? (
                      <li className="option-empty muted">(No existing expertise in DB)</li>
                    ) : (
                      expertiseOptions.map((opt) => {
                        const chosen = expertiseTemp.includes(opt);
                        return (
                          <li
                            key={opt}
                            className={`option-item ${chosen ? "chosen" : ""}`}
                            title="Double-click to add/remove"
                            onDoubleClick={() =>
                              chosen
                                ? removeTempExpertise(opt)
                                : addTempExpertise(opt)
                            }
                          >
                            <span className="option-label">{opt}</span>
                            {chosen && <span className="option-check">✓</span>}
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}

                {/* Temp chips area inside picker */}
                <div className="chips" style={{ marginTop: 8 }}>
                  {expertiseTemp.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                      <button
                        type="button"
                        className="chip-x"
                        onClick={() => removeTempExpertise(tag)}
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {expertiseTemp.length === 0 && (
                    <span className="muted">Double-click items above to add here…</span>
                  )}
                </div>

                {/* Free text adder (optional) */}
                <div className="picker-free">
                  <input
                    className="input"
                    placeholder="Add custom expertise (comma separated)…"
                    value={expertiseFree}
                    onChange={(e) => setExpertiseFree(e.target.value)}
                  />
                  <button type="button" className="btn" onClick={addFreeExpertise}>
                    + Add custom
                  </button>
                </div>

                <div className="picker-actions">
                  <button type="button" className="btn" onClick={closePicker}>Cancel</button>
                  <button type="button" className="btn primary" onClick={savePicker}>
                    Save expertise
                  </button>
                </div>
              </div>
            )}
          </div>

          <label>
            Emails (comma separated)
            <input value={form.emails} onChange={setField("emails")} />
          </label>

          <label>
            Phones (comma separated)
            <input value={form.phones} onChange={setField("phones")} />
          </label>

          <label>
            Qualifications (comma separated)
            <input value={form.qualifications} onChange={setField("qualifications")} />
          </label>

          <label>
            Tags (comma separated)
            <input value={form.tags} onChange={setField("tags")} />
          </label>

          {/* Experience section */}
          <div className="exp-section" style={{ gridColumn: "1 / -1" }}>
            <h3>Experience</h3>

            {experience.map((e, i) => (
              <div key={i} className="exp-form" style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <label>Role
                  <input value={e.role} onChange={(ev) => updateExperience(i, "role", ev.target.value)} />
                </label>
                <label>Organization / Client
                  <input value={e.org} onChange={(ev) => updateExperience(i, "org", ev.target.value)} />
                </label>
                <label>Location
                  <input value={e.location} onChange={(ev) => updateExperience(i, "location", ev.target.value)} />
                </label>
                <label>Start (YYYY-MM)
                  <input type="month" value={e.start} onChange={(ev) => updateExperience(i, "start", ev.target.value)} />
                </label>
                <label>End (YYYY-MM)
                  <input type="month" value={e.end} onChange={(ev) => updateExperience(i, "end", ev.target.value)} />
                </label>
                <label>Description
                  <textarea rows={3} placeholder={"Type Here..."}
                    value={e.highlights}
                    onChange={(ev) => updateExperience(i, "highlights", ev.target.value)} />
                </label>

                {experience.length > 1 && (
                  <button type="button" className="btn danger" onClick={() => removeExperience(i)}>
                    Remove
                  </button>
                )}
              </div>
            ))}

            <button type="button" className="btn" onClick={addExperience}>+ Add Another Experience</button>
          </div>

          <div className="add-actions">
            <button type="button" className="btn" onClick={() => nav(-1)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
