import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { getGraphData, resolveNotePath } from "@/lib/tauri-api";
import { useAppStore } from "@/stores/app-store";

export function GraphView() {
  const vaultPath = useAppStore((s) => s.vaultPath);
  const openFile = useAppStore((s) => s.openFile);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);

  const loadGraph = useCallback(async () => {
    if (!vaultPath) return;
    setLoading(true);
    try {
      const data = await getGraphData(vaultPath);
      const nodeMap = new Map<string, Node>();
      data.nodes.forEach((n, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        nodeMap.set(n.id, {
          id: n.id,
          data: { label: n.label },
          position: { x: col * 180, y: row * 100 },
          style: {
            fontSize: 12,
            width: Math.max(80, n.label.length * 8),
            padding: 8,
            borderRadius: 6,
            background: "var(--card)",
            border: "1px solid var(--border)",
          },
        });
      });
      setNodes([...nodeMap.values()]);
      setEdges(
        data.edges.map((e, i) => ({
          id: `e-${i}`,
          source: e.source,
          target: e.target,
          animated: false,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [vaultPath, setNodes, setEdges]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!vaultPath) return;
      void resolveNotePath(vaultPath, node.id).then((path) => {
        if (path) void openFile(path);
      });
    },
    [vaultPath, openFile],
  );

  if (!vaultPath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        打开 Vault 以查看关系图谱
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        加载图谱…
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
