import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SpaceProvider } from "@/contexts/SpaceContext";
import { TokenTopUpProvider } from "@/contexts/TokenTopUpContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { router } from "@/routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <SpaceProvider>
              <TokenTopUpProvider>
                <RouterProvider router={router} />
              </TokenTopUpProvider>
            </SpaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
