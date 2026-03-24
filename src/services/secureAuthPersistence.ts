import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

type PersistedAuthValue = unknown;

type FirebasePersistenceInstance = {
  type: "LOCAL";
  _isAvailable(): Promise<boolean>;
  _set(key: string, value: PersistedAuthValue): Promise<void>;
  _get<T>(key: string): Promise<T | null>;
  _remove(key: string): Promise<void>;
  _addListener(key: string, listener: unknown): void;
  _removeListener(key: string, listener: unknown): void;
};

type FirebasePersistenceFactory = new () => FirebasePersistenceInstance;

const SECURE_STORE_KEY_PREFIX = "firebase_auth";
const SECURE_STORE_PROBE_KEY = `${SECURE_STORE_KEY_PREFIX}.probe`;
const CHUNK_SIZE = 1500;
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "sudoku-ryve.firebase-auth",
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function encodeStorageKey(key: string) {
  return Array.from(key)
    .map((character) =>
      character.codePointAt(0)?.toString(16).padStart(4, "0") ?? "0000"
    )
    .join("");
}

function getBaseKey(key: string) {
  return `${SECURE_STORE_KEY_PREFIX}.${encodeStorageKey(key)}`;
}

function getMetaKey(key: string) {
  return `${getBaseKey(key)}.meta`;
}

function getChunkKey(key: string, index: number) {
  return `${getBaseKey(key)}.${index}`;
}

function splitIntoChunks(value: string, size: number) {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }

  return chunks.length > 0 ? chunks : [""];
}

async function getStoredChunkCount(key: string) {
  const rawMeta = await SecureStore.getItemAsync(getMetaKey(key), SECURE_STORE_OPTIONS);

  if (!rawMeta) {
    return 0;
  }

  try {
    const parsedMeta: unknown = JSON.parse(rawMeta);

    if (
      typeof parsedMeta === "object" &&
      parsedMeta !== null &&
      "chunkCount" in parsedMeta &&
      typeof parsedMeta.chunkCount === "number" &&
      Number.isInteger(parsedMeta.chunkCount) &&
      parsedMeta.chunkCount >= 0
    ) {
      return parsedMeta.chunkCount;
    }
  } catch {
    // Ignore corrupted metadata and treat it as missing.
  }

  return 0;
}

async function removeSecureValue(key: string) {
  const chunkCount = await getStoredChunkCount(key);

  await Promise.all(
    Array.from({ length: chunkCount }, (_, index) =>
      SecureStore.deleteItemAsync(getChunkKey(key, index), SECURE_STORE_OPTIONS)
    )
  );

  await SecureStore.deleteItemAsync(getMetaKey(key), SECURE_STORE_OPTIONS);
}

async function readSecureValue(key: string) {
  const chunkCount = await getStoredChunkCount(key);

  if (chunkCount === 0) {
    return null;
  }

  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, index) =>
      SecureStore.getItemAsync(getChunkKey(key, index), SECURE_STORE_OPTIONS)
    )
  );

  if (chunks.some((chunk) => chunk === null)) {
    await removeSecureValue(key);
    return null;
  }

  return chunks.join("");
}

async function migrateLegacyAsyncStorageValue<T>(key: string) {
  const legacyValue = await AsyncStorage.getItem(key);

  if (!legacyValue) {
    return null;
  }

  const parsedValue = JSON.parse(legacyValue) as T;
  await AsyncStorage.removeItem(key);
  return {
    parsedValue,
    rawValue: legacyValue,
  };
}

export const secureAuthPersistence: FirebasePersistenceFactory = class {
  static type: "LOCAL" = "LOCAL";
  type: "LOCAL" = "LOCAL";

  async _isAvailable() {
    try {
      const isSecureStoreAvailable = await SecureStore.isAvailableAsync();

      if (!isSecureStoreAvailable) {
        return false;
      }

      await SecureStore.setItemAsync(
        SECURE_STORE_PROBE_KEY,
        "1",
        SECURE_STORE_OPTIONS
      );
      await SecureStore.deleteItemAsync(
        SECURE_STORE_PROBE_KEY,
        SECURE_STORE_OPTIONS
      );

      return true;
    } catch {
      return false;
    }
  }

  async _set(key: string, value: PersistedAuthValue) {
    const serializedValue = JSON.stringify(value);
    const chunks = splitIntoChunks(serializedValue, CHUNK_SIZE);
    const previousChunkCount = await getStoredChunkCount(key);

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(getChunkKey(key, index), chunk, SECURE_STORE_OPTIONS)
      )
    );

    await SecureStore.setItemAsync(
      getMetaKey(key),
      JSON.stringify({ chunkCount: chunks.length }),
      SECURE_STORE_OPTIONS
    );

    if (previousChunkCount > chunks.length) {
      await Promise.all(
        Array.from(
          { length: previousChunkCount - chunks.length },
          (_, index) =>
            SecureStore.deleteItemAsync(
              getChunkKey(key, chunks.length + index),
              SECURE_STORE_OPTIONS
            )
        )
      );
    }

    await AsyncStorage.removeItem(key);
  }

  async _get<T>(key: string) {
    const secureValue = await readSecureValue(key);

    if (secureValue) {
      return JSON.parse(secureValue) as T;
    }

    const legacyValue = await migrateLegacyAsyncStorageValue<T>(key);

    if (!legacyValue) {
      return null;
    }

    await this._set(key, legacyValue.parsedValue);
    return legacyValue.parsedValue;
  }

  async _remove(key: string) {
    await removeSecureValue(key);
    await AsyncStorage.removeItem(key);
  }

  _addListener(_key: string, _listener: unknown) {
    // SecureStore does not provide cross-process change listeners.
  }

  _removeListener(_key: string, _listener: unknown) {
    // SecureStore does not provide cross-process change listeners.
  }
};
