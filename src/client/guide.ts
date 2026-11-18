export type GuideEntry = {
  id: string;
  title: string;
  metals: string;
  gold: string;
  summary: string;
  action: string;
};

export const GUIDE_ENTRIES: GuideEntry[] = [
  {
    id: 'fingers',
    title: 'Gold fingers and edge connectors',
    metals: 'Gold over nickel, on copper',
    gold: 'Usually the best visible gold',
    summary:
      'The striped contacts on RAM, PCIe cards, and older expansion boards are plated so they survive being plugged in over and over. That plate is hard gold over nickel, not solid gold. Older or high-wear fingers are thicker than the thin flash on a lot of modern cards. They are still the classic keeper on a board.',
    action: 'If the fingers are obvious, shear or snap that edge off and bag it on its own. Leave the fiberglass with the lower-grade board.',
  },
  {
    id: 'cpu',
    title: 'CPUs and SoCs',
    metals: 'Gold bond wires; gold pins on some old ceramic packages',
    gold: 'High only on old ceramic parts',
    summary:
      'The famous scrap CPUs are ceramic pin-grid parts with gold-plated pins, and sometimes a gold-plated lid. A modern plastic or organic processor on a laptop or phone board is a different object: any gold is mostly internal bond wire, and a lot of newer chips switched that wire to copper. A black square is not automatically high grade.',
    action: 'Set aside ceramic processors with gold-colored pins. Do not assume a phone chip is a payday.',
  },
  {
    id: 'ic',
    title: 'BGA and other IC chips',
    metals: 'Possible gold bond wires; sometimes none you can see',
    gold: 'Usually low from the outside',
    summary:
      'Integrated circuits can contain very fine bond wires. On older and some high-reliability parts those wires are gold. On a lot of newer consumer chips they are copper, and the photo cannot tell you which. Northbridge-style chipsets and ceramic ICs are more interesting than a field of tiny black logic chips. The package color is a weak clue.',
    action: 'Harvest a few large chips if you are already stripping the board. Picking every small IC off a modern motherboard is usually a poor hour.',
  },
  {
    id: 'pins',
    title: 'Pin connectors, slots, and headers',
    metals: 'Often a thin gold flash over nickel; some contacts are tin',
    gold: 'Medium when the pins actually look gold',
    summary:
      'CPU sockets, slot connectors, and many pin headers are sold as “gold pin” scrap because the contact surface may be a thin gold flash. The plastic body is not the value. Some pins are tin, and a photo of the housing is only a hint.',
    action: 'Clip off connector assemblies that show gold-colored pins. Keep them separate from bare board.',
  },
  {
    id: 'crystal',
    title: 'Crystal oscillators',
    metals: 'Mostly the metal can and quartz',
    gold: 'Not a real target',
    summary:
      'The shiny oval or rectangle can is a sealed quartz crystal. It is not a meaningful gold, silver, or palladium source. Leads may have an ordinary plating, the same as countless other parts.',
    action: 'Leave crystals on the board unless you are stripping it for a better reason.',
  },
  {
    id: 'mlcc',
    title: 'MLCC ceramic capacitors',
    metals: 'Sometimes palladium or silver; modern ones are often nickel',
    gold: 'Not gold',
    summary:
      'Older precious-metal-electrode MLCCs used silver-palladium in the internal electrodes. Most modern consumer MLCCs switched to nickel (a base metal). The outside of the chip does not tell you which chemistry is inside, and each part is tiny.',
    action: 'Do not pick individual MLCCs for gold. Buyers who want them want bulk, and many lots are worth less than the time.',
  },
  {
    id: 'tantalum',
    title: 'Tantalum capacitors',
    metals: 'Tantalum',
    gold: 'No gold to speak of',
    summary:
      'These are the molded yellow, beige, or black capacitors, often with a polarity stripe. The valuable content is tantalum metal, a specialty metal, not gold. Small numbers from one phone board rarely justify a special trip.',
    action: 'Collect them only if you have a buyer who actually pays for tantalum. Otherwise leave them.',
  },
  {
    id: 'relay',
    title: 'Relays',
    metals: 'Gold on some signal contacts; silver alloys on many power relays',
    gold: 'A maybe',
    summary:
      'Telecom and small-signal relays sometimes use gold-plated contacts so weak signals do not corrode. Power relays more often use silver or silver alloy. The outer can does not prove which contact is inside.',
    action: 'Treat a relay as a question mark. Do not price the board off one unmarked can.',
  },
  {
    id: 'pth',
    title: 'Plated through-holes and vias',
    metals: 'Copper barrels; pads may share a thin gold surface finish',
    gold: 'Low, and usually not worth boxing every hole',
    summary:
      'The inside of a via is electroplated copper. Gold, when the board has it, is in the surface finish: a thin immersion-gold coat over nickel (ENIG) on the pads, which protects the copper. That film is not a gold bar, and HASL or OSP finishes have no gold layer at all.',
    action: 'Do not drill holes out of a board chasing gold. If the pads look gold-finished, that is a thin coat on a whole-board grade, not a pile of fingers.',
  },
];

export const BOARD_GRADES = [
  {
    letter: 'A',
    name: 'High grade',
    means: 'Dense, obvious gold: a ceramic CPU, heavy gold fingers, or a board covered in gold-plated connectors.',
  },
  {
    letter: 'B',
    name: 'Medium grade',
    means: 'A normal motherboard, GPU, or RAM stick. Worth sorting the fingers, slots, and a few chips, then selling the rest as board scrap.',
  },
  {
    letter: 'C',
    name: 'Light grade',
    means: 'Phone boards, hard-drive controller boards, and sparse cards. There may be a keeper or two. The board itself is usually a light lot.',
  },
  {
    letter: 'D',
    name: 'Low grade',
    means: 'Power boards, mostly empty boards, or a photo that is not a precious-metal candidate. Copper and solder, little reason to hunt gold.',
  },
];
