import type { ItemDetail } from "./damaApi";

export type GraphNode = {
  label: string;
  children?: GraphNode[];
};

/**
 * Transforms a Knowledge Graph (nodes and edges) from ItemDetail into a tree-like GraphNode structure
 * suitable for the UI's Tree view.
 */
export function transformKnowledgeGraph(item: ItemDetail | null): GraphNode | null {
  if (!item) return null;
  if (item.graph) return item.graph as GraphNode;
  if (!item.knowledge_graph) return null;

  const kg = item.knowledge_graph as any;
  const nodesMap = new Map(kg.nodes.map((n: any) => [n.id, n]));

  // Find "root" nodes (those that are not targets of any edge, or specific types like 'Support')
  const targetIds = new Set(kg.edges.map((e: any) => e.target));
  const potentialRoots = kg.nodes.filter(
    (n: any) => !targetIds.has(n.id) || n.type === "Support",
  );

  // If we have Support nodes, prioritize them as roots
  const supportRoots = potentialRoots.filter((n: any) => n.type === 'Support');
  const roots = supportRoots.length > 0 ? supportRoots : potentialRoots;

  const buildTree = (nodeId: string): GraphNode => {
    const node = nodesMap.get(nodeId)! as any;
    const childEdges = (kg.edges as any[])
      .filter((e) => e.source === nodeId && e.relation !== "PARALLEL_TO")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
      label: node.pali ? `${node.label} (${node.pali})` : node.label,
      children:
        childEdges.length > 0
          ? childEdges.map((e) => buildTree(e.target))
          : undefined,
    };
  };

  return {
    label: "TEACHING STRUCTURE",
    children: roots.map((r: any) => buildTree(r.id)),
  } as GraphNode;
}
