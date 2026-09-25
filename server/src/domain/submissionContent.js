import { detectCode } from '../evaluation/commonMistakes.js';

function normalizeDiagram(diagram) {
  const source = diagram && typeof diagram === 'object' && !Array.isArray(diagram) ? diagram : {};
  return {
    nodes: Array.isArray(source.nodes) ? source.nodes : [],
    edges: Array.isArray(source.edges) ? source.edges : [],
  };
}

function nodeLabel(node) {
  return String(node?.data?.label || node?.data?.title || node?.id || 'Unnamed node').trim();
}

// The single place text/diagram payloads coming from a draft save or a submit
// are normalized, so the shape is identical everywhere it is used.
export class SubmissionContent {
  constructor({ textContent, diagram } = {}) {
    this.textContent = String(textContent ?? '');
    this.diagram = normalizeDiagram(diagram);
  }

  get detectedCode() {
    return detectCode(this.textContent);
  }

  // Plain-text relationship map used for evaluator prompts and for the
  // diagram-aware precheck (see evaluation/commonMistakes.js).
  serializeDiagram() {
    const { nodes, edges } = this.diagram;
    const lookup = new Map(nodes.map((node) => [node.id, nodeLabel(node)]));
    const lines = nodes.map((node) => {
      const details = String(node?.data?.details || '').trim();
      return `${nodeLabel(node)}${details ? ` — ${details}` : ''}`;
    });
    for (const edge of edges) {
      const source = lookup.get(edge.source) || edge.source;
      const target = lookup.get(edge.target) || edge.target;
      const label = edge?.label ? ` [${edge.label}]` : '';
      lines.push(`${source} --${label}→ ${target}`);
    }
    return lines.join('\n');
  }
}
