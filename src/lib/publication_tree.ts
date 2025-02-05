import type { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Represents a node in the event tree composing a publication.  The data contained in the node is
 * a Nostr event, and the node contains links to its parent and children.
 */
interface PublicationTreeNode {
  event: NDKEvent;
  parent?: PublicationTreeNode;
  children: PublicationTreeNode[];
}

export class PublicationTree {
  private root: PublicationTreeNode;

  /**
   * A map of Nostr event IDs to their corresponding nodes.  This map allows `O(1)` lookup of Nostr
   * events that have already been stored in memory.
   */
  private nodes: Map<string, PublicationTreeNode> = new Map();

  constructor(rootEvent: NDKEvent) {
    this.root = {
      event: rootEvent,
      children: [],
    };
    this.nodes.set(rootEvent.id, this.root);
  }

  // #region Basic Tree Operations

  /**
   * Adds an event to the publication tree.
   * @param event The Nostr event to add to the tree.
   * @param parentId The ID of the parent event of the event to add.
   */
  addNode(event: NDKEvent, parentId: string) {
    const parentNode = this.nodes.get(parentId);
    if (parentNode == null) {
      // TODO: Consider better handling options for this case.
      throw new Error(`Parent node with id ${parentId} not found`);
    }

    // Michael J - 05 Feb 2025 - JS/TS passes object types by reference, so nodes within the tree
    // are linked by reference.
    const node: PublicationTreeNode = {
      event,
      parent: parentNode,
      children: [],
    };
    this.nodes.set(event.id, node);
    parentNode.children.push(node);
  }

  /**
   * Retrieves a node from the tree by its Nostr event ID.
   * @param eventId The Nostr event ID of the node to retrieve.
   * @returns The node corresponding to the Nostr event ID, or `null` if the node is not found.
   */
  getNode(eventId: string): PublicationTreeNode | null {
    return this.nodes.get(eventId) ?? null;
  }

  getParent(event: NDKEvent | string): PublicationTreeNode | null {
    if (typeof event === 'string') {
      return this.getNode(event)?.parent ?? null;
    }

    return this.getNode(event.id)?.parent ?? null;
  }

  getChildren(event: NDKEvent | string): PublicationTreeNode[] {
    if (typeof event === 'string') {
      return this.getNode(event)?.children ?? [];
    }

    return this.getNode(event.id)?.children ?? [];
  }

  getSiblings(event: NDKEvent | string): PublicationTreeNode[] {
    if (typeof event === 'string') {
      return this.getNode(event)
        ?.parent
        ?.children
        .filter((child) => child.event.id !== event) ?? [];
    }

    return this.getNode(event.id)
      ?.parent
      ?.children
      .filter((child) => child.event.id !== event.id) ?? [];
  }

  // #endregion

  // #region Traversal and Search

  // TODO: Add depth-first search.

  // #endregion
}
