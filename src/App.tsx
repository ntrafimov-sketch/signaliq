import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { AccountsPage } from './pages/AccountsPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { PersonDetailPage } from './pages/PersonDetailPage';
import { SignalsPage } from './pages/SignalsPage';
import { ListsPage } from './pages/ListsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/accounts" replace />} />
          <Route
            path="/accounts"
            element={
              <Layout>
                <AccountsPage />
              </Layout>
            }
          />
          <Route
            path="/accounts/:id"
            element={
              <Layout>
                <AccountDetailPage />
              </Layout>
            }
          />
          <Route
            path="/accounts/:id/people/:personId"
            element={
              <Layout>
                <PersonDetailPage />
              </Layout>
            }
          />
          <Route
            path="/signals"
            element={
              <Layout>
                <SignalsPage />
              </Layout>
            }
          />
          <Route
            path="/lists"
            element={
              <Layout>
                <ListsPage />
              </Layout>
            }
          />
          <Route
            path="/reports"
            element={
              <Layout>
                <ReportsPage />
              </Layout>
            }
          />
          <Route
            path="/settings"
            element={
              <Layout>
                <SettingsPage />
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
