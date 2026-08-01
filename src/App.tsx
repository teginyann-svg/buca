import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "@/views/HomePage";
import SemainePage from "@/views/SemainePage";
import ClientsPage from "@/views/ClientsPage";
import CalculateurPage from "@/views/CalculateurPage";
import CgPage from "@/views/CgPage";

/**
 * HashRouter partout : stable sous Next (dev) et ReactPress (`dist/`).
 * URLs : /#/, /#/semaine, /#/clients, …
 */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/semaine" element={<SemainePage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/calculateur" element={<CalculateurPage />} />
        <Route path="/cg" element={<CgPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
