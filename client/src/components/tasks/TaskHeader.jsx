// components/TaskHeader.jsx
const TaskHeader = ({ onNewTaskClick }) => {
  return (
    <div className="flex flex-wrap justify-between items-center mb-6">
      <div>
        <h1 className="text-3xl font-bold text-[#111418]">My Tasks</h1>
        <p className="text-[#637488] text-sm mt-1">View and manage your assigned tasks</p>
      </div>
      <button
        onClick={onNewTaskClick}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
      >
        + New Task
      </button>
    </div>
  );
};

export default TaskHeader;
