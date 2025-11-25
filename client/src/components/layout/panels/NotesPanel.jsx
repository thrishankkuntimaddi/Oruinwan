import React from "react";
import { useNavigate } from "react-router-dom";

const NotesPanel = () => {
    const navigate = useNavigate();

    // Mock Notes Data
    const notes = [
        { id: 1, title: "Project Ideas", time: "10:30 AM", preview: "AI integration with..." },
        { id: 2, title: "Meeting Minutes", time: "Yesterday", preview: "Discussed Q4 roadmap..." },
        { id: 3, title: "Shopping List", time: "Mon", preview: "Milk, Coffee, Bread..." },
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 font-bold text-gray-900">
                <span>Notes</span>
                <button className="text-gray-500 hover:bg-gray-200 p-1 rounded">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {notes.map((note) => (
                    <div
                        key={note.id}
                        onClick={() => navigate(`/notes/${note.id}`)}
                        className="px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-blue-50 group transition-colors"
                    >
                        <h3 className="text-sm font-bold text-gray-900 truncate">{note.title}</h3>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-gray-500 truncate w-2/3">{note.preview}</p>
                            <span className="text-[10px] text-gray-400">{note.time}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NotesPanel;
