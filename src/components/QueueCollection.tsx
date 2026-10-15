import { useLibrary } from "../library/context";
import { queueExpression } from "../library/advanced-search";
import { referenceSource } from "../library/sources";
import { SelectionCollection } from "./SelectionCollection";
/** Capture the shared queue membership as an owner-private collection, independently of playback. */
export function QueueCollection() {
  const player = useLibrary().player;
  const references = () => player.queue().map((row) => row.reference);
  return (
    <SelectionCollection
      expression={queueExpression(
        references().map((ref) => ref.replace(/:@phemios\/(local|server)\//, ":")),
      )}
      source={referenceSource(references()[0] ?? "")}
      disabled={!references().length}
    />
  );
}
