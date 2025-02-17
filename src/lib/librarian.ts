import type NDK from '@nostr-dev-kit/ndk';
import Pharos from './parser/pharos';
import PublicationTree from './publication_tree/publication_tree';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { depthFirstFindEvent } from './publication_tree/publication_tree_traversal';
import { getSectionContent } from './parser/pharos_utils';

export class Librarian {
  private ndk: NDK;
  private publication: PublicationTree;

  constructor(publicationIndex: NDKEvent, ndk: NDK) {
    this.ndk = ndk;
    this.publication = new PublicationTree(publicationIndex);
  }

  /**
   * Retrieves the publication section containing the given target event.
   * @param target The target event, event ID, or event address indicating the point in the
   * publication the user wishes to view first.
   * @returns The parsed HTML content of the section containing the target event.
   */
  async retrieveSection(target: Readonly<NDKEvent> | Readonly<string>): Promise<string> {
    const targetEvent = await depthFirstFindEvent(target, this.publication, this.ndk);
    if (!targetEvent) {
      throw new Error('Target event not found in the publication.');
    }

    const parent = this.publication.getParent(targetEvent.id);
    if (!parent) {
      // TODO: Handle the case where the target event is the root index.
    }

    const sectionContent = await getSectionContent(parent!.event, this.publication);

    const parser = new Pharos();
    parser.parse(sectionContent);

    return parser.getHtml();
  }
}
