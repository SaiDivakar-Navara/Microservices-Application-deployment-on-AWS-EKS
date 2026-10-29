import { NavLink, Outlet } from "react-router-dom";
import { Boxes, LayoutDashboard, Package, Tag } from "lucide-react";

const LINKS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: Package },
  { to: "/admin/products", label: "Products", icon: Tag },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
];

export default function AdminLayout() {
  return (
    <div className="page admin">
      <aside className="admin-nav">
        <h2>Admin</h2>
        <nav aria-label="Admin">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="admin-link">
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-body">
        <Outlet />
      </div>
    </div>
  );
}
