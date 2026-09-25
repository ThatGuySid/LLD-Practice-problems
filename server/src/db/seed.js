import { pool } from './pool.js';

const problems = [
  {
    slug: 'parking-lot',
    title: 'Parking Lot',
    summary: 'Design a parking system that assigns vehicles to suitable spots and manages tickets and exits.',
    prompt: `Design an object-oriented parking lot system. The system should support multiple vehicle types, different parking spot sizes, entry and exit flows, ticket generation, spot assignment, and fee calculation. Explain your key classes, responsibilities, relationships, and how the design could evolve for new vehicle or pricing rules.`,
    requirements: [
      'Support multiple vehicle types and compatible parking spot sizes.',
      'Assign an available spot when a vehicle enters and issue a ticket.',
      'Release the spot when the vehicle exits and calculate the fee.',
      'Allow the design to evolve when new pricing or vehicle rules are added.',
      'Keep responsibilities cohesive and dependencies manageable.',
    ],
  },
  {
    slug: 'elevator',
    title: 'Elevator',
    summary: 'Design an elevator control system that handles requests, movement, doors, and multiple cars.',
    prompt: `Design an elevator system for a multi-floor building. The system should accept internal and external requests, move elevators safely between floors, open and close doors, and select an elevator for a request. Explain responsibilities, state, request handling, and how the design would accommodate different scheduling strategies.`,
    requirements: [
      'Represent floors, elevator cars, requests, and door/movement state.',
      'Handle both hall calls and requests made inside an elevator.',
      'Use a clear policy for selecting or scheduling elevator movement.',
      'Keep safety-sensitive state changes explicit.',
      'Make the scheduling policy replaceable without rewriting the elevator domain.',
    ],
  },
  {
    slug: 'vending-machine',
    title: 'Vending Machine',
    summary: 'Design a vending machine that manages inventory, selection, payment, dispensing, and change.',
    prompt: `Design a vending machine that accepts product selections and payments, validates inventory, dispenses a product, and returns change. Explain the classes and state transitions. Your design should make it easy to add payment methods or product rules later.`,
    requirements: [
      'Track products and inventory quantities.',
      'Allow a customer to select an item and handle out-of-stock cases.',
      'Support payment and validate whether enough value was provided.',
      'Dispense the selected product and calculate/refund change.',
      'Make payment methods and product/price rules replaceable or extensible.',
    ],
  },
];

for (const problem of problems) {
  await pool.query(
    `INSERT INTO problems(slug, title, summary, prompt, requirements)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       prompt = EXCLUDED.prompt,
       requirements = EXCLUDED.requirements`,
    [problem.slug, problem.title, problem.summary, problem.prompt, JSON.stringify(problem.requirements)],
  );
}

console.log(`Seeded ${problems.length} problems.`);
await pool.end();
