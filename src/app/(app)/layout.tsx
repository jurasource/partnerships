import { AppNavbar } from "@/components/app-navbar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-100">
      <AppNavbar />
      <div className="flex-1 pt-14">{children}</div>
    </div>
  );
}
