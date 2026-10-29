import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LayoutDashboard, LogOut, Package, Search, ShoppingBag, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import NotificationBell from "./NotificationBell";
import { catalog } from "../api/services";

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const onShop = location.pathname === "/shop";
  const activeCategory = params.get("category");
  const onSale = params.get("on_sale") === "true";
  const [query, setQuery] = useState(params.get("q") || "");
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    catalog.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const submit = (e) => {
    e.preventDefault();
    navigate(query.trim() ? `/shop?q=${encodeURIComponent(query.trim())}` : "/shop");
  };

  return (
    <header className="header">
      <div className="header-main">
        <Link to="/" className="logo" aria-label="Verve Market home">
          verve<span className="logo-dot" />
        </Link>

        <form className="search" onSubmit={submit} role="search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for blankets, headphones, yoga mats"
            aria-label="Search products"
          />
        </form>

        <nav className="header-actions" aria-label="Account">
          {user && <NotificationBell />}

          {user ? (
            <div className="account" ref={menuRef}>
              <button className="header-btn account-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
                <User size={20} />
                <span className="hide-sm">{user.name.split(" ")[0]}</span>
              </button>
              {menu && (
                <div className="popover popover-narrow" onClick={() => setMenu(false)}>
                  <div className="popover-head">
                    <div>
                      <strong>{user.name}</strong>
                      <div className="muted small">{user.email}</div>
                    </div>
                  </div>
                  <Link className="menu-item" to="/orders"><Package size={16} /> My orders</Link>
                  {isAdmin && (
                    <Link className="menu-item" to="/admin"><LayoutDashboard size={16} /> Admin</Link>
                  )}
                  <button
                    className="menu-item"
                    onClick={async () => {
                      await logout();
                      navigate("/");
                    }}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link className="btn btn-ghost" to="/login">Sign in</Link>
          )}

          <Link to="/cart" className="header-btn cart-btn" aria-label={`Cart, ${count} items`}>
            <ShoppingBag size={20} />
            <span className="hide-sm">Cart</span>
            {count > 0 && <span className="count-dot">{count}</span>}
          </Link>
        </nav>
      </div>

      <nav className="category-bar" aria-label="Categories">
        <Link className={onShop && !activeCategory && !onSale ? "chip active" : "chip"} to="/shop">All products</Link>
        {categories.map((c) => (
          <Link key={c.name} className={onShop && activeCategory === c.name ? "chip active" : "chip"} to={`/shop?category=${encodeURIComponent(c.name)}`}>
            {c.name}
          </Link>
        ))}
        <Link className="chip chip-sale" to="/shop?on_sale=true">Deals</Link>
      </nav>
    </header>
  );
}
