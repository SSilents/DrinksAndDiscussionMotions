const fs = require("node:fs");
const path = require("node:path");

module.exports = function (eleventyConfig) {
  const cleanOutput = () => {
    const outputDir = path.join(process.cwd(), "_site");
    fs.rmSync(outputDir, { recursive: true, force: true });
  };

  eleventyConfig.ignores.add("drafts/**");
  
  eleventyConfig.on("eleventy.before", cleanOutput);
  eleventyConfig.on("eleventy.beforeWatch", cleanOutput);

  eleventyConfig.addPassthroughCopy("style.css");
  eleventyConfig.addPassthroughCopy("app.js");
  eleventyConfig.addPassthroughCopy("images");

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateObj);
  });

  return {
    incrementalBuild: false,
    pathPrefix: "/DrinksAndDiscussionMotions/",
  };
};