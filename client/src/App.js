// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Context Providers  
import { AuthProvider } from "./contexts/AuthContext";
import ContactsProvider from "./contexts/ContactsContext";
import { NotesProvider } from "./contexts/NotesContext";
import { ToastProvider } from "./contexts/ToastContext";
import { BlogsProvider } from "./contexts/BlogsContext";

// Layout + Components
import MainLayout from "./components/layout/MainLayout";
import HomePanel from "./components/home/panels/HomePanel";
import ChannelsPanel from "./components/layout/panels/ChannelsPanel";
import MessagesPanel from "./components/layout/panels/MessagesPanel";
import TasksPanel from "./components/layout/panels/TasksPanel";
import NotesPanel from "./components/layout/panels/NotesPanel";
import UpdatesPanel from "./components/layout/panels/UpdatesPanel";

// Pages (Protected)
import Home from "./pages/SidebarComp/Home";
import Messages from "./pages/SidebarComp/Messages";
import MyTasks from "./pages/SidebarComp/MyTasks";
import Notes from "./pages/SidebarComp/Notes";
import Updates from "./pages/SidebarComp/Updates";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import FeatureShowcase from "./pages/FeatureShowcase";

// Auth Pages (Public)
import LoginPage from "./pages/LoginPageComp/LoginPage";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/LoginPageComp/ForgotPassword";
import ResetPassword from "./pages/LoginPageComp/ResetPassword";
import OAuthSuccess from "./pages/LoginPageComp/OAuthSuccess";
import AcceptInvite from "./pages/AcceptInvite";
import CompanyAdmin from "./pages/CompanyAdmin";

// Protected route wrapper
import RequireAuth from "./components/RequireAuth";


function App() {

  return (
    <AuthProvider>
      <ContactsProvider>
        <ToastProvider>
          <Router>
            <NotesProvider>
              <BlogsProvider>
                <Routes>

                  {/* PROTECTED AREA (requires login) */}

                  {/* Main App Route (was Home) */}
                  <Route
                    path="/app"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<HomePanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Channel Route (Home Context) */}
                  <Route
                    path="/channel/:id"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<HomePanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Channels Route */}
                  <Route
                    path="/channels"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<ChannelsPanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Channel Route (Channels Context) */}
                  <Route
                    path="/channels/:id"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<ChannelsPanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* DM Route (Home Context) */}
                  <Route
                    path="/dm/:id"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<HomePanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Messages Route (Legacy/Fallback) */}
                  <Route
                    path="/messages/*"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<MessagesPanel />}>
                          <Messages />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Tasks Route (Placeholder Panel for now) */}
                  <Route
                    path="/tasks"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<TasksPanel />}>
                          <MyTasks />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Notes Route */}
                  <Route
                    path="/notes"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<NotesPanel />}>
                          <Notes />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Notes Detail Route */}
                  <Route
                    path="/notes/:id"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<NotesPanel />}>
                          <Notes />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Updates Route */}
                  <Route
                    path="/updates"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<UpdatesPanel />}>
                          <Updates />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  <Route
                    path="/workspaces"
                    element={
                      <RequireAuth>
                        <WorkspaceSelect />
                      </RequireAuth>
                    }
                  />

                  {/* Company Admin Console */}
                  <Route
                    path="/admin/company"
                    element={
                      <RequireAuth>
                        <CompanyAdmin />
                      </RequireAuth>
                    }
                  />

                  {/* PUBLIC ROUTES */}

                  {/* Landing Page (Feature Showcase) */}
                  <Route path="/" element={<FeatureShowcase />} />
                  <Route path="/features" element={<FeatureShowcase />} />

                  {/* PUBLIC ROUTES */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/oauth-success" element={<OAuthSuccess />} />
                  <Route path="/accept-invite" element={<AcceptInvite />} />

                </Routes>
              </BlogsProvider>
            </NotesProvider>
          </Router>
        </ToastProvider>
      </ContactsProvider>
    </AuthProvider>
  );
}

export default App;
