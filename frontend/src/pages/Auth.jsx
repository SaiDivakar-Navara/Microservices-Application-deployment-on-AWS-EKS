import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Auth({ mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const fillDemo = (email, password) => setForm({ ...form, email, password });

  return (
    <div className="page auth">
      <form className="panel auth-card" onSubmit={submit} noValidate>
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">{isRegister ? "Save your orders and check out faster." : "Sign in to see your orders and check out."}</p>

        {isRegister && (
          <label className="field">
            <span>Full name</span>
            <input value={form.name} onChange={set("name")} autoComplete="name" required />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={form.password} onChange={set("password")} autoComplete={isRegister ? "new-password" : "current-password"} required minLength={8} />
          {isRegister && <small className="hint">At least 8 characters.</small>}
        </label>

        {error && <p className="alert alert-bad" role="alert">{error}</p>}

        <button className="btn btn-primary btn-lg block" disabled={busy}>
          {busy ? "Please wait" : isRegister ? "Create account" : "Sign in"}
        </button>

        <p className="auth-switch">
          {isRegister ? (
            <>Already have an account? <Link to="/login" state={location.state}>Sign in</Link></>
          ) : (
            <>New to Verve? <Link to="/register" state={location.state}>Create an account</Link></>
          )}
        </p>

        {!isRegister && (
          <div className="demo-box">
            <strong>Demo accounts</strong>
            <button type="button" className="link-btn" onClick={() => fillDemo("shopper@verve.shop", "Shopper@123")}>Use the shopper account</button>
            <button type="button" className="link-btn" onClick={() => fillDemo("admin@verve.shop", "Admin@123")}>Use the admin account</button>
          </div>
        )}
      </form>
    </div>
  );
}
