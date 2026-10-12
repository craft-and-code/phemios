import { createEffect, createSignal, type Accessor } from "solid-js";

/** In-memory controlled fixtures follow edited Storybook args without touching application stores. */
export function controlledValue<T>(read: Accessor<T>) {
  const [value, setValue] = createSignal(read());
  createEffect(() => setValue(() => read()));
  return [value, (next: T) => setValue(() => next)] as const;
}
