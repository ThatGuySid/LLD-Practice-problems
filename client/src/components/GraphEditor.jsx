import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function ClassNode({ data }) {
  return (
    <div className="class-node">
      <Handle type="target" position={Position.Left} />
      <div className="class-node-title">{data.label}</div>
      {data.details ? <div className="class-node-details">{data.details}</div> : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { classNode: ClassNode };

export default function GraphEditor({ value, onChange }) {
  const [label, setLabel] = useState('');
  const [details, setDetails] = useState('');
  const nodes = value?.nodes || [];
  const edges = value?.edges || [];

  const onNodesChange = useCallback((changes) => {
    onChange({ ...value, nodes: applyNodeChanges(changes, nodes) });
  }, [onChange, value, nodes]);

  const onEdgesChange = useCallback((changes) => {
    onChange({ ...value, edges: applyEdgeChanges(changes, edges) });
  }, [onChange, value, edges]);

  const onConnect = useCallback((params) => {
    onChange({ ...value, edges: addEdge({ ...params, type: 'smoothstep', animated: false }, edges) });
  }, [onChange, value, edges]);

  const addNode = () => {
    const name = label.trim();
    if (!name) return;
    const id = `node-${Date.now()}`;
    const next = {
      id,
      type: 'classNode',
      position: { x: 100 + (nodes.length % 3) * 240, y: 100 + Math.floor(nodes.length / 3) * 150 },
      data: { label: name, details: details.trim() },
    };
    onChange({ nodes: [...nodes, next], edges });
    setLabel('');
    setDetails('');
  };

  const clear = () => onChange({ nodes: [], edges: [] });
  const nodeCount = useMemo(() => nodes.length, [nodes]);

  return (
    <div className="graph-editor">
      <div className="graph-toolbar">
        <div>
          <div className="eyebrow">Design canvas</div>
          <div className="graph-title">Map your classes & relationships</div>
        </div>
        <div className="graph-count">{nodeCount} class{nodeCount === 1 ? '' : 'es'} · {edges.length} link{edges.length === 1 ? '' : 's'}</div>
      </div>
      <div className="graph-controls-panel">
        <input aria-label="Class name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Class name" onKeyDown={(e) => e.key === 'Enter' && addNode()} />
        <input aria-label="Responsibility or detail (optional)" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Optional responsibility / detail" onKeyDown={(e) => e.key === 'Enter' && addNode()} />
        <button className="small-button primary" onClick={addNode}>+ Add class</button>
        <button className="small-button ghost" onClick={clear}>Clear</button>
      </div>
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          connectionLineType="smoothstep"
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Background gap={22} size={1} />
        </ReactFlow>
        {nodes.length === 0 && (
          <div className="graph-empty">
            <div className="graph-empty-icon" aria-hidden="true">＋</div>
            <strong>Start with a class</strong>
            <span>Add a class above, then drag from a node handle to connect it.</span>
          </div>
        )}
      </div>
      <div className="graph-hint">Tip: keep nodes focused on responsibilities. The saved graph is converted to a plain-text relationship map before AI evaluation.</div>
    </div>
  );
}
