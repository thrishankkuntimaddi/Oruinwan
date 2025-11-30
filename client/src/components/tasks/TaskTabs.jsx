// components/TaskTabs.jsx
const TaskTabs = ({ activeTab, setActiveTab }) => {
  const tabs = ["All", "In Progress", "To Do", "Completed", "Overdue", "Deleted"];

  return (
    <div className="flex space-x-6 border-b pb-3 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`pb-2 border-b-2 text-sm font-semibold ${
            activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default TaskTabs;
