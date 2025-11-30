import React from "react";

const BlogDetailModal = ({ blog, onClose }) => {
  if (!blog) return null;

  const {
    title,
    shortDescription,
    fullDescription,
    image,
    contributors,
    tags,
  } = blog;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white max-w-2xl w-full rounded-lg shadow-lg p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-xl"
        >
          ×
        </button>

        {/* Title */}
        <h2 className="text-2xl font-bold text-[#111418] mb-3">{title}</h2>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Image (optional) */}
        {image && (
          <img
            src={image}
            alt="Blog Visual"
            className="w-full h-56 object-cover rounded-md mb-4"
          />
        )}

        {/* Short Description */}
        {shortDescription && (
          <p className="text-gray-600 text-sm mb-2">
            <strong>Summary:</strong> {shortDescription}
          </p>
        )}

        {/* Full Description */}
        {fullDescription && (
          <p className="text-gray-800 text-sm leading-relaxed mb-4">
            {fullDescription}
          </p>
        )}

        {/* Contributors */}
        {contributors && contributors.length > 0 && (
          <div className="text-sm text-gray-700">
            <strong>Contributors:</strong>{" "}
            {contributors.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogDetailModal;
