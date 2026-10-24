import { useState } from "react";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Sidebar from "./components/Sidebar";
import Sponsors from "./pages/Sponsors";
import Community from "./pages/Community";

const PAGE_COPY = {
  Dashboard: "Overview of your connected channels",
  "Task Center": "Plan, track, and finish creator work",
  Community: "Inspiration and related videos",
  Sponsors: "Find brands and draft outreach",
};

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  const renderPage = () => {
    switch (activePage) {
      case "Task Center":
        return <Tasks />;
      case "Sponsors":
        return <Sponsors />;
      case "Community":
        return <Community />;
      case "Dashboard":
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        isOpen={sidebarOpen}
      />

      <div className="app-content">
        <header className="topbar">
          <div className="topbar-brand">
            <img
              className="topbar-logo"
              src="/assets/logo.jpg"
              alt="Winfluencer"
            />
            <div>
              <p className="topbar-label">WINFLUENCER WORKSPACE</p>
              <h2>{activePage}</h2>
              <p className="muted-chip">{PAGE_COPY[activePage]}</p>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="menu-toggle"
              type="button"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="topbar-status">
              <span className="status-dot" />
              Workspace live
            </div>
          </div>
        </header>

        {renderPage()}
      </div>
    </div>
  );
}

export default App;
