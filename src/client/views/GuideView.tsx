import { BOARD_GRADES, GUIDE_ENTRIES } from '../guide';

export function GuideView() {
  return (
    <article className="guide rise">
      <p className="eyebrow">Gold reference</p>
      <h1>What on a board is actually worth a look.</h1>
      <p className="lede">
        This is a field guide for sorting, not a lab report. A photo cannot weigh a plating or see bond wires inside a chip. Where a dollar figure would be a guess, it is left out.
      </p>
      <section className="callout safety">
        <h2>Safety and the law</h2>
        <p>
          Do not refine boards at home with acids, aqua regia, cyanide, mercury, or similar chemistry. Those processes can poison you, and dumping the waste is often illegal. GoldSpotter will not give those instructions.
        </p>
        <p>
          Solder can contain lead. Wash your hands. Do not burn boards: the smoke carries heavy metals and flame-retardant chemicals. Sell sorted material to a reputable refiner, or use a certified recycler such as an{' '}
          <a href="https://e-stewards.org/" target="_blank" rel="noreferrer">e-Stewards</a> or{' '}
          <a href="https://sustainableelectronics.org/" target="_blank" rel="noreferrer">R2</a> facility. Follow local e-waste rules. The U.S. EPA’s overview is a good starting point:{' '}
          <a href="https://www.epa.gov/recycle/electronics-donation-and-recycling" target="_blank" rel="noreferrer">Electronics Donation and Recycling</a>.
        </p>
      </section>
      <section>
        <h2>How scrappers talk about board grade</h2>
        <p>
          Buyers usually pay for a whole category by weight, not for one photographed chip. A high-grade lot (ceramic processors, gold-finger cards, dense gold pins) brings more per pound than a low-grade lot (power boards, sparsely populated scrap). The number changes with metal prices, how many pounds you have, and who processes it. Get a quote. The letter GoldSpotter shows is a photo summary of that kind of category.
        </p>
        <ol className="grade-key">
          {BOARD_GRADES.map((grade) => (
            <li key={grade.letter}>
              <span className={`key-letter grade-${grade.letter.toLowerCase()}`}>{grade.letter}</span>
              <span>
                <strong>{grade.name}</strong>
                <span>{grade.means}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>Parts</h2>
        <div className="guide-list">
          {GUIDE_ENTRIES.map((entry) => (
            <section key={entry.id} id={entry.id} className="guide-card">
              <header>
                <h3>{entry.title}</h3>
                <p className="gold-line">{entry.gold}</p>
              </header>
              <p className="meta">{entry.metals}</p>
              <p>{entry.summary}</p>
              <p className="action">{entry.action}</p>
            </section>
          ))}
        </div>
      </section>
      <section>
        <h2>Where this comes from</h2>
        <ul className="sources">
          <li>Edge connectors are plated with hard gold over nickel so the contact survives repeated mating. That is ordinary connector practice, not a measurement of your board.</li>
          <li>ENIG, a common board finish, is a thin immersion-gold film over nickel. It is a coating, not a recoverable “gold bar,” and many boards use HASL or OSP instead.</li>
          <li>IC bond wires were historically gold; copper wire bonding is widespread on newer consumer chips. The package does not show the wire.</li>
          <li>MLCC electrodes are either precious-metal (silver/palladium) or base-metal (usually nickel). Modern consumer boards are mostly the latter.</li>
          <li>
            Disposal framing follows the U.S. EPA electronics pages:{' '}
            <a href="https://www.epa.gov/recycle/electronics-donation-and-recycling" target="_blank" rel="noreferrer">donation and recycling</a>
            {' '}and{' '}
            <a href="https://www.epa.gov/smm-electronics" target="_blank" rel="noreferrer">sustainable management of electronics</a>.
          </li>
        </ul>
      </section>
    </article>
  );
}
