const COFFEE_URL = 'https://buymeacoffee.com/anthonyleebuilds';

export function CoffeeLink({ lead }: { lead?: string }) {
  return (
    <a className="coffee" href={COFFEE_URL} target="_blank" rel="noreferrer">
      {lead ? `${lead} ` : null}
      Buy me a coffee
    </a>
  );
}
