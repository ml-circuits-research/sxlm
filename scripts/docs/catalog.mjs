export const groups = [
  ['Start', [
    ['Overview', 'index.html', 'Project purpose, architecture boundary and reading paths.'],
    ['Chat', 'chat.html', 'Attach documents, wait for coding and discuss their source-grounded interpretation.'],
    ['Usage', 'usage.html', 'Start the workbench and run verified language examples.'],
    ['Interfaces', 'interfaces.html', 'Programmatic integration, commands and structured HTTP messages.'],
  ]],
  ['Model', [
    ['Architecture', 'architecture.html', 'Responsibilities, formal semantics and transactional evidence.'],
    ['SOP', 'sop.html', 'Typed source syntax, immutable values and structured control.'],
    ['Lexical policy', 'lexical-policy.html', 'Terminal callbacks, Unicode choices, exact offsets and native limits.'],
    ['Relations', 'formal-relations.html', 'Signed finite closure, contextual joins and proof obligations.'],
    ['Planning', 'formal-planning.html', 'Finite action search, cost semantics and witness replay.'],
    ['Text tasks', 'text-tasks.html', 'Extractive summaries and qualified finite-context completion.'],
    ['Expression lowering', 'expression-lowering.html', 'Offline compilation, value identity and preserved semantics.'],
  ]],
  ['Learning', [
    ['Training', 'training.html', 'Teaching inputs, hypothesis search and activation requirements.'],
    ['Evaluation', 'evaluation.html', 'Separated measurements, reproducibility and visible failures.'],
    ['Design decisions', 'next.html', 'Architecture tradeoffs and criteria for extension and scaling.'],
  ]],
  ['Reference', [
    ['Specifications', 'specsLoader.html?spec=matrix.md', 'Normative contracts in the contiguous design specification set.'],
    ['Wiki', 'wiki.html', 'Canonical definitions and boundaries of project terminology.'],
  ]],
];

export const sources = [
  ['INDEX', 'index', 'DS000-vision.md'],
  ['CHAT', 'chat', 'DS013-document-chat.md'],
  ['USAGE', 'usage', 'DS010-interfaces-and-operations.md'],
  ['INTERFACES', 'interfaces', 'DS010-interfaces-and-operations.md'],
  ['ARCHITECTURE', 'architecture', 'DS002-sop-runtime.md'],
  ['SOP', 'sop', 'DS002-sop-runtime.md'],
  ['LEXICAL-POLICY', 'lexical-policy', 'DS004-language-interpretation.md'],
  ['FORMAL-RELATIONS', 'formal-relations', 'DS005-reasoning-and-state.md'],
  ['FORMAL-PLANNING', 'formal-planning', 'DS007-formal-planning.md'],
  ['TEXT-TASKS', 'text-tasks', 'DS006-summarization-and-completion.md'],
  ['EXPRESSION-LOWERING', 'expression-lowering', 'DS002-sop-runtime.md'],
  ['TRAINING', 'training', 'DS008-learning-and-promotion.md'],
  ['EVALUATION', 'evaluation', 'DS011-evaluation-and-evidence.md'],
  ['NEXT', 'next', 'DS000-vision.md'],
  ['WIKI', 'wiki', 'DS012-terminology.md'],
];

export const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
