export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="neon-shell flex items-center justify-center p-4">
      <div className="max-w-md w-full neon-card neon-cyan p-7">{children}</div>
    </div>
  );
}
