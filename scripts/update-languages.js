import fs from "fs";

const username = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
    throw new Error("GITHUB_USERNAME atau GITHUB_TOKEN belum tersedia.");
}

const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
};

async function githubFetch(url) {
    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(
            `GitHub API error ${response.status}: ${await response.text()}`
        );
    }

    return response.json();
}

async function getRepositories() {
    let repositories = [];
    let page = 1;

    while (true) {
        const data = await githubFetch(
            `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&type=owner`
        );

        repositories.push(...data);

        if (data.length < 100) {
            break;
        }

        page++;
    }

    return repositories;
}

async function getLanguages(repository) {
    return githubFetch(
        `https://api.github.com/repos/${username}/${repository.name}/languages`
    );
}

function calculatePercentages(languages) {
    const total = Object.values(languages).reduce(
        (sum, value) => sum + value,
        0
    );

    return Object.entries(languages)
        .map(([language, bytes]) => ({
            language,
            bytes,
            percentage: (bytes / total) * 100,
        }))
        .sort((a, b) => b.bytes - a.bytes);
}

function createMarkdown(languageStats, repositories) {
    const totalBytes = languageStats.reduce(
        (sum, item) => sum + item.bytes,
        0
    );

    let markdown = `## My Coding Languages

> Automatically generated from ${repositories.length} public repositories.

| Language | Usage | Percentage |
|----------|------:|----------:|
`;

    for (const item of languageStats) {
        const percentage = ((item.bytes / totalBytes) * 100).toFixed(2);

        markdown += `| ${item.language} | ${item.bytes.toLocaleString()} bytes | ${percentage}% |\n`;
    }

    markdown += `\n<!-- LANGUAGE_STATS_END -->`;

    return markdown;
}

async function main() {
    console.log(`Analyzing repositories for @${username}...`);

    const repositories = await getRepositories();

    console.log(`Found ${repositories.length} repositories.`);

    const languageTotals = {};

    for (const repository of repositories) {
        console.log(`Analyzing: ${repository.name}`);

        const languages = await getLanguages(repository);

        for (const [language, bytes] of Object.entries(languages)) {
            languageTotals[language] =
                (languageTotals[language] || 0) + bytes;
        }
    }

    const languageStats = calculatePercentages(languageTotals);

    const markdown = createMarkdown(languageStats, repositories);

    const readmePath = "README.md";

    let readme = fs.readFileSync(readmePath, "utf8");

    const startMarker = "<!-- LANGUAGE_STATS_START -->";
    const endMarker = "<!-- LANGUAGE_STATS_END -->";

    const startIndex = readme.indexOf(startMarker);
    const endIndex = readme.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
        throw new Error(
            "Marker LANGUAGE_STATS_START atau LANGUAGE_STATS_END tidak ditemukan di README.md"
        );
    }

    const before = readme.substring(
        0,
        startIndex + startMarker.length
    );

    const after = readme.substring(
        endIndex + endMarker.length
    );

    readme =
        before +
        "\n\n" +
        markdown.replace(endMarker, "") +
        "\n" +
        after;

    fs.writeFileSync(readmePath, readme);

    console.log("README.md berhasil diperbarui.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});