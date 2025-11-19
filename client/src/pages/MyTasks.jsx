import React, { useState } from "react";
import TaskModal from "../components/tasksComp/TaskModal";
import TaskHeader from "../components/tasksComp/TaskHeader";
import TaskTabs from "../components/tasksComp/TaskTabs";
import TaskTable from "../components/tasksComp/TaskTable";

const dummyChannels = ["Marketing", "Product Dev", "Design", "Sales"];
const dummyMembers = ["Sarah Lee", "David Chen", "Emily Wong", "Michael Tan"];

const statusOrder = ["In Progress", "To Do", "Completed", "Overdue"];

const MyTasks = () => {
  const [activeTab, setActiveTab] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [tasks, setTasks] = useState([
    {
      task: "Design landing page",
      project: "Marketing",
      assignee: "Sarah Lee",
      dueDate: "2024-03-15",
      priority: "High",
      status: "In Progress",
    },
    {
      task: "Write blog post",
      project: "Content",
      assignee: "Emily Wong",
      dueDate: "2024-03-22",
      priority: "Moderate",
      status: "Completed",
    },
  ]);

  const [deletedTasks, setDeletedTasks] = useState([]);

  const addTask = (newTask) => {
    setTasks((prev) =>
      [...prev, newTask].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
    );
  };

  const updateTaskField = (index, field, value) => {
    const updated = [...tasks];
    updated[index][field] = value;
    setTasks(updated.sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)));
  };

  const deleteTask = (index) => {
    const taskToDelete = tasks[index];
    const newTasks = [...tasks];
    newTasks.splice(index, 1);
    setTasks(newTasks);
    setDeletedTasks((prev) => [...prev, taskToDelete]);
  };

  const restoreTask = (index) => {
    const task = deletedTasks[index];
    const updatedDeleted = [...deletedTasks];
    updatedDeleted.splice(index, 1);
    setDeletedTasks(updatedDeleted);
    setTasks((prev) =>
      [...prev, task].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
    );
  };

  const permanentlyDelete = (index) => {
    const newDeleted = [...deletedTasks];
    newDeleted.splice(index, 1);
    setDeletedTasks(newDeleted);
  };

  const filtered =
    activeTab === "All"
      ? tasks
      : activeTab === "Deleted"
      ? deletedTasks
      : tasks.filter((task) => task.status === activeTab);

  const sortedTasks =
    activeTab === "Deleted"
      ? filtered
      : [...filtered].sort(
          (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
        );

  return (
    <div className="bg-white border rounded-lg shadow-md h-full w-full px-4 py-6 overflow-hidden">
      <TaskHeader onNewTaskClick={() => setShowModal(true)} />
      <TaskTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <TaskTable
        tasks={sortedTasks}
        activeTab={activeTab}
        updateTaskField={updateTaskField}
        deleteTask={deleteTask}
        restoreTask={restoreTask}
        permanentlyDelete={permanentlyDelete}
      />

      {showModal && (
        <TaskModal
          onClose={() => setShowModal(false)}
          onAddTask={addTask}
          channels={dummyChannels}
          teamMembers={dummyMembers}
        />
      )}
    </div>
  );
};

export default MyTasks;
