import { NavBar } from "@/app/components/NavBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
