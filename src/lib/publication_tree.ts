import type { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Represents a node in the event tree composing a publication.  The data contained in the node is
 * a Nostr event, and the node contains links to its parent and children.
 */
export interface PublicationTreeNode {
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
   * A map of Nostr event hex IDs to their corresponding nodes.  This map allows `O(1)` lookup of
   * Nostr events that have already been stored in memory.
   */
  private nodesById: Map<string, PublicationTreeNode> = new Map();

  /**
   * A map of addresses of Nostr replaceable events to their corresponding nodes.  Addresses are
   * of the format used by `a` tags.  This map allows `O(1)` lookup of Nostr events that have
   * already been stored in memory.
   */
  private nodesByAddress: Map<string, PublicationTreeNode> = new Map();

  constructor(rootEvent: NDKEvent) {
    this.root = {
      event: rootEvent,
      children: [],
    };
    this.nodesById.set(rootEvent.id, this.root);
    
    const address = this.getEventAddress(rootEvent);
    if (address) {
      this.nodesByAddress.set(address, this.root);
    }
  }

  // #region Getters and Setters

  get rootNode(): PublicationTreeNode {
    return this.root;
  }

  // #endregion

  // #region Basic Tree Operations

  /**
   * Adds an event to the publication tree.
   * @param event The Nostr event to add to the tree.
   * @param parent An identifier for the parent event of the event to add.  May be a Nostr event,
   * the hex ID of an event, or the address of a replaceable or parameterized replaceable event.
   * @throws An error if the parent event does not exist in the tree.
   */
  addNode(event: NDKEvent, parent: NDKEvent | string) {
    let parentNode: PublicationTreeNode | null;
    if (typeof parent === 'string') {
      parentNode = this.getNode(parent);
      if (parentNode == null) throw new Error(`Parent event ${parent} not found.`);
    } else {
      parentNode = this.getNode(parent.id);
      if (parentNode == null) throw new Error(`Parent event ${parent.id} not found.`);
    }

    // Michael J - 05 Feb 2025 - JS/TS passes object types by reference, so nodes within the tree
    // are linked by reference.
    const node: PublicationTreeNode = {
      event,
      parent: parentNode,
      children: [],
    };

    this.nodesById.set(event.id, node);

    const address = this.getEventAddress(event);
    if (address) {
      this.nodesByAddress.set(address, node);
    }

    parentNode.children.push(node);
  }

  /**
   * Retrieves a node from the tree by its Nostr event ID.
   * @param event An identifier for the node to retrieve.  May be a Nostr event, the hex ID of an
   * event, or the address of a replaceable or parameterized replaceable event.
   * @returns The node corresponding to the Nostr event ID, or `null` if the node is not found.
   */
  getNode(event: string | NDKEvent): PublicationTreeNode | null {
    if (typeof event === 'string') {
      return this.nodesById.get(event)
        ?? this.nodesByAddress.get(event)
        ?? null;
    }

    return this.nodesById.get(event.id) ?? null;
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

  // #region Private Helpers

  private getEventAddress(event: NDKEvent): string | null {
    if (event.isParamReplaceable()) {
      return `${event.kind}:${event.pubkey}:${event.dTag}`;
    } else if (event.isReplaceable()) {
      return `${event.kind}:${event.pubkey}`;
    }

    return null;
  }
}
