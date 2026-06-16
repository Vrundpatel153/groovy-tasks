const path = require("path");
const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");
const { loadEnv } = require("./load-env");

loadEnv();

const { runCacheTest } = require("./cache-test");
const { explainCodebase } = require("./explain-codebase");
const { printDashboard } = require("./dashboard");

const repoRoot = path.resolve(__dirname, "..");
const demoRoot = path.resolve(__dirname, "demo-codebase");

function showMenu() {
  console.log("");
  console.log("Groq Usage Logger CLI");
  console.log("---------------------");
  console.log("1. Explain this repository");
  console.log("2. Explain another folder");
  console.log("3. Run prompt cache test");
  console.log("4. Show usage dashboard");
  console.log("5. Explain this repository, then show dashboard");
  console.log("6. Explain demo folder, then show dashboard");
  console.log("0. Exit");
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      showMenu();
      const choice = (await rl.question("Choose an option: ")).trim();

      if (choice === "0") break;
      if (choice === "1") {
        await explainCodebase(repoRoot);
      } else if (choice === "2") {
        const folder = (await rl.question("Folder path: ")).trim();
        await explainCodebase(folder);
      } else if (choice === "3") {
        await runCacheTest();
      } else if (choice === "4") {
        printDashboard();
      } else if (choice === "5") {
        await explainCodebase(repoRoot);
        printDashboard();
      } else if (choice === "6") {
        await explainCodebase(demoRoot);
        printDashboard();
      } else {
        console.log("Choose 0, 1, 2, 3, 4, 5, or 6.");
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
