export const RUBRIC = [
  {
    key: 'requirements',
    title: 'Requirements coverage',
    description: 'How completely and accurately the design addresses the problem requirements.',
  },
  {
    key: 'responsibilities',
    title: 'Responsibilities',
    description: 'Whether responsibilities are assigned to cohesive classes/components with clear boundaries.',
  },
  {
    key: 'coupling',
    title: 'Cohesion & coupling',
    description: 'Whether dependencies are sensible and the design avoids unnecessary knowledge or tight coupling.',
  },
  {
    key: 'encapsulation',
    title: 'Encapsulation & interfaces',
    description: 'Whether state and behavior are protected behind useful interfaces and abstractions.',
  },
  {
    key: 'abstraction',
    title: 'Abstraction & patterns',
    description: 'Whether abstractions or patterns are used when they solve a real problem rather than for decoration.',
  },
  {
    key: 'extensibility',
    title: 'Extensibility',
    description: 'How well the design can accommodate meaningful changes without broad rewrites.',
  },
  {
    key: 'edge_cases',
    title: 'Edge cases & testability',
    description: 'Whether important edge cases are considered and the design remains straightforward to test.',
  },
  {
    key: 'explanation',
    title: 'Explanation quality',
    description: 'Whether the learner explains decisions, trade-offs, and why the proposed design is appropriate.',
  },
];

export const RATINGS = ['Strong', 'Adequate', 'Needs work', 'Not addressed'];
export const CONFIDENCES = ['High', 'Medium', 'Low'];
