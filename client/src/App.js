// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Context Providers  
import { AuthProvider } from "./contexts/AuthContext";
import ContactsProvider from "./contexts/ContactsContext";

// Layout + Components
import MainLayout from "./components/layout/MainLayout";
import HomePanel from "./components/layout/panels/HomePanel";
import MessagesPanel from "./components/layout/panels/MessagesPanel";
import TasksPanel from "./components/layout/panels/TasksPanel";
import NotesPanel from "./components/layout/panels/NotesPanel";


// Pages (Protected)
import Home from "./pages/SidebarComp/Home";
import Messages from "./pages/SidebarComp/Messages";
import MyTasks from "./pages/SidebarComp/MyTasks";
import Notes from "./pages/SidebarComp/Notes";
import Blogs from "./pages/SidebarComp/Blogs";
import WorkspaceSelect from "./pages/WorkspaceSelect";

// Auth Pages (Public)
import LoginPage from "./pages/LoginPageComp/LoginPage";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/LoginPageComp/ForgotPassword";
import ResetPassword from "./pages/LoginPageComp/ResetPassword";
import OAuthSuccess from "./pages/LoginPageComp/OAuthSuccess";

// Protected route wrapper
import RequireAuth from "./components/RequireAuth";


import { ToastProvider } from "./contexts/ToastContext";

function App() {

  return (
    <AuthProvider>
      <ContactsProvider>
        <ToastProvider>
          <Router>
            <Routes>

              {/* PROTECTED AREA (requires login) */}

              {/* Home Route */}
              <Route
                path="/"
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

              {/* Blogs Route (No Sidebar as requested) */}
              <Route
                path="/blogs"
                element={
                  <RequireAuth>
                    <MainLayout sidePanel={null}>
                      <Blogs />
                    </MainLayout>
                  </RequireAuth>
                }
              />

              {/* Workspace Selection (Protected but outside main layout if desired, or inside) */}
              <Route
                path="/workspaces"
                element={
                  <RequireAuth>
                    <WorkspaceSelect />
                  </RequireAuth>
                }
              />

              {/* PUBLIC ROUTES */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/oauth-success" element={<OAuthSuccess />} />

            </Routes>
          </Router>
        </ToastProvider>
      </ContactsProvider>
    </AuthProvider>
  );
}

export default App;
