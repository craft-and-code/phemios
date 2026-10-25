/** Fictional row geometry for insertion tests, independent of browser timing and layout. */
export function insertionFixture(items = ["a", "b", "c"], attribute = "data-object-item") {
  const inside = new Set<unknown>();
  const list = {
    contains: (hit: unknown) => inside.has(hit),
    getBoundingClientRect: () => ({ top: 100, bottom: 300 }),
    children: [] as unknown[],
  };
  const rows = items.map((id, index) => {
    const row = {
      parentElement: list,
      getAttribute: (name: string) => (name === attribute ? id : null),
      getBoundingClientRect: () => ({
        top: 100 + index * 30,
        height: 20,
        bottom: 120 + index * 30,
      }),
      closest: () => row,
    };
    inside.add(row);
    return row as unknown as HTMLLIElement;
  });
  list.children = rows;
  const child = { closest: () => rows[1] } as unknown as Element;
  inside.add(child);
  return { list: list as unknown as HTMLElement, rows, child, items };
}
