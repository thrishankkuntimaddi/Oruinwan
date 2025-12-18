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
import JoinWorkspace from "./pages/JoinWorkspace";
import CompanyAdmin from "./pages/CompanyAdmin";
import RegisterCompany from "./pages/RegisterCompany";

// Protected route wrapper
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";


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

                  {/* Workspace Selection - Must select workspace first */}
                  <Route
                    path="/workspaces"
                    element={
                      <RequireAuth>
                        <WorkspaceSelect />
                      </RequireAuth>
                    }
                  />

                  {/* WORKSPACE-SPECIFIC ROUTES - All require workspaceId */}

                  {/* Home/Main View */}
                  <Route
                    path="/workspace/:workspaceId/home"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<HomePanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Channels View */}
                  <Route
                    path="/workspace/:workspaceId/channels"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<ChannelsPanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Specific Channel */}
                  <Route
                    path="/workspace/:workspaceId/channel/:id"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<ChannelsPanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Direct Messages View */}
                  <Route
                    path="/workspace/:workspaceId/messages"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<MessagesPanel />}>
                          <Messages />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Specific DM */}
                  <Route
                    path="/workspace/:workspaceId/dm/:id"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<MessagesPanel />}>
                          <Home />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Tasks */}
                  <Route
                    path="/workspace/:workspaceId/tasks"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<TasksPanel />}>
                          <MyTasks />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Notes */}
                  <Route
                    path="/workspace/:workspaceId/notes"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<NotesPanel />}>
                          <Notes />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Specific Note */}
                  <Route
                    path="/workspace/:workspaceId/notes/:id"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<NotesPanel />}>
                          <Notes />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Updates */}
                  <Route
                    path="/workspace/:workspaceId/updates"
                    element={
                      <RequireAuth>
                        <MainLayout sidePanel={<UpdatesPanel />}>
                          <Updates />
                        </MainLayout>
                      </RequireAuth>
                    }
                  />

                  {/* Legacy routes - redirect to workspaces */}
                  <Route
                    path="/home"
                    element={
                      <RequireAuth>
                        <WorkspaceSelect />
                      </RequireAuth>
                    }
                  />


                  {/* Company Admin Console - Admin/Owner Only */}
                  <Route
                    path="/admin/company"
                    element={
                      <RequireAuth>
                        <RequireAdmin>
                          <CompanyAdmin />
                        </RequireAdmin>
                      </RequireAuth>
                    }
                  />

                  {/* PUBLIC ROUTES */}

                  {/* Landing Page (Feature Showcase) */}
                  <Route path="/" element={<FeatureShowcase />} />
                  <Route path="/features" element={<FeatureShowcase />} />

                  {/* PUBLIC ROUTES */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register-company" element={<RegisterCompany />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/oauth-success" element={<OAuthSuccess />} />
                  <Route path="/accept-invite" element={<AcceptInvite />} />
                  <Route path="/join-workspace" element={<JoinWorkspace />} />

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
