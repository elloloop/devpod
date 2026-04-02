export default function DiffReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: 'var(--dp-bg-primary)' }}
    >
      {children}
    </div>
  );
}
