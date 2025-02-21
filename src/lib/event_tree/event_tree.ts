export interface EventTree extends Iterable<EventTreeNode> {
  getRootNode(): EventTreeNode;
  getNodeByDTag(dTag: string): EventTreeNode;
  addNode(node: EventTreeNode, parentNode: EventTreeNode): void;
  clear(): void;
}

export interface EventTreeNode {
  dTag: string;
  title: string;
  content?: string;
  parent?: EventTreeNode;
  children: EventTreeNode[];
}