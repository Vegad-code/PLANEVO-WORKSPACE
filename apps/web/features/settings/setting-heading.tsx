export function SettingHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-border pb-5">
      <h3 className="text-h2">{title}</h3>
      <p className="mt-1 max-w-2xl text-small text-text-secondary">
        {description}
      </p>
    </div>
  );
}
