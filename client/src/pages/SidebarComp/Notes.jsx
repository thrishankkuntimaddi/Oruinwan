import React from "react";
import { useParams } from "react-router-dom";

const Notes = () => {
    const { id } = useParams();

    // Mock Content
    const note = id ? {
        title: id === "1" ? "Project Ideas" : "Untitled Note",
        content: "Start typing your note here...",
        date: "November 25, 2025 at 10:30 AM"
    } : null;

    if (!note) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Select a note or create a new one
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-8 max-w-3xl mx-auto w-full h-full flex flex-col">
                <div className="text-center text-gray-400 text-xs mb-4 font-medium">
                    {note.date}
                </div>

                <input
                    type="text"
                    defaultValue={note.title}
                    className="text-3xl font-bold text-gray-900 placeholder-gray-300 border-none focus:ring-0 p-0 mb-4 w-full"
                    placeholder="Title"
                />

                <textarea
                    defaultValue={note.content}
                    className="flex-1 w-full resize-none border-none focus:ring-0 text-gray-700 text-lg leading-relaxed p-0 placeholder-gray-300"
                    placeholder="Type something..."
                />
            </div>
        </div>
    );
};

export default Notes;
