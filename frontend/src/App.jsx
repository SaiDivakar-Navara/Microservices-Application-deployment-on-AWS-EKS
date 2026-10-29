import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { RequireAuth } from "./components/Guards";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductPage from "./pages/ProductPage";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Notifications from "./pages/Notifications";
import Auth from "./pages/Auth";
import Status from "./pages/Status";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminInventory from "./pages/admin/AdminInventory";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="shell">
      <ScrollToTop />
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/status" element={<Status />} />

          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />

          <Route path="/admin" element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="inventory" element={<AdminInventory />} />
          </Route>

          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
