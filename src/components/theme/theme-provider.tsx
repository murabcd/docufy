import { createContext, useContext, useEffect, useState } from "react";

// Utility flag to determine if we are executing in a browser environment.
const isBrowser = typeof window !== "undefined";

type Theme = "dark" | "light";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
	theme: "dark",
	setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
	children,
	defaultTheme = "dark",
	storageKey = "vite-ui-theme",
	...props
}: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>(() => {
		if (isBrowser) {
			const stored = window.localStorage.getItem(storageKey) as Theme | null;
			return stored ?? defaultTheme;
		}
		return defaultTheme;
	});

	useEffect(() => {
		const root = window.document.documentElement;

		root.classList.remove("light", "dark");
		root.classList.add(theme);
	}, [theme]);

	const value = {
		theme,
		setTheme: (theme: Theme) => {
			if (isBrowser) {
				window.localStorage.setItem(storageKey, theme);
			}
			setTheme(theme);
		},
	};

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);

	if (context === undefined)
		throw new Error("useTheme must be used within a ThemeProvider");

	return context;
};
