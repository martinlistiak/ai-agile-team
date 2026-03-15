import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SpaceProvider } from "@/contexts/SpaceContext";
import { ToastProvider } from "@/components/Toast";
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SpaceProvider>
              <RouterProvider router={router} />
            </SpaceProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
