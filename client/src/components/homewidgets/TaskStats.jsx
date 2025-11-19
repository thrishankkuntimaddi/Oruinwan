// src/components/TaskStats.jsx
const TaskStats = () => {
  return (
    <div className="bg-white shadow rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">📊 Task Statistics</h2>
      <ul className="space-y-2 text-sm text-gray-700">
        <li className="flex justify-between">
          <span>Completed Tasks</span>
          <span className="font-bold text-green-600">12</span>
        </li>
        <li className="flex justify-between">
          <span>Pending Tasks</span>
          <span className="font-bold text-yellow-600">7</span>
        </li>
        <li className="flex justify-between">
          <span>Overdue Tasks</span>
          <span className="font-bold text-red-600">3</span>
        </li>
      </ul>
    </div>
  );
};

export default TaskStats;
