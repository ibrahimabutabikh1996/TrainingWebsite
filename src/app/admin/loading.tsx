export default function AdminLoading() {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column",
      justifyContent: "center", 
      alignItems: "center", 
      height: "100%", 
      width: "100%", 
      minHeight: "60vh",
      gap: "16px"
    }}>
      <div className="admin-spinner"></div>
      <p style={{ color: "var(--admin-outline)", fontSize: "0.95rem", fontWeight: 500 }}>
        جاري التحميل...
      </p>
    </div>
  );
}
