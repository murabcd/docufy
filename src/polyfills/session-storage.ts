const createMemoryStorage = (): Storage => {
	const store = new Map<string, string>();

	return {
		get length() {
			return store.size;
		},
		clear: () => {
			store.clear();
		},
		getItem: (key: string) => {
			const value = store.get(key);
			return value ?? null;
		},
		key: (index: number) => {
			return Array.from(store.keys())[index] ?? null;
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
	};
};

export const ensureSessionStorage = () => {
	if (typeof window !== "undefined") {
		return;
	}

	const globalWithStorage = globalThis as typeof globalThis & {
		sessionStorage?: Storage;
	};

	if (!globalWithStorage.sessionStorage) {
		globalWithStorage.sessionStorage = createMemoryStorage();
	}
};

ensureSessionStorage();
