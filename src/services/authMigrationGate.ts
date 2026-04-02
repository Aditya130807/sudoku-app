let activeMigrationCount = 0;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function isAuthMigrationInProgress(): boolean {
  return activeMigrationCount > 0;
}

export function beginAuthMigration(): () => void {
  activeMigrationCount += 1;
  emitChange();

  let closed = false;

  return () => {
    if (closed) {
      return;
    }

    closed = true;
    activeMigrationCount = Math.max(0, activeMigrationCount - 1);
    emitChange();
  };
}

export function subscribeToAuthMigration(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function waitForAuthMigrationToFinish(): Promise<void> {
  if (!isAuthMigrationInProgress()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const unsubscribe = subscribeToAuthMigration(() => {
      if (isAuthMigrationInProgress()) {
        return;
      }

      unsubscribe();
      resolve();
    });
  });
}
