import { VIEW_NAMES } from "./schema.js";
import type { LogicalLayer, Mapping, PmModel, PmNode, ViewName } from "./schema.js";

/** 一组跨视图支撑：来自一条 mapping */
export interface SupportGroup {
  kind: Mapping["kind"];
  require: Mapping["require"];
  targets: readonly string[];
}

export interface GraphNode {
  id: string;
  name: string;
  view: ViewName;
  layer: LogicalLayer | undefined;
  hasAcceptance: boolean;
  hasSpec: boolean;
  hardDeps: readonly string[];
  softDeps: readonly string[];
  groups: readonly SupportGroup[];
}

export interface Graph {
  /** 按 pm.yaml 声明顺序：functional → logical → physical */
  order: readonly string[];
  nodes: ReadonlyMap<string, GraphNode>;
}

export const allNodes = (model: PmModel): { node: PmNode; view: ViewName }[] =>
  VIEW_NAMES.flatMap((view) => (model.views[view] as PmNode[]).map((node) => ({ node, view })));

export const buildGraph = (model: PmModel): Graph => {
  const nodes = new Map<string, GraphNode>(
    allNodes(model).map(({ node, view }) => [
      node.id,
      {
        id: node.id,
        name: node.name,
        view,
        layer: node.layer,
        hasAcceptance: node.acceptance.length > 0,
        hasSpec: node.spec !== undefined,
        hardDeps: node.depends.filter((d) => d.kind === "hard").map((d) => d.on),
        softDeps: node.depends.filter((d) => d.kind === "soft").map((d) => d.on),
        groups: model.mappings
          .filter((m) => m.from === node.id)
          .map((m) => ({ kind: m.kind, require: m.require, targets: m.to })),
      },
    ]),
  );
  return { order: [...nodes.keys()], nodes };
};

export const getNode = (graph: Graph, id: string): GraphNode => {
  const node = graph.nodes.get(id);
  if (!node) throw new Error(`未知节点：${id}`);
  return node;
};

/** 一个节点生效所依赖的全部上游：本视图硬依赖 + 跨视图支撑 */
export const supportsOf = (node: GraphNode): string[] => [...node.hardDeps, ...node.groups.flatMap((g) => g.targets)];

/** 上游闭包（含自身），按声明顺序返回 */
export const upstream = (graph: Graph, id: string): string[] => {
  const seen = new Set<string>();
  const walk = (x: string): void => {
    if (seen.has(x)) return;
    seen.add(x);
    supportsOf(getNode(graph, x)).forEach(walk);
  };
  walk(id);
  return graph.order.filter((x) => seen.has(x));
};

/** 在本视图依赖（含软依赖）与映射组成的图里找环；无环返回 null */
export const findCycle = (model: PmModel): string[] | null => {
  const graph = buildGraph(model);
  const edges = (n: GraphNode): string[] => [...n.hardDeps, ...n.softDeps, ...n.groups.flatMap((g) => g.targets)];
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === "done") return null;
    if (state.get(id) === "visiting") return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, "visiting");
    stack.push(id);
    for (const next of edges(getNode(graph, id))) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  };
  for (const id of graph.order) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
};
