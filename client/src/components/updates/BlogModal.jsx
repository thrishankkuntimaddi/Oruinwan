import React, { useState } from "react";

const BlogModal = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [fullDesc, setFullDesc] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [tags, setTags] = useState("");
  const [contributors, setContributors] = useState("");

  const handleSubmit = () => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const newBlog = {
        title,
        shortDesc,
        fullDesc,
        image: reader.result || "",
        tags: tags.split(",").map((t) => t.trim()),
        contributors: contributors.split(",").map((c) => c.trim()),
      };
      onSubmit(newBlog);
    };
    if (imageFile) {
      reader.readAsDataURL(imageFile);
    } else {
      reader.onloadend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex justify-center items-center">
      <div className="bg-white rounded-lg w-full max-w-xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Create New Blog</h2>

        <input
          type="text"
          placeholder="Title"
          className="w-full border px-3 py-2 mb-3 rounded"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          placeholder="Short Description"
          className="w-full border px-3 py-2 mb-3 rounded"
          value={shortDesc}
          onChange={(e) => setShortDesc(e.target.value)}
        />

        <textarea
          placeholder="Full Description"
          className="w-full border px-3 py-2 mb-3 rounded"
          value={fullDesc}
          onChange={(e) => setFullDesc(e.target.value)}
        />

        <input
          type="file"
          className="mb-3"
          onChange={(e) => setImageFile(e.target.files[0])}
        />

        <input
          type="text"
          placeholder="Tags (comma separated)"
          className="w-full border px-3 py-2 mb-3 rounded"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        <input
          type="text"
          placeholder="Contributors (comma separated)"
          className="w-full border px-3 py-2 mb-4 rounded"
          value={contributors}
          onChange={(e) => setContributors(e.target.value)}
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlogModal;
