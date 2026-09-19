import { NavLink } from 'react-router-dom';
export default function TailoringStages({
  analysis,
  version,
}: {
  analysis?: string;
  version?: string;
}) {
  const steps = [
    { name: 'Job details', href: '/tailoring' },
    { name: 'Analysis', href: analysis },
    { name: 'Suggestions', href: version && `${version}/suggestions` },
    { name: 'Updated resume', href: version && `${version}/resume` },
  ];
  return (
    <nav aria-label="Tailoring stages" className="tailoring-stages">
      <ol>
        {steps.map((step, index) => (
          <li key={step.name}>
            {step.href ? (
              <NavLink end to={step.href}>
                <span aria-hidden="true">{index + 1}</span>
                {step.name}
              </NavLink>
            ) : (
              <span className="muted">
                <span aria-hidden="true">{index + 1}</span>
                {step.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
