// Public development probes: structural composition and boundaries of the taught profile.
const truth = (id, text, value = 'true') => ({ id, task: 'reason', text,
  expect: { kind: 'truth', truth: value, gaps: 0, ...(value === 'unknown' ? {} : { proof: true }) } });
const select = (id, text, values) => ({ id, task: 'reason', text,
  expect: { kind: 'select', values, gaps: 0, proof: true } });

export const relationalCases = [
  truth('relational-grandparent-depth', 'Kira is a mother of Leno. Leno is a father of Miri. Is Kira a grandparent of Miri?'),
  truth('relational-grandchild-inverse', 'Kira is a parent of Leno. Leno is a parent of Miri. Is Miri a grandchild of Kira?'),
  truth('relational-parent-is-not-symmetric', 'Kira is a parent of Leno. Is Leno a parent of Kira?', 'unknown'),
  truth('relational-grandparent-is-not-transitive', 'Kira is a parent of Leno. Leno is a parent of Miri. Miri is a parent of Neri. Is Kira a grandparent of Neri?', 'unknown'),
  truth('relational-ancestor-chain', 'Kira is a parent of Leno. Leno is a parent of Miri. Miri is a parent of Neri. Is Kira an ancestor of Neri?'),
  truth('relational-sibling-inverse', 'Leno is a brother of Miri. Is Miri a sibling of Leno?'),
  truth('relational-no-gender-reversal', 'Leno is a brother of Miri. Is Miri a brother of Leno?', 'unknown'),
  truth('relational-siblings-not-transitive', 'Leno is a sibling of Miri. Miri is a sibling of Neri. Is Leno a sibling of Neri?', 'unknown'),
  truth('relational-no-shared-parent-shortcut', 'Kira is a parent of Leno. Kira is a parent of Miri. Is Leno a sibling of Miri?', 'unknown'),
  truth('relational-world-scope', 'Kira believes that Leno is a brother of Miri. Is Miri a sibling of Leno?', 'unknown'),
  truth('relational-negative-is-not-supertype-negative', 'Kira is not a mother of Leno. Is Kira a parent of Leno?', 'unknown'),
  truth('relational-relative-restriction', 'Every pilot who is a mentor of Neri is careful. Kala is a pilot. Kala mentors Neri. Is Kala careful?'),
  truth('relational-relative-wrong-object', 'Every pilot who is a mentor of Neri is careful. Kala is a pilot. Kala mentors Leno. Is Kala careful?', 'unknown'),
  truth('relational-user-composition', 'If X is a member of Y and Y is a part of Z then X supports Z. Orin is a member of Guild. Guild is a part of Union. Does Orin support Union?'),
  truth('relational-user-composition-wrong-join', 'If X is a member of Y and Y is a part of Z then X supports Z. Orin is a member of Guild. Club is a part of Union. Does Orin support Union?', 'unknown'),
  select('relational-object-selection', 'Kala is a mentor of Neri. Kala mentors Leno. Orin mentors Miri. Who is Kala a mentor of?', ['leno', 'neri']),
  select('relational-subject-selection', 'Kala is a mentor of Neri. Orin mentors Neri. Kala mentors Leno. Who is a mentor of Neri?', ['kala', 'orin']),
  truth('relational-containment-chain', 'Token is in Case. Case is in Cabinet. Cabinet is in Room. Is Token in Room?'),
  truth('relational-containment-no-sibling-edge', 'Token is in Case. Coin is in Case. Is Token in Coin?', 'unknown'),
  truth('relational-direction-inverse', 'Cedar is left of Birch. Is Birch right of Cedar?'),
  truth('relational-direction-chain', 'Cedar is left of Birch. Birch is left of Maple. Is Maple right of Cedar?'),
  truth('relational-order-negative-reverse', 'Cedar is taller than Birch. Is Birch taller than Cedar?', 'false'),
  truth('relational-order-chain', 'Cedar is taller than Birch. Birch is taller than Maple. Is Maple shorter than Cedar?'),
  truth('relational-order-dimension-isolation', 'Cedar is taller than Birch. Is Cedar heavier than Birch?', 'unknown'),
  truth('relational-order-contradiction', 'Cedar is taller than Birch. Birch is taller than Cedar. Is Cedar taller than Birch?', 'both'),
  truth('relational-order-no-explosion', 'Cedar is taller than Birch. Birch is taller than Cedar. Is Maple heavier than Cedar?', 'unknown'),
  truth('relational-temporal-chain', 'Packing is before Departure. Arrival is after Departure. Is Packing before Arrival?'),
  truth('relational-temporal-no-overlap-inference', 'Packing is before Departure. Reading is before Departure. Is Packing before Reading?', 'unknown'),
  { id: 'relational-count-form-identity', task: 'reason',
    text: 'Kala has 8 books. Kala gets 1 book. Kala gives 2 books to Neri. How many books does Kala have?',
    expect: { kind: 'quantity', value: '7', gaps: 0 } }
];
