const fs = require("node:fs");
const path = require("node:path");

const ignoredDirectories = new Set([".git", "coverage", "node_modules", "playwright-report", "test-results"]);
const files = [];

function collectJavaScript(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) collectJavaScript(path.join(directory, entry.name));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path.join(directory, entry.name));
    }
  }
}

collectJavaScript(path.resolve(__dirname, ".."));
files.sort();

for (const file of files) {
  require("node:child_process").execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log(`Syntax check passed for ${files.length} repository JavaScript files.`);
