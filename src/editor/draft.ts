/** Ignore initialization/normalization; untouched notes retain their exact server bytes. */
export function markdownDraft(value: string, publish: (value: string) => void) {
  let source = value,
    serialized = "",
    ready = false,
    replacing = false;
  return {
    initialized(markdown: string) {
      serialized = markdown;
      ready = true;
    },
    differs(value: string) {
      return value !== source;
    },
    replace(value: string, update: () => string) {
      replacing = true;
      try {
        serialized = update();
        source = value;
      } finally {
        replacing = false;
      }
    },
    read(value: string) {
      this.changed(value);
      return source;
    },
    changed(value: string) {
      if (!ready || replacing || value === serialized) return;
      serialized = value;
      source = value;
      publish(value);
    },
  };
}
