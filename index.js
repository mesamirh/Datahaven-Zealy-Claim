const fs = require("fs");
const axios = require("axios");
const chalk = require("chalk");
const readline = require("readline");

const DATA_FILE = "data.txt";

if (!fs.existsSync(DATA_FILE)) {
  console.log(
    chalk.yellow(`⚠️  File '${DATA_FILE}' not found. Creating a blank one...`),
  );
  fs.writeFileSync(DATA_FILE, "", "utf8");
  console.log(
    chalk.green(
      `✅ '${DATA_FILE}' created! Paste your tokens there (one per line).`,
    ),
  );
  process.exit(0);
}

const fileContent = fs.readFileSync(DATA_FILE, "utf8");
const accounts = fileContent
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .map((token) => ({ token }));

if (accounts.length === 0) {
  console.log(chalk.red(`❌ No tokens found in '${DATA_FILE}'!`));
  console.log(
    chalk.yellow(
      `👉 Please paste your tokens in '${DATA_FILE}', one per line.`,
    ),
  );
  process.exit(1);
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0 Safari/537.36",
];

const getRandomHeaders = () => {
  const agent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    "sec-ch-ua-platform": agent.includes("Mac") ? '"macOS"' : '"Windows"',
    "user-agent": agent,
    "sec-ch-ua":
      '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    "content-type": "application/json",
    "sec-ch-ua-mobile": "?0",
    accept: "*/*",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    referer: "https://camphaven.xyz/home",
    "accept-language": "en-US,en;q=0.9",
    origin: "https://camphaven.xyz",
  };
};

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return {};
  }
}

