export default function DataAIToolkit() {
  const links = [
    { href: "#", label: "Conceptual Data Model Generator (coming soon)", disabled: true },
    { href: "#", label: "Data-Application Mapping (coming soon)", disabled: true },
    { href: "#", label: "AI Use Case Customiser (coming soon)", disabled: true },
    { href: "/", label: "Use Case Ethics Review (demo on home previously)", disabled: false },
  ];
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-4">📊 Data, Information, and AI Toolkit</h1>
        <ul className="space-y-3">
          {links.map((l)=> (
            <li key={l.label}>
              {l.disabled ? (
                <span className="text-gray-400">{l.label}</span>
              ) : (
                <a className="text-blue-700 underline" href={l.href}>{l.label}</a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
