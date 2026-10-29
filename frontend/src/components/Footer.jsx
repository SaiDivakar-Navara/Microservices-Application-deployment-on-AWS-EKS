import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="logo logo-footer">verve<span className="logo-dot" /></div>
          <p className="muted">Everyday things, well made. Free shipping on orders over $100.</p>
        </div>
        <div className="footer-links">
          <strong>Shop</strong>
          <Link to="/shop">All products</Link>
          <Link to="/shop?on_sale=true">Deals</Link>
          <Link to="/orders">Track an order</Link>
        </div>
        <div className="footer-links">
          <strong>Platform</strong>
          <Link to="/status">Service status</Link>
          <Link to="/login">Sign in</Link>
        </div>
      </div>
      <div className="footer-base">Verve Market is a demo store. No real payments are taken.</div>
    </footer>
  );
}
