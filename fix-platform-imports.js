const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

const PROJECT_ROOT = process.cwd();
const CLIENT_SRC = path.join(PROJECT_ROOT, "client/src");
const PLATFORM_DIR = path.join(PROJECT_ROOT, "platform");

/**
 * Calculates the correct relative import path from filePath → targetPath.
 */
function getCorrectRelativeImport(filePath, targetPath) {
  let relativePath = path.relative(path.dirname(filePath), targetPath);

  // Normalize Windows backslashes
  relativePath = relativePath.replace(/\\/g, "/");

  // Ensure it starts with "./" for relative imports
  if (!relativePath.startsWith(".")) {
    relativePath = "./" + relativePath;
  }

  return relativePath;
}

/**
 * Processes a single source file: finds broken platform relative imports,
 * recalculates the correct path from the project root, and rewrites via AST.
 */
function processFile(filePath) {
  const code = fs.readFileSync(filePath, "utf-8");

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
  } catch (err) {
    console.warn(`⚠️  Could not parse ${filePath}: ${err.message}`);
    return;
  }

  let modified = false;

  traverse(ast, {
    ImportDeclaration(pathNode) {
      const importPath = pathNode.node.source.value;

      // Only care about relative imports that reference the platform directory
      if (!importPath.startsWith(".") || !importPath.includes("platform")) {
        return;
      }

      // Resolve absolute path as-is
      const absoluteTarget = path.resolve(path.dirname(filePath), importPath);

      if (!fs.existsSync(absoluteTarget)) {
        // Extract the sub-path after "platform/"
        const platformIndex = importPath.indexOf("platform/");
        if (platformIndex === -1) return;

        const subPath = importPath.slice(platformIndex + "platform/".length);
        const correctTarget = path.join(PLATFORM_DIR, subPath);

        if (fs.existsSync(correctTarget)) {
          const newImport = getCorrectRelativeImport(filePath, correctTarget);

          pathNode.node.source = t.stringLiteral(newImport);
          modified = true;

          console.log(`\n✅ Fixed: ${path.relative(PROJECT_ROOT, filePath)}`);
          console.log(`   Before: ${importPath}`);
          console.log(`   After:  ${newImport}`);
        } else {
          console.warn(
            `\n⚠️  Broken (target not found in platform/): ${path.relative(
              PROJECT_ROOT,
              filePath
            )}`
          );
          console.warn(`   Import: ${importPath}`);
          console.warn(`   Tried:  ${correctTarget}`);
        }
      }
    },
  });

  if (modified) {
    const output = generate(ast, {}, code);
    fs.writeFileSync(filePath, output.code, "utf-8");
  }
}

function run() {
  const files = glob.sync(`${CLIENT_SRC}/**/*.{js,jsx,ts,tsx}`);

  console.log(`🔍 Scanning ${files.length} files in client/src...\n`);

  files.forEach(processFile);

  console.log("\n🎉 Import fix scan completed.");
}

run();
