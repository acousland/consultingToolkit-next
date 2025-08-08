export default function PainPointToolkit() {
  const links = [
    { href: "/pain-points", label: "Pain Point Extraction" },
  { href: "/pain-points/themes", label: "Theme & Perspective Mapping" },
    { href: "#", label: "Pain Point Impact Estimation (coming soon)", disabled: true },
    { href: "#", label: "Capability Mapping (coming soon)", disabled: true },
  ];
  return (
    <main>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-1">🔍 Pain Point Toolkit</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">Identify, categorise, and map organisational challenges.</p>
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
