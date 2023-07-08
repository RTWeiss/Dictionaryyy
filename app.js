const express = require("express");
const axios = require("axios");
const path = require("path");
const ejs = require("ejs");
const fs = require("fs");
const app = express();
const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL,
});

client.on("connect", function () {
  console.log("Connected to Redis");
});

client.on("error", function (err) {
  console.error("Error connecting to Redis:", err);
});

const port = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] != "https") {
      res.redirect(`https://${req.headers.host}${req.url}`);
    } else {
      next();
    }
  });
}

const MAX_RECENT_SEARCHES = 5;
const MAX_POPULAR_SEARCHES = 5; // Maximum number of popular searches to display
let recentSearches = [];
let searchCounts = {};

const publicPath = path.join(__dirname, "public");
const termPath = path.join(publicPath, "term");

app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Generate dynamic sitemap based on files in the term folder
const generateSitemap = () => {
  const files = fs.readdirSync(termPath);
  const urls = files.map((file) => {
    const fileName = path.basename(file, path.extname(file));
    return `http://localhost:3000/term/${fileName}`;
  });
  const sitemap = urls.map((url) => `<url><loc>${url}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap}
</urlset>`;
};

// Generate a sorted array of terms in the term folder
const getSortedTerms = () => {
  const files = fs.readdirSync(termPath);
  return files
    .map((file) => path.basename(file, path.extname(file)))
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
};

app.get("/", (req, res) => {
  const popularSearches = Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_POPULAR_SEARCHES)
    .map((entry) => entry[0]);
  res.render("index", { recentSearches, popularSearches, searchCounts });
});

app.get("/term/:word", async (req, res) => {
  const word = req.params.word;
  const filePath = path.join(__dirname, "public", "term", `${word}.html`);

  // Use try-catch to handle errors
  try {
    // Check if the definition file already exists
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }

    // Fetch definition from the dictionary API
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    const data = response.data[0];
    const meanings = data.meanings;

    // Fetch synonyms and antonyms from the Merriam-Webster Thesaurus API
    const thesaurusResponse = await axios.get(
      `https://dictionaryapi.com/api/v3/references/thesaurus/json/${word}?key=7085ae97-a37c-4ad1-a6d1-ef26c269158d`
    );
    const thesaurusData = thesaurusResponse.data;

    updateSearches(word);

    res.locals.header = "header";
    res.render("definition", {
      word: word,
      meanings: meanings,
      thesaurusData: thesaurusData,
      recentSearches: recentSearches,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching the data.");
  }
});

const updateSearches = (word) => {
  client.lpush("recentSearches", word, (err) => {
    if (err) {
      console.error("Error updating recent searches:", err);
    } else {
      client.ltrim("recentSearches", 0, MAX_RECENT_SEARCHES - 1);
    }
  });

  client.zincrby("searchCounts", 1, word, (err) => {
    if (err) {
      console.error("Error updating search counts:", err);
    }
  });

  // Increment search count for the word
  if (searchCounts[word]) {
    searchCounts[word]++;
  } else {
    searchCounts[word] = 1;
  }
};

app.get("/glossary", (req, res) => {
  const terms = getSortedTerms();
  res.render("glossary", { terms });
});

app.get("/sitemap.xml", (req, res) => {
  const sitemap = generateSitemap();
  res.header("Content-Type", "application/xml");
  res.send(sitemap);
});

app.post("/", async (req, res, next) => {
  const word = req.body.word.toLowerCase();
  try {
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    const data = response.data[0];

    // Fetch synonyms and antonyms from the Merriam-Webster Thesaurus API
    const thesaurusResponse = await axios.get(
      `https://dictionaryapi.com/api/v3/references/thesaurus/json/${word}?key=7085ae97-a37c-4ad1-a6d1-ef26c269158d`
    );
    const thesaurusData = thesaurusResponse.data;

    client.lrange("recentSearches", 0, -1, (err, recentSearches) => {
      if (err) {
        console.error("Error getting recent searches:", err);
        recentSearches = [];
      }

      client.zrevrange(
        "searchCounts",
        0,
        MAX_POPULAR_SEARCHES - 1,
        (err, popularSearches) => {
          if (err) {
            console.error("Error getting popular searches:", err);
            popularSearches = [];
          }

          res.render("index", { recentSearches, popularSearches });
        }
      );
    });

    // Increment search count for the word
    if (searchCounts[word]) {
      searchCounts[word]++;
    } else {
      searchCounts[word] = 1;
    }

    const url = `/term/${word}`;

    try {
      const html = await ejs.renderFile(
        path.join(__dirname, "views", "definition.ejs"),
        {
          word: word,
          meanings: data.meanings,
          recentSearches: recentSearches,
          thesaurusData: thesaurusData,
        }
      );

      fs.writeFileSync(
        path.join(__dirname, "public", "term", `${word}.html`),
        html
      );
      res.redirect(url);
    } catch (err) {
      console.error(err);
      return next(err);
    }
  } catch (error) {
    console.error(error);
    return next(error);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("An internal server error occurred");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
