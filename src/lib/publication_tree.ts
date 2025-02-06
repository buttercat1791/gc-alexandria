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
  /**
   * The root node of the tree.
   */
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

  /**
   * Retrieves the parent node of an event in the tree.
   * @param event The event or event ID of the node whose parent is to be retrieved.
   * @returns The parent node of the event, or `null` if the event is not found or has no parent.
   */
  getParent(event: NDKEvent | string): PublicationTreeNode | null {
    if (typeof event === 'string') {
      return this.getNode(event)?.parent ?? null;
    }

    return this.getNode(event.id)?.parent ?? null;
  }

  /**
   * Retrieves the child nodes of an event in the tree.
   * @param event The event or event ID of the node whose children are to be retrieved.
   * @returns The child nodes of the event, or an empty array if the event is not found or has no
   * children.
   */
  getChildren(event: NDKEvent | string): PublicationTreeNode[] {
    if (typeof event === 'string') {
      return this.getNode(event)?.children ?? [];
    }

    return this.getNode(event.id)?.children ?? [];
  }

  /**
   * Retrieves the sibling nodes of an event in the tree.
   * @param event The event or event ID of the node whose siblings are to be retrieved.
   * @returns The sibling nodes of the event, minus the given event itself, or an empty array if
   * the event is not found or has no siblings.
   */
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
}
