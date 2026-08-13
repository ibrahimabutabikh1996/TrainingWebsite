
/* Exists only to start the icon-font download during the dashboard's loading
   state, before the page component has finished fetching the profile. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}
