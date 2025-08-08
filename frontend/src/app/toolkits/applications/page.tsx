export default function ApplicationsToolkit() {
  const links = [
    { href: "#", label: "Application → Capability Mapping (coming soon)", disabled: true },
    { href: "#", label: "Logical Application Model Generator (coming soon)", disabled: true },
    { href: "#", label: "Individual Application Mapping (coming soon)", disabled: true },
  ];
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-4">🏗️ Applications Toolkit</h1>
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
