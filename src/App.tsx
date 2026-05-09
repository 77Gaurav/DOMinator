import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import StartInterview from "./pages/StartInterview";
import Interview from "./pages/Interview";
import Summary from "./pages/Summary";
import Transcript from "./pages/Transcript";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/start/:difficulty" element={<ProtectedRoute><StartInterview /></ProtectedRoute>} />
              <Route path="/interview/:id" element={<ProtectedRoute><Interview /></ProtectedRoute>} />
              <Route path="/interview/:id/summary" element={<ProtectedRoute><Summary /></ProtectedRoute>} />
              <Route path="/interview/:id/transcript" element={<ProtectedRoute><Transcript /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
