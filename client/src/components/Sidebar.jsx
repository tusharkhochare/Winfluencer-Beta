const icons = {
  Dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  ),
  "Task Center": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 12.5 10.2 16 17 8.5" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    </svg>
  ),
  Community: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="9" r="3" />
      <circle cx="16" cy="10.5" r="2.4" />
      <path d="M4.5 18.5c.6-2.6 2.7-4 4.5-4s3.9 1.4 4.5 4" />
      <path d="M13.2 18.5c.4-1.8 1.7-3 3-3 1.5 0 2.8 1 3.3 3" />
    </svg>
  ),
  Sponsors: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m12 4 2.1 5.2 5.6.5-4.2 3.7 1.3 5.4L12 15.8 7.2 18.8l1.3-5.4-4.2-3.7 5.6-.5L12 4Z" />
    </svg>
  ),
};

function Sidebar({ activePage, onNavigate, isOpen }) {
  const navItems = [
    "Dashboard",
    "Task Center",
    "Community",
    "Sponsors",
  ];

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-logo">
        <img
          className="logo-icon"
          src="/assets/logo.jpg"
          alt="Winfluencer"
        />
        <span>Winfluencer</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((label) => (
          <button
            key={label}
            className={`nav-item ${activePage === label ? "active" : ""}`}
            onClick={() => onNavigate(label)}
          >
            {icons[label]}
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="creator-placeholder">
          <div className="creator-avatar">C</div>
          <div>
            <strong>Creator</strong>
            <span>My Workspace</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
