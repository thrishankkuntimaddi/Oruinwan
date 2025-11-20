// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./components/SidebarComp/Sidebar";
import Home from "./pages/SidebarComp/Home";
import Messages from "./pages/SidebarComp/Messages";
import MyTasks from "./pages/SidebarComp/MyTasks";
import Blogs from "./pages/SidebarComp/Blogs";
import LoginPage from "./pages/LoginPageComp/LoginPage";
import ChttrixAIChat from "./components/chttrixAIComp/ChttrixAIChat";
import RequireAuth from "./components/RequireAuth";

function App() {
  const [activePage, setActivePage] = useState("Home");
  const [showAI, setShowAI] = useState(false); 

  const renderPage = () => {
    switch (activePage) {
      case "Messages":
        return <Messages />;
      case "MyTasks":
        return <MyTasks />;
      case "Blogs":
        return <Blogs />;
      default:
        return <Home />;
    }
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <div className="flex h-screen overflow-hidden">
                <Sidebar
                  onNavigate={setActivePage}
                  onAIClick={() => setShowAI(true)}
                />
                <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
                  {renderPage()}
                </main>
              </div>

              {/* Draggable/Resizable AI Assistant Chat Popup */}
              {showAI && (
                <ChttrixAIChat
                  onClose={() => setShowAI(false)}
                />
              )}
            </RequireAuth>
          }
        />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
