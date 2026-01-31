import React from 'react';

const NoteInfoModal = ({ note, blocks, showInfoModal, setShowInfoModal }) => {
    if (!showInfoModal) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-80 animate-scale-in text-gray-900 dark:text-gray-100">
                <h3 className="text-lg font-bold mb-4">Note Info</h3>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Created</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(note.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Last Edited</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(note.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Size</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{(JSON.stringify(blocks).length / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Words</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{blocks.filter(b => b.type === 'text').reduce((acc, b) => acc + (b.content?.split(/\s+/).length || 0), 0)}</span>
                    </div>
                </div>
                <button onClick={() => setShowInfoModal(false)} className="mt-6 w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 rounded-xl transition-colors">Close</button>
            </div>
        </div>
    );
};

export default NoteInfoModal;
