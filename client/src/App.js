// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./components/SidebarComp/Sidebar";
import Home from "./pages/Home";
import Messages from "./pages/Messages";
import MyTasks from "./pages/MyTasks";
import Blogs from "./pages/Blogs";
import LoginPage from "./pages/LoginPage";
import ChttrixAIChat from "./components/chttrixAIComp/ChttrixAIChat";

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
            <>
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
            </>
          }
        />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