async function processAccount(account, index, isRetry = false) {
  let { address, token, clientSeason } = account;
  const headers = getRandomHeaders();

  const separator = chalk.gray(
    "---------------------------------------------------",
  );
  if (!isRetry) console.log(`\n${separator}`);
  const prefix = isRetry ? chalk.yellow("[RETRY] ") : "";
  console.log(chalk.cyan.bold(`${prefix}👤 Account #${index + 1}`));

  if (!token || typeof token !== "string" || token.trim() === "") {
    console.log(chalk.red("   ❌ Error: Invalid Token."));
    return false;
  }

  if (!address) {
    process.stdout.write(chalk.yellow("   🔍 Fetching address... "));
    try {
      let userQuery = {
        operationName: "GetUser",
        query: "query GetUser { users { id wallets { address is_primary } } }",
      };

      let userResponse = await axios.post(
        "https://gql3.absinthe.network/v1/graphql",
        userQuery,
        {
          headers: { ...headers, authorization: `Bearer ${token}` },
        },
      );

      if (userResponse.data.errors) {
        userQuery = {
          operationName: "GetUser",
          query: "query GetUser { user { id wallets { address is_primary } } }",
        };
        userResponse = await axios.post(
          "https://gql3.absinthe.network/v1/graphql",
          userQuery,
          {
            headers: { ...headers, authorization: `Bearer ${token}` },
          },
        );
      }

      let userWallets = null;
      if (userResponse.data?.data?.users?.[0]?.wallets) {
        userWallets = userResponse.data.data.users[0].wallets;
      } else if (userResponse.data?.data?.user?.[0]?.wallets) {
        userWallets = userResponse.data.data.user[0].wallets;
      }

      if (userWallets && userWallets.length > 0) {
        const primaryWallet =
          userWallets.find((w) => w.is_primary) || userWallets[0];
        address = primaryWallet.address;
        console.log(chalk.green("Found!"));
        console.log(chalk.gray(`      (${address})`));
      } else {
        console.log(chalk.red("Failed!"));
        return false;
      }
    } catch (err) {
      console.log(chalk.red("Error!"));
      return false;
    }
  } else {
    console.log(chalk.white(`   👛 Wallet: ${chalk.yellow(address)}`));
  }

  let seasonSource = "Manual";
  if (!clientSeason) {
    const decoded = parseJwt(token);
    if (decoded.clientSeason) {
      clientSeason = decoded.clientSeason;
      seasonSource = "Auto (Token)";
    } else if (
      decoded["https://hasura.io/jwt/claims"] &&
      decoded["https://hasura.io/jwt/claims"]["x-hasura-client-season"]
    ) {
      clientSeason =
        decoded["https://hasura.io/jwt/claims"]["x-hasura-client-season"];
      seasonSource = "Auto (Claims)";
    }
  }

  if (clientSeason) {
    console.log(chalk.gray(`   ℹ️  Season: ${clientSeason} (${seasonSource})`));
  } else {
    console.log(
      chalk.red("   ❌ Error: Could not detect Client Season from token."),
    );
    return false;
  }

  process.stdout.write(chalk.yellow("   ⏳ Claiming... "));

  const claimPayload = {
    operationName: "claimPoints",
    variables: {
      claimPointsData: {
        address: address,
        platform: "quest_zealy",
        client_season: clientSeason,
      },
    },
    query:
      "mutation claimPoints($claimPointsData: ClaimQuestScoreInput!) {\n  claim_quest_score(claim_quest_score_data: $claimPointsData) {\n    score\n    __typename\n  }\n}",
  };

  try {
    const claimResponse = await axios.post(
      "https://gql3.absinthe.network/v1/graphql",
      claimPayload,
      {
        headers: {
          ...headers,
          authorization: `Bearer ${token}`,
        },
      },
    );

    if (claimResponse.data.errors) {
      console.log(chalk.red(`\n   ❌ Failed:`));
      claimResponse.data.errors.forEach((err) =>
        console.log(chalk.red(`      • ${err.message}`)),
      );
      return false;
    } else if (
      claimResponse.data.data &&
      claimResponse.data.data.claim_quest_score
    ) {
      const score = claimResponse.data.data.claim_quest_score.score;
      console.log(chalk.green.bold(`✅ SUCCESS! Score: ${score}`));
      return true;
    } else {
      console.log(chalk.magenta(`\n   ⚠️  Unexpected Response.`));
      return false;
    }
  } catch (claimError) {
    console.log(chalk.red(`\n   ❌ Error: ${claimError.message}`));
    return false;
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

async function main() {
  console.clear();
  console.log(chalk.bold.magenta("\n🤖 Datahaven-Zealy-Claim"));
  console.log(
    chalk.gray(`   Loaded ${accounts.length} accounts from ${DATA_FILE}`),
  );

  let successCount = 0;
  let failedAccounts = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    if (!account || Object.keys(account).length === 0) continue;

    const success = await processAccount(account, i);

    if (success) {
      successCount++;
    } else {
      failedAccounts.push({ account, index: i });
    }

    if (i < accounts.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(
    chalk.gray("\n==================================================="),
  );
  console.log(chalk.bold.white(`📊 FINAL SUMMARY`));
  console.log(
    chalk.gray("==================================================="),
  );
  console.log(`   ✅ Successful: ${chalk.green.bold(successCount)}`);
  console.log(`   ❌ Failed:     ${chalk.red.bold(failedAccounts.length)}`);
  console.log(
    chalk.gray("==================================================="),
  );

  if (failedAccounts.length > 0) {
    const answer = await askQuestion(
      chalk.yellow(
        `\n🔄 Retry ${failedAccounts.length} failed accounts? (y/n): `,
      ),
    );

    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      console.log(chalk.bold.magenta("\n🔄 Retrying..."));
      let retrySuccessCount = 0;

      for (const item of failedAccounts) {
        const success = await processAccount(item.account, item.index, true);
        if (success) retrySuccessCount++;
        await new Promise((r) => setTimeout(r, 1000));
      }

      console.log(
        chalk.gray("\n==================================================="),
      );
      console.log(chalk.bold.white(`📊 RETRY SUMMARY`));
      console.log(`   ✅ Recovered: ${chalk.green.bold(retrySuccessCount)}`);
      console.log(
        `   ❌ Still Failed: ${chalk.red.bold(failedAccounts.length - retrySuccessCount)}`,
      );
    }
  }
  console.log(chalk.bold.magenta(`\n🏁 Done.`));
}

main();
