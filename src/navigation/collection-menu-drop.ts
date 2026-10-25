import { addCollectionMenu, type CollectionMenuId } from "./collection-menu";
import { reorderObjects } from "../library/object-list";
import type { MenuItem, MenuPreferences } from "./menu-preferences";
/** A drag retains its exact initiating list/account and revalidates names before publication. */
export function dropCollectionMenu(
  value: MenuPreferences,
  drag: { name: string; label: string; identity: unknown; targetId?: string | undefined },
  identity: unknown,
  names: readonly string[],
  id: CollectionMenuId,
  before?: MenuItem,
  rows?: readonly { id: string; name: string }[],
): MenuPreferences {
  if (
    !identity ||
    drag.identity !== identity ||
    !names.includes(drag.name) ||
    (rows !== undefined &&
      !rows.some((row) => row.id === drag.targetId && row.name === drag.name)) ||
    (before !== undefined && !value.order.includes(before))
  )
    return value;
  const next = addCollectionMenu(value, id, drag.name, drag.label, drag.targetId);
  return { ...next, order: reorderObjects(next.order, id, before) as MenuItem[] };
}
