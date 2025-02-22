export interface EventTree<NodeBase> extends Iterable<EventTreeNode<NodeBase>> {
  getRootNode(): EventTreeNode<NodeBase>;
  getNodeByAddress(address: string): EventTreeNode<NodeBase>;
  addNode(node: NodeBase, parentNode: EventTreeNode<NodeBase>): void;
  clear(): void;
}

export interface EventTreeNode<NodeBase> {
  node: NodeBase;
  address: string;
  title: string;
  content?: string;
  parent?: EventTreeNode<NodeBase>;
  children: EventTreeNode<NodeBase>[];
}