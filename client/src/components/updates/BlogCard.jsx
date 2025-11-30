import React from "react";

const BlogCard = ({ blog, onDoubleClick }) => {
  const { title, shortDescription, image, tags, contributors } = blog;

  return (
    <div
      onDoubleClick={() => onDoubleClick(blog)}
      className="flex flex-col md:flex-row items-stretch justify-between gap-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-4 cursor-pointer"
    >
      <div className="flex flex-col gap-2 flex-[2_2_0px]">
        <p className="text-[#111418] text-base font-bold leading-tight">{title}</p>
        <p className="text-[#637488] text-sm font-normal leading-normal">
          {shortDescription}
        </p>

        {/* Contributors */}
        {contributors?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 text-xs text-gray-600">
            <span>Contributors:</span> {contributors.join(", ")}
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {tags?.map((tag, index) => (
            <span
              key={index}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Optional Image */}
      {image && (
        <div
          className="w-full md:w-1/2 bg-center bg-no-repeat aspect-video bg-cover rounded-lg"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}
    </div>
  );
};

export default BlogCard;
