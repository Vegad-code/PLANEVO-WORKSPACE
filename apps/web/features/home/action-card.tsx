import Link from "next/link";
import type { IconName } from "@/components/ui/planevo-icon";
import { Icon } from "@/components/ui/planevo-icon";

const cardClass =
  "group flex w-full flex-col rounded-card border border-border bg-surface-raised p-4 text-left outline-none transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none";

function CardBody({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <>
      <div className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-paper">
        <span className="flex size-10 items-center justify-center rounded-full bg-ink text-paper">
          <Icon name={icon} className="size-5" />
        </span>
      </div>
      <h2 className="mt-4 text-body font-medium">{title}</h2>
      <p className="mt-1 text-small text-text-secondary">{description}</p>
    </>
  );
}

export function ActionCard({
  icon,
  title,
  description,
  href,
  onClick,
  formAction,
}: {
  icon: IconName;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  formAction?: (formData: FormData) => void;
}) {
  if (href) {
    return (
      <Link href={href} className={cardClass}>
        <CardBody icon={icon} title={title} description={description} />
      </Link>
    );
  }

  if (formAction) {
    return (
      <form action={formAction} className="contents">
        <button type="submit" className={cardClass}>
          <CardBody icon={icon} title={title} description={description} />
        </button>
      </form>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cardClass}>
      <CardBody icon={icon} title={title} description={description} />
    </button>
  );
}
