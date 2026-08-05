import React from 'react';

export const lazyNamed = <T extends React.ComponentType<any>>(
  loader: () => Promise<unknown>,
  exportName: string
) =>
  React.lazy(async () => {
    const module = (await loader()) as Record<string, unknown>;
    const Component = module[exportName] ?? module.default;

    if (!Component) {
      throw new Error(`Lazy export "${exportName}" was not found.`);
    }

    return { default: Component as T };
  });
