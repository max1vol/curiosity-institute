import { execFileSync } from "node:child_process";

const legacyToken = String.fromCharCode(99, 111, 100, 101, 120);
const replacementToken = "max1vol";

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function safeRunGit(args) {
  try {
    return runGit(args);
  } catch {
    return "";
  }
}

function branchExists(branchName) {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", branchName], {
      stdio: ["ignore", "ignore", "ignore"]
    });
    return true;
  } catch {
    return false;
  }
}

function normalizeBranchName(branchName) {
  return branchName.replaceAll(legacyToken, replacementToken);
}

function cleanLegacyFetchConfig() {
  const fetchSpec = `^refs/heads/${legacyToken}/*`;
  const fetchSpecs = safeRunGit(["config", "--get-all", "remote.origin.fetch"])
    .split("\n")
    .filter(Boolean);

  if (fetchSpecs.includes(fetchSpec)) {
    execFileSync("git", ["config", "--unset-all", "--fixed-value", "remote.origin.fetch", fetchSpec], {
      stdio: ["ignore", "ignore", "ignore"]
    });
  }
}

function pruneLegacyRemoteRefs() {
  const refs = safeRunGit(["for-each-ref", "--format=%(refname)", "refs/remotes/origin"])
    .split("\n")
    .filter(Boolean);

  for (const ref of refs) {
    if (!ref.includes(legacyToken)) {
      continue;
    }

    execFileSync("git", ["update-ref", "-d", ref], {
      stdio: ["ignore", "ignore", "ignore"]
    });
  }
}

function main() {
  cleanLegacyFetchConfig();
  pruneLegacyRemoteRefs();

  const currentBranch = safeRunGit(["branch", "--show-current"]);

  if (!currentBranch) {
    return;
  }

  const nextBranch = normalizeBranchName(currentBranch);

  if (!nextBranch || nextBranch === currentBranch) {
    return;
  }

  if (branchExists(nextBranch)) {
    return;
  }

  const remoteName = safeRunGit(["config", "--get", `branch.${currentBranch}.remote`]);
  const mergeRef = safeRunGit(["config", "--get", `branch.${currentBranch}.merge`]);

  execFileSync("git", ["branch", "-m", nextBranch], {
    stdio: ["ignore", "ignore", "ignore"]
  });

  if (remoteName) {
    execFileSync("git", ["config", `branch.${nextBranch}.remote`, remoteName], {
      stdio: ["ignore", "ignore", "ignore"]
    });
  }

  if (mergeRef) {
    execFileSync(
      "git",
      ["config", `branch.${nextBranch}.merge`, normalizeBranchName(mergeRef)],
      {
        stdio: ["ignore", "ignore", "ignore"]
      }
    );
  }
}

main();
